import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { getMaxFolderDepth } from "@/modules/folders/folder-topology";

import {
  type Permission,
  isPermission,
  normalizePermissions,
} from "./permission.constants";
import {
  type PermissionActor,
  assertFolderPermission,
  getEffectivePermissions,
} from "./permission.engine";
import type {
  CreateFolderPermissionInput,
  UpdateFolderPermissionInput,
} from "./permission.validation";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type PathRow = {
  id: string;
  name: string;
  inheritPermissions: boolean;
  depth: number;
};

async function getPermissionPath(
  database: DatabaseClient,
  folderId: string,
): Promise<PathRow[]> {
  const maxDepth = getMaxFolderDepth();
  return database.$queryRaw<PathRow[]>(Prisma.sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, parent_id, inherit_permissions, 0 AS depth
      FROM folders
      WHERE id = ${folderId}::uuid

      UNION ALL

      SELECT
        parent.id,
        parent.name,
        parent.parent_id,
        parent.inherit_permissions,
        ancestors.depth + 1
      FROM folders parent
      INNER JOIN ancestors ON ancestors.parent_id = parent.id
      WHERE ancestors.depth < ${maxDepth}
    )
    SELECT
      id,
      name,
      inherit_permissions AS "inheritPermissions",
      depth
    FROM ancestors
    ORDER BY depth
  `);
}

function getInheritedFolderIds(path: PathRow[]): string[] {
  const inherited: string[] = [];
  let canContinueUpward = path[0]?.inheritPermissions ?? false;

  for (const folder of path.slice(1)) {
    if (!canContinueUpward) break;
    inherited.push(folder.id);
    canContinueUpward = folder.inheritPermissions;
  }

  return inherited;
}

async function assertCanDelegate(
  actor: PermissionActor,
  folderId: string,
  permissions: readonly Permission[],
  database: DatabaseClient,
): Promise<void> {
  const effective = await assertFolderPermission(
    actor,
    folderId,
    "MANAGE_PERMISSIONS",
    database,
  );

  if (
    actor.globalRole !== "ADMIN" &&
    permissions.some(
      (permission) => !effective.permissions.includes(permission),
    )
  ) {
    throw new AppError(
      "CANNOT_DELEGATE_PERMISSION",
      "Bạn chỉ có thể cấp các quyền mà chính bạn đang có",
      403,
    );
  }
}

const permissionInclude = {
  user: { select: { id: true, name: true, email: true, status: true } },
  group: { select: { id: true, name: true } },
  granter: { select: { id: true, name: true, email: true } },
  folder: { select: { id: true, name: true } },
} satisfies Prisma.FolderPermissionInclude;

type PermissionRecord = Prisma.FolderPermissionGetPayload<{
  include: typeof permissionInclude;
}>;

function toPermissionDto(
  record: PermissionRecord,
  source: "DIRECT" | "INHERITED",
) {
  return {
    id: record.id,
    folderId: record.folderId,
    folderName: record.folder.name,
    source,
    principalType: record.principalType,
    principal:
      record.principalType === "GROUP"
        ? {
            id: record.group!.id,
            name: record.group!.name,
            email: null,
          }
        : {
            id: record.user!.id,
            name: record.user!.name,
            email: record.user!.email,
            status: record.user!.status,
          },
    permissions: record.permissions,
    appliesToDescendants: record.appliesToDescendants,
    grantedBy: {
      id: record.granter.id,
      name: record.granter.name,
      email: record.granter.email,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listFolderPermissions(
  folderId: string,
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();
  await assertFolderPermission(actor, folderId, "MANAGE_PERMISSIONS", prisma);

  const path = await getPermissionPath(prisma, folderId);
  const target = path[0];
  if (!target) throw new AppError("NOT_FOUND", "Không tìm thấy thư mục", 404);

  const inheritedFolderIds = getInheritedFolderIds(path);
  const [records, users, groups, effective] = await Promise.all([
    prisma.folderPermission.findMany({
      where: {
        OR: [
          { folderId },
          ...(inheritedFolderIds.length > 0
            ? [
                {
                  folderId: { in: inheritedFolderIds },
                  appliesToDescendants: true,
                },
              ]
            : []),
        ],
      },
      include: permissionInclude,
      orderBy: [{ folderId: "asc" }, { createdAt: "asc" }],
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 500,
    }),
    prisma.group.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    getEffectivePermissions(actor, folderId, prisma),
  ]);

  return {
    data: {
      folderId,
      inheritPermissions: target.inheritPermissions,
      direct: records
        .filter((record) => record.folderId === folderId)
        .map((record) => toPermissionDto(record, "DIRECT")),
      inherited: records
        .filter((record) => record.folderId !== folderId)
        .map((record) => toPermissionDto(record, "INHERITED")),
      effectivePermissions: effective.permissions,
      availableUsers: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      })),
      availableGroups: groups,
    },
  };
}

export async function createFolderPermissions(
  folderId: string,
  input: CreateFolderPermissionInput,
  actor: PermissionActor,
) {
  const normalized = normalizePermissions(input.permissions);
  const prisma = getPrismaClient();

  try {
    return await prisma.$transaction(async (tx) => {
      await assertCanDelegate(actor, folderId, normalized, tx);

      if (input.principalType === "USER") {
        const users = await tx.user.findMany({
          where: { id: { in: input.principalIds }, status: "ACTIVE" },
          select: { id: true },
        });
        if (users.length !== new Set(input.principalIds).size) {
          throw new AppError(
            "INVALID_PRINCIPAL",
            "Có người dùng không tồn tại hoặc chưa ACTIVE",
            400,
          );
        }
      } else {
        const groupCount = await tx.group.count({
          where: { id: { in: input.principalIds } },
        });
        if (groupCount !== new Set(input.principalIds).size) {
          throw new AppError("INVALID_PRINCIPAL", "Có nhóm không tồn tại", 400);
        }
      }

      const created = [];
      for (const principalId of new Set(input.principalIds)) {
        const permission = await tx.folderPermission.create({
          data: {
            folderId,
            principalType: input.principalType,
            userId: input.principalType === "USER" ? principalId : null,
            groupId: input.principalType === "GROUP" ? principalId : null,
            permissions: normalized,
            appliesToDescendants: input.appliesToDescendants,
            grantedBy: actor.id,
          },
          include: permissionInclude,
        });
        created.push(permission);
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "FOLDER_PERMISSION_GRANTED",
          entityType: "FOLDER",
          entityId: folderId,
          folderId,
          metadata: {
            principalType: input.principalType,
            principalIds: input.principalIds,
            permissions: normalized,
            appliesToDescendants: input.appliesToDescendants,
          },
        },
      });

      return {
        data: created.map((record) => toPermissionDto(record, "DIRECT")),
      };
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "PERMISSION_ALREADY_EXISTS",
        "Principal đã có quyền trực tiếp tại thư mục này",
        409,
      );
    }
    throw error;
  }
}

export async function updateFolderPermission(
  folderId: string,
  permissionId: string,
  input: UpdateFolderPermissionInput,
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const current = await tx.folderPermission.findFirst({
      where: { id: permissionId, folderId },
      include: permissionInclude,
    });
    if (!current) {
      throw new AppError(
        "PERMISSION_NOT_FOUND",
        "Không tìm thấy quyền trực tiếp",
        404,
      );
    }

    const normalized = input.permissions
      ? normalizePermissions(input.permissions)
      : undefined;
    const delegatedPermissions =
      normalized ??
      (Array.isArray(current.permissions)
        ? current.permissions.filter(isPermission)
        : []);
    await assertCanDelegate(actor, folderId, delegatedPermissions, tx);

    const updated = await tx.folderPermission.update({
      where: { id: current.id },
      data: {
        permissions: normalized,
        appliesToDescendants: input.appliesToDescendants,
        grantedBy: actor.id,
      },
      include: permissionInclude,
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "FOLDER_PERMISSION_UPDATED",
        entityType: "FOLDER_PERMISSION",
        entityId: current.id,
        folderId,
        metadata: {
          before: {
            permissions: current.permissions,
            appliesToDescendants: current.appliesToDescendants,
          },
          after: {
            permissions: updated.permissions,
            appliesToDescendants: updated.appliesToDescendants,
          },
        },
      },
    });

    return { data: toPermissionDto(updated, "DIRECT") };
  });
}

export async function deleteFolderPermission(
  folderId: string,
  permissionId: string,
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    await assertFolderPermission(actor, folderId, "MANAGE_PERMISSIONS", tx);
    const current = await tx.folderPermission.findFirst({
      where: { id: permissionId, folderId },
      include: permissionInclude,
    });
    if (!current) {
      throw new AppError(
        "PERMISSION_NOT_FOUND",
        "Không tìm thấy quyền trực tiếp",
        404,
      );
    }

    await tx.folderPermission.delete({ where: { id: current.id } });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "FOLDER_PERMISSION_REVOKED",
        entityType: "FOLDER_PERMISSION",
        entityId: current.id,
        folderId,
        metadata: {
          principalType: current.principalType,
          principalId: current.userId ?? current.groupId,
          permissions: current.permissions,
          appliesToDescendants: current.appliesToDescendants,
        },
      },
    });

    return { data: { id: current.id, deleted: true } };
  });
}

export async function updateFolderInheritance(
  folderId: string,
  inheritPermissions: boolean,
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    await assertFolderPermission(actor, folderId, "MANAGE_PERMISSIONS", tx);
    const current = await tx.folder.findUnique({
      where: { id: folderId },
      select: { id: true, inheritPermissions: true },
    });
    if (!current)
      throw new AppError("NOT_FOUND", "Không tìm thấy thư mục", 404);

    const folder = await tx.folder.update({
      where: { id: folderId },
      data: { inheritPermissions },
      select: { id: true, inheritPermissions: true },
    });

    if (current.inheritPermissions !== inheritPermissions) {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "FOLDER_PERMISSION_INHERITANCE_UPDATED",
          entityType: "FOLDER",
          entityId: folderId,
          folderId,
          metadata: {
            before: { inheritPermissions: current.inheritPermissions },
            after: { inheritPermissions },
          },
        },
      });
    }

    return { data: folder };
  });
}
