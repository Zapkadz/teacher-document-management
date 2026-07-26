import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  type PermissionActor,
  assertFolderPermission,
  getEffectivePermissions,
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
  type UploadCompleteInput,
  type UploadInitInput,
  isPreviewableMimeType,
  validateExternalUrl,
  validateFile,
} from "./document.validation";

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
      canOpenLink: document.documentKind !== "FILE",
    },
  };
}

async function assertActiveFolder(
  folderId: string,
): Promise<{ id: string; workspaceType: "PERSONAL" | "SHARED" }> {
  const folder = await getPrismaClient().folder.findFirst({
    where: { id: folderId, deletedAt: null },
    select: { id: true, workspaceType: true },
  });
  if (!folder) {
    throw new AppError("NOT_FOUND", "Không tìm thấy thư mục", 404);
  }
  return folder;
}

async function findActiveDocument(id: string) {
  const document = await getPrismaClient().document.findFirst({
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

function documentCapabilities(permissions: readonly string[]) {
  return {
    canDownload:
      permissions.includes("VIEW") && permissions.includes("DOWNLOAD"),
    canPreview: permissions.includes("VIEW") && permissions.includes("PREVIEW"),
  };
}

export async function listDocuments(
  folderId: string,
  query: ListDocumentsQuery,
  actor: PermissionActor,
) {
  await assertActiveFolder(folderId);
  const effective = await assertFolderPermission(actor, folderId, "VIEW");
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
  const capabilities = documentCapabilities(effective.permissions);

  return {
    data: documents.map((document) => toDocumentDto(document, capabilities)),
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
          documentCapabilities(effective.permissions),
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
  const effective = await assertFolderPermission(
    actor,
    input.folderId,
    "UPLOAD",
  );
  const externalUrl = validateExternalUrl(input.kind, input.externalUrl);
  const documentId = randomUUID();
  const versionId = randomUUID();
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
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
        documentCapabilities(effective.permissions),
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
  return {
    data: toDocumentDto(document, documentCapabilities(effective.permissions)),
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
  return {
    data: await createPresignedDownload({
      key: document.storageKey!,
      fileName: document.originalFileName!,
      mode: "inline",
    }),
  };
}
