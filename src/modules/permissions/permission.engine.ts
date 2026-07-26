import {
  Prisma,
  type GlobalRole,
  type PrismaClient,
  type WorkspaceType,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { getMaxFolderDepth } from "@/modules/folders/folder-topology";

import {
  PERMISSIONS,
  PERSONAL_OWNER_PERMISSIONS,
  type Permission,
  isPermission,
} from "./permission.constants";

export type PermissionActor = {
  id: string;
  globalRole: GlobalRole;
};

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type AncestorRow = {
  targetId: string;
  id: string;
  name: string;
  parentId: string | null;
  workspaceType: WorkspaceType;
  ownerUserId: string | null;
  inheritPermissions: boolean;
  depth: number;
};

export type EffectivePermissionSource = {
  kind: "ADMIN" | "OWNERSHIP" | "DIRECT" | "INHERITED";
  folderId: string;
  folderName: string;
  permissionId: string | null;
  principalType: "USER" | "GROUP" | null;
  principalId: string | null;
  principalName: string | null;
  permissions: Permission[];
};

export type EffectivePermissionResult = {
  folderId: string;
  permissions: Permission[];
  sources: EffectivePermissionSource[];
};

function parsePermissions(value: Prisma.JsonValue): Permission[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPermission);
}

function uniqueFolderIds(folderIds: readonly string[]): string[] {
  return [...new Set(folderIds)];
}

export async function getEffectivePermissionsForFolders(
  actor: PermissionActor,
  folderIds: readonly string[],
  database: DatabaseClient = getPrismaClient(),
): Promise<Map<string, EffectivePermissionResult>> {
  const targets = uniqueFolderIds(folderIds);
  const results = new Map<string, EffectivePermissionResult>();

  if (targets.length === 0) return results;
  const maxDepth = getMaxFolderDepth();

  const ancestors = await database.$queryRaw<AncestorRow[]>(Prisma.sql`
    WITH RECURSIVE ancestors AS (
      SELECT
        folder.id AS target_id,
        folder.id,
        folder.name,
        folder.parent_id,
        folder.workspace_type,
        folder.owner_user_id,
        folder.inherit_permissions,
        0 AS depth
      FROM folders folder
      WHERE folder.id IN (${Prisma.join(targets.map((id) => Prisma.sql`${id}::uuid`))})

      UNION ALL

      SELECT
        ancestors.target_id,
        parent.id,
        parent.name,
        parent.parent_id,
        parent.workspace_type,
        parent.owner_user_id,
        parent.inherit_permissions,
        ancestors.depth + 1
      FROM folders parent
      INNER JOIN ancestors ON ancestors.parent_id = parent.id
      WHERE ancestors.depth < ${maxDepth}
    )
    SELECT
      target_id AS "targetId",
      id,
      name,
      parent_id AS "parentId",
      workspace_type AS "workspaceType",
      owner_user_id AS "ownerUserId",
      inherit_permissions AS "inheritPermissions",
      depth
    FROM ancestors
    ORDER BY target_id, depth
  `);

  const rowsByTarget = new Map<string, AncestorRow[]>();
  for (const row of ancestors) {
    const rows = rowsByTarget.get(row.targetId) ?? [];
    rows.push(row);
    rowsByTarget.set(row.targetId, rows);
  }

  if (actor.globalRole === "ADMIN") {
    for (const targetId of targets) {
      const target = rowsByTarget.get(targetId)?.[0];
      if (!target) continue;
      results.set(targetId, {
        folderId: targetId,
        permissions: [...PERMISSIONS],
        sources: [
          {
            kind: "ADMIN",
            folderId: targetId,
            folderName: target.name,
            permissionId: null,
            principalType: null,
            principalId: actor.id,
            principalName: null,
            permissions: [...PERMISSIONS],
          },
        ],
      });
    }
    return results;
  }

  const groupMemberships = await database.groupMember.findMany({
    where: { userId: actor.id },
    select: { groupId: true },
  });
  const groupIds = groupMemberships.map(({ groupId }) => groupId);
  const relevantFolderIds = uniqueFolderIds(ancestors.map(({ id }) => id));
  const grants =
    relevantFolderIds.length === 0
      ? []
      : await database.folderPermission.findMany({
          where: {
            folderId: { in: relevantFolderIds },
            OR: [
              { principalType: "USER", userId: actor.id },
              ...(groupIds.length > 0
                ? [{ principalType: "GROUP", groupId: { in: groupIds } }]
                : []),
            ],
          },
          select: {
            id: true,
            folderId: true,
            principalType: true,
            userId: true,
            groupId: true,
            permissions: true,
            appliesToDescendants: true,
            user: { select: { name: true, email: true } },
            group: { select: { name: true } },
          },
        });

  const grantsByFolder = new Map<string, typeof grants>();
  for (const grant of grants) {
    const items = grantsByFolder.get(grant.folderId) ?? [];
    items.push(grant);
    grantsByFolder.set(grant.folderId, items);
  }

  for (const targetId of targets) {
    const path = rowsByTarget.get(targetId);
    const target = path?.[0];
    if (!path || !target) continue;

    const permissionSet = new Set<Permission>();
    const sources: EffectivePermissionSource[] = [];

    if (
      target.workspaceType === "PERSONAL" &&
      target.ownerUserId === actor.id
    ) {
      for (const permission of PERSONAL_OWNER_PERMISSIONS) {
        permissionSet.add(permission);
      }
      sources.push({
        kind: "OWNERSHIP",
        folderId: target.id,
        folderName: target.name,
        permissionId: null,
        principalType: "USER",
        principalId: actor.id,
        principalName: null,
        permissions: [...PERSONAL_OWNER_PERMISSIONS],
      });
    }

    let canContinueUpward = true;
    for (const folder of path) {
      if (folder.depth > 0 && !canContinueUpward) break;

      for (const grant of grantsByFolder.get(folder.id) ?? []) {
        if (folder.depth > 0 && !grant.appliesToDescendants) continue;
        const parsed = parsePermissions(grant.permissions);
        for (const permission of parsed) permissionSet.add(permission);
        sources.push({
          kind: folder.depth === 0 ? "DIRECT" : "INHERITED",
          folderId: folder.id,
          folderName: folder.name,
          permissionId: grant.id,
          principalType: grant.principalType === "GROUP" ? "GROUP" : "USER",
          principalId: grant.userId ?? grant.groupId,
          principalName:
            grant.principalType === "GROUP"
              ? (grant.group?.name ?? null)
              : (grant.user?.name ?? grant.user?.email ?? null),
          permissions: parsed,
        });
      }

      canContinueUpward = folder.inheritPermissions;
    }

    results.set(targetId, {
      folderId: targetId,
      permissions: PERMISSIONS.filter((permission) =>
        permissionSet.has(permission),
      ),
      sources,
    });
  }

  return results;
}

export async function getEffectivePermissions(
  actor: PermissionActor,
  folderId: string,
  database: DatabaseClient = getPrismaClient(),
): Promise<EffectivePermissionResult> {
  const result = (
    await getEffectivePermissionsForFolders(actor, [folderId], database)
  ).get(folderId);

  if (!result) {
    throw new AppError("NOT_FOUND", "Không tìm thấy thư mục", 404);
  }

  return result;
}

export async function assertFolderPermission(
  actor: PermissionActor,
  folderId: string,
  required: Permission,
  database: DatabaseClient = getPrismaClient(),
): Promise<EffectivePermissionResult> {
  const result = await getEffectivePermissions(actor, folderId, database);
  if (!result.permissions.includes(required)) {
    throw new AppError(
      "FORBIDDEN",
      "Bạn không có quyền thực hiện thao tác này trên thư mục",
      403,
    );
  }
  return result;
}
