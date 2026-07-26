import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  type PermissionActor,
  assertFolderPermission,
  getEffectivePermissionsForFolders,
} from "@/modules/permissions/permission.engine";

import type { ListAuditLogsQuery } from "./audit.validation";

const auditLogSelect = {
  id: true,
  actorUserId: true,
  action: true,
  entityType: true,
  entityId: true,
  folderId: true,
  metadata: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.AuditLogSelect;

type AuditLogRecord = Prisma.AuditLogGetPayload<{
  select: typeof auditLogSelect;
}>;

function createAuditWhere(
  query: ListAuditLogsQuery,
): Prisma.AuditLogWhereInput {
  return {
    folderId: query.folderId,
    actorUserId: query.actorUserId,
    action: query.action,
    entityType: query.entityType,
    createdAt: {
      gte: query.from,
      lte: query.to,
    },
  };
}

async function attachFolderNames(logs: AuditLogRecord[]) {
  const folderIds = [
    ...new Set(
      logs.flatMap(({ folderId }) => (folderId === null ? [] : [folderId])),
    ),
  ];
  const folders = await getPrismaClient().folder.findMany({
    where: { id: { in: folderIds } },
    select: { id: true, name: true },
  });
  const folderNames = new Map(
    folders.map(({ id, name }) => [id, name] as const),
  );

  return logs.map((log) => ({
    ...log,
    folderName: log.folderId ? (folderNames.get(log.folderId) ?? null) : null,
  }));
}

async function paginateAuthorizedQuery(
  where: Prisma.AuditLogWhereInput,
  query: ListAuditLogsQuery,
) {
  const prisma = getPrismaClient();
  const skip = (query.page - 1) * query.limit;
  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      select: auditLogSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: await attachFolderNames(logs),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function listAuditLogs(
  query: ListAuditLogsQuery,
  actor: PermissionActor,
) {
  const where = createAuditWhere(query);

  if (actor.globalRole === "ADMIN" || query.actorUserId === actor.id) {
    return paginateAuthorizedQuery(where, query);
  }

  if (query.folderId) {
    await assertFolderPermission(actor, query.folderId, "VIEW_AUDIT");
    return paginateAuthorizedQuery(where, query);
  }

  const prisma = getPrismaClient();
  const candidates = await prisma.auditLog.findMany({
    where,
    select: auditLogSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const folderIds = [
    ...new Set(
      candidates.flatMap(({ folderId }) =>
        folderId === null ? [] : [folderId],
      ),
    ),
  ];
  const permissions = await getEffectivePermissionsForFolders(
    actor,
    folderIds,
    prisma,
  );
  const visible = candidates.filter(
    (log) =>
      log.actorUserId === actor.id ||
      (log.folderId !== null &&
        permissions.get(log.folderId)?.permissions.includes("VIEW_AUDIT") ===
          true),
  );
  const skip = (query.page - 1) * query.limit;

  return {
    data: await attachFolderNames(visible.slice(skip, skip + query.limit)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: visible.length,
      totalPages: Math.ceil(visible.length / query.limit),
    },
  };
}
