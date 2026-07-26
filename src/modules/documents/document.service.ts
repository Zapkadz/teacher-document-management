import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  acquireFolderMutationLock,
  assertFolderUnlockedForMutation,
  getEffectiveFolderLock,
} from "@/modules/folders/folder-lock.service";
import {
  type PermissionActor,
  assertFolderPermission,
  getEffectivePermissions,
  getEffectivePermissionsForFolders,
} from "@/modules/permissions/permission.engine";
import {
  createPresignedDownload,
  createPresignedUpload,
  deleteStoredObject,
  headStoredObject,
} from "@/modules/storage/s3";

import {
  type CreateLinkInput,
  type ListDocumentsQuery,
  type MoveDocumentInput,
  type PurgeTrashInput,
  type RestoreDocumentInput,
  type RestoreTrashInput,
  type TrashQuery,
  type UpdateDocumentInput,
  type UploadCompleteInput,
  type UploadInitInput,
  isPreviewableMimeType,
  validateExternalUrl,
  validateFile,
} from "./document.validation";
import {
  assertDocumentMutationPermission,
  canMutateDocument,
} from "./document.policy";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const documentSelect = {
  id: true,
  folderId: true,
  ownerUserId: true,
  title: true,
  description: true,
  documentKind: true,
  originalFileName: true,
  mimeType: true,
  fileExtension: true,
  sizeBytes: true,
  externalUrl: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  folder: {
    select: {
      id: true,
      name: true,
      workspaceType: true,
      ownerUserId: true,
      deletedAt: true,
    },
  },
  currentVersion: {
    select: { id: true, versionNumber: true, createdAt: true },
  },
} satisfies Prisma.DocumentSelect;

type DocumentRecord = Prisma.DocumentGetPayload<{
  select: typeof documentSelect;
}>;

function toDocumentDto(
  document: DocumentRecord,
  capabilities: {
    canDownload: boolean;
    canPreview: boolean;
    canEdit: boolean;
    canMove: boolean;
    canDelete: boolean;
    canRestore?: boolean;
    canPurge?: boolean;
  },
) {
  return {
    ...document,
    sizeBytes: document.sizeBytes === null ? null : Number(document.sizeBytes),
    capabilities: {
      canDownload: document.documentKind === "FILE" && capabilities.canDownload,
      canPreview:
        document.documentKind === "FILE" &&
        capabilities.canPreview &&
        isPreviewableMimeType(document.mimeType),
      canOpenLink:
        document.deletedAt === null && document.documentKind !== "FILE",
      canEdit: capabilities.canEdit,
      canMove: capabilities.canMove,
      canDelete: capabilities.canDelete,
      canRestore: capabilities.canRestore ?? false,
      canPurge: capabilities.canPurge ?? false,
    },
  };
}

async function assertActiveFolder(
  folderId: string,
  database: DatabaseClient = getPrismaClient(),
): Promise<{
  id: string;
  workspaceType: "PERSONAL" | "SHARED";
  ownerUserId: string | null;
}> {
  const folder = await database.folder.findFirst({
    where: { id: folderId, deletedAt: null },
    select: { id: true, workspaceType: true, ownerUserId: true },
  });
  if (!folder) {
    throw new AppError("NOT_FOUND", "Không tìm thấy thư mục", 404);
  }
  return folder;
}

async function findActiveDocument(
  id: string,
  database: DatabaseClient = getPrismaClient(),
) {
  const document = await database.document.findFirst({
    where: {
      id,
      deletedAt: null,
      status: "ACTIVE",
      folder: { deletedAt: null },
    },
    select: {
      ...documentSelect,
      storageKey: true,
    },
  });
  if (!document) {
    throw new AppError("DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu", 404);
  }
  return document;
}

function documentCapabilities(
  document: Pick<DocumentRecord, "ownerUserId" | "deletedAt">,
  actor: PermissionActor,
  permissions: readonly string[],
  isLocked = false,
) {
  const active = document.deletedAt === null;
  const canMutate = active && (actor.globalRole === "ADMIN" || !isLocked);
  return {
    canDownload:
      active &&
      permissions.includes("VIEW") &&
      permissions.includes("DOWNLOAD"),
    canPreview:
      active && permissions.includes("VIEW") && permissions.includes("PREVIEW"),
    canEdit:
      canMutate &&
      canMutateDocument("EDIT", actor.id, document.ownerUserId, permissions),
    canMove:
      canMutate &&
      canMutateDocument("MOVE", actor.id, document.ownerUserId, permissions),
    canDelete:
      canMutate &&
      canMutateDocument("DELETE", actor.id, document.ownerUserId, permissions),
  };
}

export async function listDocuments(
  folderId: string,
  query: ListDocumentsQuery,
  actor: PermissionActor,
) {
  await assertActiveFolder(folderId);
  const [effective, lock] = await Promise.all([
    assertFolderPermission(actor, folderId, "VIEW"),
    getEffectiveFolderLock(folderId),
  ]);
  const skip = (query.page - 1) * query.limit;
  const where: Prisma.DocumentWhereInput = {
    folderId,
    deletedAt: null,
    status: "ACTIVE",
    documentKind: query.kind,
    ownerUserId: query.ownerUserId,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
            {
              originalFileName: {
                contains: query.search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const prisma = getPrismaClient();
  const orderBy: Prisma.DocumentOrderByWithRelationInput[] =
    query.sort === "oldest"
      ? [{ createdAt: "asc" }, { id: "asc" }]
      : query.sort === "title_asc"
        ? [{ title: "asc" }, { id: "asc" }]
        : query.sort === "title_desc"
          ? [{ title: "desc" }, { id: "asc" }]
          : [{ createdAt: "desc" }, { id: "asc" }];
  const [documents, total] = await prisma.$transaction([
    prisma.document.findMany({
      where,
      select: documentSelect,
      orderBy,
      skip,
      take: query.limit,
    }),
    prisma.document.count({ where }),
  ]);

  return {
    data: documents.map((document) =>
      toDocumentDto(
        document,
        documentCapabilities(
          document,
          actor,
          effective.permissions,
          lock.isLocked,
        ),
      ),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function initializeUpload(
  input: UploadInitInput,
  actor: PermissionActor,
) {
  const file = validateFile(input);
  const folder = await assertActiveFolder(input.folderId);
  await assertFolderPermission(actor, folder.id, "UPLOAD");
  await assertFolderUnlockedForMutation(actor, folder.id);

  const uploadId = randomUUID();
  const documentId = randomUUID();
  const versionId = randomUUID();
  const storageKey = [
    "school",
    folder.workspaceType.toLowerCase(),
    folder.id,
    documentId,
    versionId,
    file.safeFileName,
  ].join("/");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await getPrismaClient().uploadSession.create({
    data: {
      id: uploadId,
      documentId,
      versionId,
      folderId: folder.id,
      userId: actor.id,
      originalFileName: file.originalFileName,
      safeFileName: file.safeFileName,
      mimeType: file.mimeType,
      fileExtension: file.fileExtension,
      sizeBytes: file.sizeBytes,
      storageKey,
      expiresAt,
    },
  });

  try {
    const signed = await createPresignedUpload({
      key: storageKey,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadId,
    });
    return {
      data: {
        uploadId,
        documentId,
        uploadUrl: signed.url,
        requiredHeaders: signed.headers,
        expiresAt,
        maxAgeSeconds: signed.expiresIn,
      },
    };
  } catch (error) {
    await getPrismaClient().uploadSession.delete({ where: { id: uploadId } });
    throw error;
  }
}

async function removeObjectWithoutMaskingError(storageKey: string) {
  try {
    await deleteStoredObject(storageKey);
  } catch (error) {
    console.error("Failed to remove orphaned upload object", error);
  }
}

export async function completeUpload(
  input: UploadCompleteInput,
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();
  const upload = await prisma.uploadSession.findUnique({
    where: { id: input.uploadId },
  });

  if (!upload || upload.userId !== actor.id) {
    throw new AppError(
      "UPLOAD_SESSION_NOT_FOUND",
      "Không tìm thấy phiên upload",
      404,
    );
  }
  if (upload.completedAt) {
    throw new AppError(
      "UPLOAD_ALREADY_COMPLETED",
      "Phiên upload đã được hoàn tất",
      409,
    );
  }
  if (upload.expiresAt <= new Date()) {
    throw new AppError(
      "UPLOAD_SESSION_EXPIRED",
      "Phiên upload đã hết hạn",
      410,
    );
  }

  await assertActiveFolder(upload.folderId);
  await assertFolderPermission(actor, upload.folderId, "UPLOAD");
  await assertFolderUnlockedForMutation(actor, upload.folderId);

  let object;
  try {
    object = await headStoredObject(upload.storageKey);
  } catch {
    throw new AppError(
      "UPLOAD_OBJECT_NOT_FOUND",
      "File chưa được tải lên object storage",
      409,
    );
  }

  const actualSize = Number(object.ContentLength ?? -1);
  const actualMimeType = object.ContentType ?? "";
  const actualUploadId = object.Metadata?.["upload-session-id"];
  if (
    actualSize !== Number(upload.sizeBytes) ||
    actualMimeType !== upload.mimeType ||
    actualUploadId !== upload.id
  ) {
    await removeObjectWithoutMaskingError(upload.storageKey);
    throw new AppError(
      "UPLOAD_OBJECT_MISMATCH",
      "Metadata file trên object storage không khớp phiên upload",
      409,
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await acquireFolderMutationLock(tx);
      await assertActiveFolder(upload.folderId, tx);
      await assertFolderPermission(actor, upload.folderId, "UPLOAD", tx);
      await assertFolderUnlockedForMutation(actor, upload.folderId, tx);
      const claimed = await tx.uploadSession.updateMany({
        where: {
          id: upload.id,
          userId: actor.id,
          completedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { completedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          "UPLOAD_ALREADY_COMPLETED",
          "Phiên upload đã được hoàn tất hoặc hết hạn",
          409,
        );
      }

      await tx.document.create({
        data: {
          id: upload.documentId,
          folderId: upload.folderId,
          ownerUserId: actor.id,
          title: input.title,
          description: input.description || null,
          documentKind: "FILE",
          originalFileName: upload.originalFileName,
          mimeType: upload.mimeType,
          fileExtension: upload.fileExtension,
          sizeBytes: upload.sizeBytes,
          storageKey: upload.storageKey,
        },
      });
      await tx.documentVersion.create({
        data: {
          id: upload.versionId,
          documentId: upload.documentId,
          versionNumber: 1,
          originalFileName: upload.originalFileName,
          storageKey: upload.storageKey,
          mimeType: upload.mimeType,
          sizeBytes: upload.sizeBytes,
          createdBy: actor.id,
        },
      });
      const document = await tx.document.update({
        where: { id: upload.documentId },
        data: { currentVersionId: upload.versionId },
        select: documentSelect,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "DOCUMENT_UPLOADED",
          entityType: "DOCUMENT",
          entityId: document.id,
          folderId: document.folderId,
          metadata: {
            originalFileName: upload.originalFileName,
            mimeType: upload.mimeType,
            sizeBytes: Number(upload.sizeBytes),
            versionNumber: 1,
          },
        },
      });

      const effective = await getEffectivePermissions(
        actor,
        document.folderId,
        tx,
      );
      return {
        data: toDocumentDto(
          document,
          documentCapabilities(document, actor, effective.permissions),
        ),
      };
    });
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === "UPLOAD_ALREADY_COMPLETED"
    ) {
      throw error;
    }
    await removeObjectWithoutMaskingError(upload.storageKey);
    throw error;
  }
}

export async function createLinkDocument(
  input: CreateLinkInput,
  actor: PermissionActor,
) {
  await assertActiveFolder(input.folderId);
  await assertFolderPermission(actor, input.folderId, "UPLOAD");
  await assertFolderUnlockedForMutation(actor, input.folderId);
  const externalUrl = validateExternalUrl(input.kind, input.externalUrl);
  const documentId = randomUUID();
  const versionId = randomUUID();
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    await acquireFolderMutationLock(tx);
    await assertActiveFolder(input.folderId, tx);
    const effective = await assertFolderPermission(
      actor,
      input.folderId,
      "UPLOAD",
      tx,
    );
    await assertFolderUnlockedForMutation(actor, input.folderId, tx);
    await tx.document.create({
      data: {
        id: documentId,
        folderId: input.folderId,
        ownerUserId: actor.id,
        title: input.title,
        description: input.description || null,
        documentKind: input.kind,
        externalUrl,
      },
    });
    await tx.documentVersion.create({
      data: {
        id: versionId,
        documentId,
        versionNumber: 1,
        externalUrl,
        createdBy: actor.id,
      },
    });
    const document = await tx.document.update({
      where: { id: documentId },
      data: { currentVersionId: versionId },
      select: documentSelect,
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "DOCUMENT_LINK_CREATED",
        entityType: "DOCUMENT",
        entityId: document.id,
        folderId: document.folderId,
        metadata: {
          documentKind: input.kind,
          externalUrl,
        },
      },
    });

    return {
      data: toDocumentDto(
        document,
        documentCapabilities(document, actor, effective.permissions),
      ),
    };
  });
}

export async function getDocument(id: string, actor: PermissionActor) {
  const document = await findActiveDocument(id);
  const effective = await assertFolderPermission(
    actor,
    document.folderId,
    "VIEW",
  );
  const lock = await getEffectiveFolderLock(document.folderId);
  return {
    data: toDocumentDto(
      document,
      documentCapabilities(
        document,
        actor,
        effective.permissions,
        lock.isLocked,
      ),
    ),
  };
}

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput,
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    await acquireFolderMutationLock(tx);
    const document = await findActiveDocument(id, tx);
    const effective = await assertDocumentMutationPermission(
      "EDIT",
      actor,
      document.folderId,
      document.ownerUserId,
      tx,
    );
    await assertFolderUnlockedForMutation(actor, document.folderId, tx);

    const updated = await tx.document.update({
      where: { id: document.id },
      data: {
        title: input.title,
        description: input.description || null,
      },
      select: documentSelect,
    });

    if (
      document.title !== updated.title ||
      document.description !== updated.description
    ) {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "DOCUMENT_UPDATED",
          entityType: "DOCUMENT",
          entityId: document.id,
          folderId: document.folderId,
          metadata: {
            before: {
              title: document.title,
              description: document.description,
            },
            after: {
              title: updated.title,
              description: updated.description,
            },
          },
        },
      });
    }

    return {
      data: toDocumentDto(
        updated,
        documentCapabilities(updated, actor, effective.permissions),
      ),
    };
  });
}

export async function moveDocument(
  id: string,
  input: MoveDocumentInput,
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    await acquireFolderMutationLock(tx);
    const document = await findActiveDocument(id, tx);
    await assertDocumentMutationPermission(
      "MOVE",
      actor,
      document.folderId,
      document.ownerUserId,
      tx,
    );
    await assertFolderUnlockedForMutation(actor, document.folderId, tx);

    const target = await assertActiveFolder(input.targetFolderId, tx);
    const targetPermissions = await assertFolderPermission(
      actor,
      target.id,
      "UPLOAD",
      tx,
    );
    await assertFolderUnlockedForMutation(actor, target.id, tx);

    if (document.folderId === target.id) {
      return {
        data: toDocumentDto(
          document,
          documentCapabilities(document, actor, targetPermissions.permissions),
        ),
      };
    }

    const updated = await tx.document.update({
      where: { id: document.id },
      data: { folderId: target.id },
      select: documentSelect,
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "DOCUMENT_MOVED",
        entityType: "DOCUMENT",
        entityId: document.id,
        folderId: target.id,
        metadata: {
          fromFolderId: document.folderId,
          toFolderId: target.id,
        },
      },
    });

    return {
      data: toDocumentDto(
        updated,
        documentCapabilities(updated, actor, targetPermissions.permissions),
      ),
    };
  });
}

export async function softDeleteDocument(id: string, actor: PermissionActor) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    await acquireFolderMutationLock(tx);
    const document = await findActiveDocument(id, tx);
    await assertDocumentMutationPermission(
      "DELETE",
      actor,
      document.folderId,
      document.ownerUserId,
      tx,
    );
    await assertFolderUnlockedForMutation(actor, document.folderId, tx);

    const deletedAt = new Date();
    await tx.document.update({
      where: { id: document.id },
      data: {
        deletedAt,
        deletedBy: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "DOCUMENT_DELETED",
        entityType: "DOCUMENT",
        entityId: document.id,
        folderId: document.folderId,
        metadata: {
          title: document.title,
          documentKind: document.documentKind,
          storageObjectRetained: true,
        },
      },
    });

    return {
      data: {
        id: document.id,
        deletedAt,
      },
    };
  });
}

async function restoreDeletedDocument(
  transaction: Prisma.TransactionClient,
  id: string,
  input: RestoreDocumentInput,
  actor: PermissionActor,
) {
  const document = await transaction.document.findUnique({
    where: { id },
    select: documentSelect,
  });
  if (!document) {
    throw new AppError("DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu", 404);
  }
  if (!document.deletedAt) {
    throw new AppError("DOCUMENT_NOT_DELETED", "Tài liệu chưa bị xóa", 409);
  }

  await assertFolderPermission(
    actor,
    document.folderId,
    "RESTORE",
    transaction,
  );

  const targetFolderId =
    input.targetFolderId ??
    (document.folder.deletedAt === null ? document.folderId : null);
  if (!targetFolderId) {
    throw new AppError(
      "RESTORE_TARGET_REQUIRED",
      "Thư mục gốc không còn hoạt động; hãy chọn thư mục đích",
      409,
    );
  }

  await assertActiveFolder(targetFolderId, transaction);
  const targetPermissions = await assertFolderPermission(
    actor,
    targetFolderId,
    "RESTORE",
    transaction,
  );
  await assertFolderUnlockedForMutation(actor, targetFolderId, transaction);

  const restored = await transaction.document.update({
    where: { id: document.id },
    data: {
      folderId: targetFolderId,
      deletedAt: null,
      deletedBy: null,
    },
    select: documentSelect,
  });
  await transaction.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "DOCUMENT_RESTORED",
      entityType: "DOCUMENT",
      entityId: document.id,
      folderId: targetFolderId,
      metadata: {
        originalFolderId: document.folderId,
        restoredFolderId: targetFolderId,
      },
    },
  });

  return toDocumentDto(
    restored,
    documentCapabilities(restored, actor, targetPermissions.permissions),
  );
}

export async function restoreDocument(
  id: string,
  input: RestoreDocumentInput,
  actor: PermissionActor,
) {
  return getPrismaClient().$transaction(async (tx) => {
    await acquireFolderMutationLock(tx);
    return {
      data: await restoreDeletedDocument(tx, id, input, actor),
    };
  });
}

export async function listTrash(query: TrashQuery, actor: PermissionActor) {
  const prisma = getPrismaClient();
  const documents = await prisma.document.findMany({
    where: {
      deletedAt: {
        not: null,
        gte: query.from,
        lte: query.to,
      },
      deletedBy: query.deletedBy,
      folderId: query.folderId,
      folder: query.workspace ? { workspaceType: query.workspace } : undefined,
    },
    select: documentSelect,
    orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
  });
  const folderIds = [...new Set(documents.map(({ folderId }) => folderId))];
  const permissions = await getEffectivePermissionsForFolders(
    actor,
    folderIds,
    prisma,
  );
  const visible = documents.filter((document) =>
    permissions.get(document.folderId)?.permissions.includes("RESTORE"),
  );
  const skip = (query.page - 1) * query.limit;
  const page = visible.slice(skip, skip + query.limit);
  const lockEntries = await Promise.all(
    [...new Set(page.map(({ folderId }) => folderId))].map(
      async (folderId) =>
        [folderId, await getEffectiveFolderLock(folderId, prisma)] as const,
    ),
  );
  const locks = new Map(lockEntries);

  return {
    data: page.map((document) => {
      const effective = permissions.get(document.folderId)!;
      const sourceLocked = locks.get(document.folderId)?.isLocked ?? false;
      return {
        ...toDocumentDto(document, {
          ...documentCapabilities(
            document,
            actor,
            effective.permissions,
            sourceLocked,
          ),
          canRestore:
            document.folder.deletedAt !== null ||
            actor.globalRole === "ADMIN" ||
            !sourceLocked,
          canPurge: actor.globalRole === "ADMIN",
        }),
        requiresTargetFolder: document.folder.deletedAt !== null,
      };
    }),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: visible.length,
      totalPages: Math.ceil(visible.length / query.limit),
    },
  };
}

export async function restoreTrashItems(
  input: RestoreTrashInput,
  actor: PermissionActor,
) {
  return getPrismaClient().$transaction(async (tx) => {
    await acquireFolderMutationLock(tx);
    const restored = [];
    for (const item of input.items) {
      restored.push(
        await restoreDeletedDocument(
          tx,
          item.entityId,
          { targetFolderId: item.targetFolderId },
          actor,
        ),
      );
    }
    return { data: restored };
  });
}

export async function purgeTrashItems(
  input: PurgeTrashInput,
  actor: PermissionActor,
) {
  if (actor.globalRole !== "ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Chỉ quản trị viên được xóa vĩnh viễn",
      403,
    );
  }

  const ids = [...new Set(input.items.map(({ entityId }) => entityId))];
  const prisma = getPrismaClient();
  const documents = await prisma.document.findMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
    select: {
      id: true,
      folderId: true,
      title: true,
      versions: { select: { storageKey: true } },
    },
  });
  if (documents.length !== ids.length) {
    throw new AppError(
      "DOCUMENT_NOT_FOUND",
      "Một hoặc nhiều tài liệu không tồn tại trong thùng rác",
      404,
    );
  }

  await prisma.$transaction(async (tx) => {
    await acquireFolderMutationLock(tx);
    await tx.uploadSession.deleteMany({
      where: { documentId: { in: ids } },
    });
    await tx.document.updateMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      data: { currentVersionId: null },
    });
    const deleted = await tx.document.deleteMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
    });
    if (deleted.count !== documents.length) {
      throw new AppError(
        "DOCUMENT_NOT_FOUND",
        "Một hoặc nhiều tài liệu không còn trong thùng rác",
        409,
      );
    }
    for (const document of documents) {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "DOCUMENT_PURGED",
          entityType: "DOCUMENT",
          entityId: document.id,
          folderId: document.folderId,
          metadata: { title: document.title },
        },
      });
    }
  });

  const storageKeys = [
    ...new Set(
      documents.flatMap(({ versions }) =>
        versions.flatMap(({ storageKey }) => (storageKey ? [storageKey] : [])),
      ),
    ),
  ];
  const cleanup = await Promise.allSettled(
    storageKeys.map((storageKey) => deleteStoredObject(storageKey)),
  );

  return {
    data: {
      purged: documents.length,
      storageCleanupFailures: cleanup.filter(
        (result) => result.status === "rejected",
      ).length,
    },
  };
}

async function getFileForAccess(id: string) {
  const document = await findActiveDocument(id);
  if (
    document.documentKind !== "FILE" ||
    !document.storageKey ||
    !document.originalFileName
  ) {
    throw new AppError(
      "DOCUMENT_NOT_FILE",
      "Tài liệu này không phải file lưu trữ",
      409,
    );
  }
  return document;
}

export async function createDownload(id: string, actor: PermissionActor) {
  const document = await getFileForAccess(id);
  await assertFolderPermission(actor, document.folderId, "VIEW");
  await assertFolderPermission(actor, document.folderId, "DOWNLOAD");
  const signed = await createPresignedDownload({
    key: document.storageKey!,
    fileName: document.originalFileName!,
    mode: "attachment",
  });

  await getPrismaClient().auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "DOCUMENT_DOWNLOADED",
      entityType: "DOCUMENT",
      entityId: document.id,
      folderId: document.folderId,
      metadata: {
        originalFileName: document.originalFileName,
        versionId: document.currentVersion?.id,
      },
    },
  });
  return { data: signed };
}

export async function createPreview(id: string, actor: PermissionActor) {
  const document = await getFileForAccess(id);
  await assertFolderPermission(actor, document.folderId, "VIEW");
  await assertFolderPermission(actor, document.folderId, "PREVIEW");
  if (!isPreviewableMimeType(document.mimeType)) {
    throw new AppError(
      "PREVIEW_NOT_SUPPORTED",
      "Định dạng file này chưa hỗ trợ xem trước",
      409,
    );
  }
  const signed = await createPresignedDownload({
    key: document.storageKey!,
    fileName: document.originalFileName!,
    mode: "inline",
  });
  await getPrismaClient().auditLog.create({
    data: {
      actorUserId: actor.id,
      action: "DOCUMENT_PREVIEWED",
      entityType: "DOCUMENT",
      entityId: document.id,
      folderId: document.folderId,
      metadata: {
        originalFileName: document.originalFileName,
        versionId: document.currentVersion?.id,
      },
    },
  });
  return {
    data: signed,
  };
}
