import type {
  Prisma,
  PrismaClient,
  WorkspaceType,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  assertFolderPermission,
  getEffectivePermissionsForFolders,
  type PermissionActor,
} from "@/modules/permissions/permission.engine";

import {
  acquireFolderMutationLock,
  assertFolderUnlockedForMutation,
} from "./folder-lock.service";
import { getMaxFolderDepth } from "./folder-topology";
import type { CopyFolderInput } from "./folder.validation";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type CopyFolderRow = {
  id: string;
  name: string;
  parentId: string | null;
  workspaceType: WorkspaceType;
  academicYearId: string | null;
  inheritPermissions: boolean;
  sortOrder: number;
  depth: number;
};

type CopyPermissionRow = {
  folderId: string;
  principalType: string;
  userId: string | null;
  groupId: string | null;
  permissions: Prisma.JsonValue;
  appliesToDescendants: boolean;
};

async function acquireCopyLock(transaction: Prisma.TransactionClient) {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext('folder-tree-topology'))
  `;
  await acquireFolderMutationLock(transaction);
}

async function getSubtree(database: DatabaseClient, sourceFolderId: string) {
  return database.$queryRaw<CopyFolderRow[]>`
    WITH RECURSIVE subtree AS (
      SELECT
        id,
        name,
        parent_id,
        workspace_type,
        academic_year_id,
        inherit_permissions,
        sort_order,
        1 AS depth
      FROM folders
      WHERE id = ${sourceFolderId}::uuid AND deleted_at IS NULL

      UNION ALL

      SELECT
        child.id,
        child.name,
        child.parent_id,
        child.workspace_type,
        child.academic_year_id,
        child.inherit_permissions,
        child.sort_order,
        subtree.depth + 1
      FROM folders child
      INNER JOIN subtree ON child.parent_id = subtree.id
      WHERE child.deleted_at IS NULL
    )
    SELECT
      id,
      name,
      parent_id AS "parentId",
      workspace_type AS "workspaceType",
      academic_year_id AS "academicYearId",
      inherit_permissions AS "inheritPermissions",
      sort_order AS "sortOrder",
      depth
    FROM subtree
    ORDER BY depth ASC, sort_order ASC, id ASC
  `;
}

async function getFolderDepth(database: DatabaseClient, folderId: string) {
  const rows = await database.$queryRaw<Array<{ depth: number }>>`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id, 1 AS depth
      FROM folders
      WHERE id = ${folderId}::uuid AND deleted_at IS NULL

      UNION ALL

      SELECT parent.id, parent.parent_id, ancestors.depth + 1
      FROM folders parent
      INNER JOIN ancestors ON ancestors.parent_id = parent.id
      WHERE parent.deleted_at IS NULL
    )
    SELECT COALESCE(MAX(depth), 0)::int AS depth
    FROM ancestors
  `;
  return rows[0]?.depth ?? 0;
}

async function prepareFolderCopy(
  database: DatabaseClient,
  sourceFolderId: string,
  input: CopyFolderInput,
  actor: PermissionActor,
) {
  const [source, target] = await Promise.all([
    database.folder.findUnique({
      where: { id: sourceFolderId },
      select: {
        id: true,
        name: true,
        parentId: true,
        workspaceType: true,
        academicYearId: true,
        deletedAt: true,
      },
    }),
    database.folder.findUnique({
      where: { id: input.targetParentId },
      select: {
        id: true,
        name: true,
        workspaceType: true,
        academicYearId: true,
        deletedAt: true,
      },
    }),
  ]);

  if (!source || source.deletedAt || !target || target.deletedAt) {
    throw new AppError(
      "NOT_FOUND",
      "Không tìm thấy thư mục nguồn hoặc thư mục đích",
      404,
    );
  }
  if (
    source.workspaceType !== "SHARED" ||
    target.workspaceType !== "SHARED" ||
    !source.academicYearId ||
    !target.academicYearId
  ) {
    throw new AppError(
      "COPY_REQUIRES_ACADEMIC_YEAR",
      "Chỉ sao chép cấu trúc giữa các kho dùng chung theo năm học",
      409,
    );
  }
  if (source.parentId === null) {
    throw new AppError(
      "SYSTEM_ROOT_IMMUTABLE",
      "Hãy chọn một nhánh bên trong năm học, không chọn thư mục gốc",
      409,
    );
  }
  if (source.academicYearId === target.academicYearId) {
    throw new AppError(
      "ACADEMIC_YEAR_COPY_TARGET_INVALID",
      "Năm học đích phải khác năm học nguồn",
      409,
    );
  }

  await assertFolderPermission(actor, target.id, "CREATE_SUBFOLDER", database);
  await assertFolderUnlockedForMutation(actor, target.id, database);

  const subtree = await getSubtree(database, source.id);
  const permissions = await getEffectivePermissionsForFolders(
    actor,
    subtree.map(({ id }) => id),
    database,
  );
  if (
    subtree.some(({ id }) => !permissions.get(id)?.permissions.includes("VIEW"))
  ) {
    throw new AppError(
      "FORBIDDEN",
      "Bạn không có quyền xem toàn bộ nhánh nguồn",
      403,
    );
  }

  if (input.copyPermissions) {
    if (
      subtree.some(
        ({ id }) =>
          !permissions.get(id)?.permissions.includes("MANAGE_PERMISSIONS"),
      )
    ) {
      throw new AppError(
        "FORBIDDEN",
        "Cần quyền MANAGE_PERMISSIONS trên toàn bộ nhánh nguồn để sao chép ACL",
        403,
      );
    }
    await assertFolderPermission(
      actor,
      target.id,
      "MANAGE_PERMISSIONS",
      database,
    );
  }

  const duplicate = await database.folder.findFirst({
    where: {
      parentId: target.id,
      deletedAt: null,
      name: { equals: source.name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError(
      "FOLDER_NAME_CONFLICT",
      "Thư mục đích đã có một nhánh cùng tên",
      409,
    );
  }

  const targetDepth = await getFolderDepth(database, target.id);
  const subtreeHeight = Math.max(...subtree.map(({ depth }) => depth), 1);
  if (targetDepth + subtreeHeight > getMaxFolderDepth()) {
    throw new AppError(
      "MAX_FOLDER_DEPTH_EXCEEDED",
      `Kết quả sao chép vượt quá giới hạn ${getMaxFolderDepth()} cấp`,
      409,
    );
  }

  const sourceIds = subtree.map(({ id }) => id);
  const [directPermissions, documentCount] = await Promise.all([
    input.copyPermissions
      ? database.folderPermission.findMany({
          where: { folderId: { in: sourceIds } },
          select: {
            folderId: true,
            principalType: true,
            userId: true,
            groupId: true,
            permissions: true,
            appliesToDescendants: true,
          },
        })
      : Promise.resolve([] as CopyPermissionRow[]),
    database.document.count({
      where: { folderId: { in: sourceIds }, deletedAt: null },
    }),
  ]);

  return {
    source,
    target,
    subtree,
    directPermissions,
    documentCount,
  };
}

function toInputJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
  if (value === null) return [];
  return value as Prisma.InputJsonValue;
}

export async function previewFolderCopy(
  sourceFolderId: string,
  input: CopyFolderInput,
  actor: PermissionActor,
) {
  const prepared = await prepareFolderCopy(
    getPrismaClient(),
    sourceFolderId,
    input,
    actor,
  );

  return {
    data: {
      source: {
        id: prepared.source.id,
        name: prepared.source.name,
        academicYearId: prepared.source.academicYearId,
      },
      target: {
        id: prepared.target.id,
        name: prepared.target.name,
        academicYearId: prepared.target.academicYearId,
      },
      folderCount: prepared.subtree.length,
      permissionCount: prepared.directPermissions.length,
      documentCountExcluded: prepared.documentCount,
      copyPermissions: input.copyPermissions,
      copyDocuments: false,
      warnings:
        prepared.documentCount > 0
          ? [
              `${prepared.documentCount} tài liệu sẽ không được sao chép trong Phase 7.`,
            ]
          : [],
    },
  };
}

export async function copyFolderStructure(
  sourceFolderId: string,
  input: CopyFolderInput,
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    await acquireCopyLock(tx);
    const prepared = await prepareFolderCopy(tx, sourceFolderId, input, actor);
    const lastSibling = await tx.folder.aggregate({
      where: { parentId: prepared.target.id, deletedAt: null },
      _max: { sortOrder: true },
    });
    const copiedIds = new Map<string, string>();
    let copiedRootId = "";

    for (const folder of prepared.subtree) {
      const isRoot = folder.id === prepared.source.id;
      const parentId = isRoot
        ? prepared.target.id
        : copiedIds.get(folder.parentId!);
      if (!parentId) {
        throw new AppError(
          "COPY_TOPOLOGY_INVALID",
          "Không thể xác định thư mục cha trong nhánh sao chép",
          409,
        );
      }

      const copied = await tx.folder.create({
        data: {
          name: folder.name,
          parentId,
          workspaceType: "SHARED",
          academicYearId: prepared.target.academicYearId,
          inheritPermissions: folder.inheritPermissions,
          isLocked: false,
          lockDescendants: false,
          sortOrder: isRoot
            ? (lastSibling._max.sortOrder ?? -1) + 1
            : folder.sortOrder,
          createdBy: actor.id,
        },
        select: { id: true },
      });
      copiedIds.set(folder.id, copied.id);
      if (isRoot) copiedRootId = copied.id;
    }

    if (input.copyPermissions && prepared.directPermissions.length > 0) {
      await tx.folderPermission.createMany({
        data: prepared.directPermissions.map((permission) => ({
          folderId: copiedIds.get(permission.folderId)!,
          principalType: permission.principalType,
          userId: permission.userId,
          groupId: permission.groupId,
          permissions: toInputJson(permission.permissions),
          appliesToDescendants: permission.appliesToDescendants,
          grantedBy: actor.id,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "FOLDER_STRUCTURE_COPIED",
        entityType: "FOLDER",
        entityId: copiedRootId,
        folderId: copiedRootId,
        metadata: {
          sourceFolderId: prepared.source.id,
          sourceAcademicYearId: prepared.source.academicYearId,
          targetParentId: prepared.target.id,
          targetAcademicYearId: prepared.target.academicYearId,
          copiedRootId,
          folderCount: prepared.subtree.length,
          permissionCount: prepared.directPermissions.length,
          documentCountExcluded: prepared.documentCount,
          copyPermissions: input.copyPermissions,
          copyDocuments: false,
        },
      },
    });

    return {
      data: {
        copiedRootId,
        folderCount: prepared.subtree.length,
        permissionCount: prepared.directPermissions.length,
        documentCountExcluded: prepared.documentCount,
      },
    };
  });
}
