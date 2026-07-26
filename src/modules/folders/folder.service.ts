import { randomUUID } from "node:crypto";

import type {
  Folder,
  Prisma,
  PrismaClient,
  WorkspaceType,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { Permission } from "@/modules/permissions/permission.constants";
import {
  assertFolderPermission,
  getEffectivePermissions,
  getEffectivePermissionsForFolders,
} from "@/modules/permissions/permission.engine";

import type { FolderActor } from "./folder.policy";
import {
  acquireFolderMutationLock,
  assertFolderSubtreeUnlockedForMutation,
  assertFolderUnlockedForMutation,
  getEffectiveFolderLock,
} from "./folder-lock.service";
import { assertValidMoveTopology, getMaxFolderDepth } from "./folder-topology";
import type {
  CreateFolderInput,
  FolderTreeQuery,
  MoveFolderInput,
} from "./folder.validation";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const folderSelect = {
  id: true,
  name: true,
  parentId: true,
  workspaceType: true,
  ownerUserId: true,
  inheritPermissions: true,
  isLocked: true,
  lockDescendants: true,
  sortOrder: true,
  createdBy: true,
  deletedAt: true,
  deletedBy: true,
  deletionBatchId: true,
  createdAt: true,
  updatedAt: true,
  personalWorkspace: { select: { id: true } },
} satisfies Prisma.FolderSelect;

type FolderRecord = Prisma.FolderGetPayload<{ select: typeof folderSelect }>;

const treeNodeSelect = {
  ...folderSelect,
  _count: {
    select: {
      children: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.FolderSelect;

type TreeNodeRecord = Prisma.FolderGetPayload<{
  select: typeof treeNodeSelect;
}>;

type PathRow = Pick<
  Folder,
  "id" | "name" | "parentId" | "workspaceType" | "ownerUserId"
> & {
  depth: number;
};

function isSystemRoot(folder: FolderRecord): boolean {
  return (
    folder.personalWorkspace !== null ||
    (folder.workspaceType === "SHARED" && folder.parentId === null)
  );
}

function assertMutableFolder(folder: FolderRecord): void {
  if (isSystemRoot(folder)) {
    throw new AppError(
      "SYSTEM_ROOT_IMMUTABLE",
      "Không thể thay đổi thư mục gốc của hệ thống",
      409,
    );
  }
}

function toTreeNode(folder: TreeNodeRecord, hasChildren?: boolean) {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    workspaceType: folder.workspaceType,
    ownerUserId: folder.ownerUserId,
    isLocked: folder.isLocked,
    sortOrder: folder.sortOrder,
    deletedAt: folder.deletedAt,
    hasChildren: hasChildren ?? folder._count.children > 0,
    isSystemRoot: isSystemRoot(folder),
  };
}

async function toVisibleTreeNodes(
  actor: FolderActor,
  folders: TreeNodeRecord[],
  database: DatabaseClient = getPrismaClient(),
) {
  if (folders.length === 0) return [];

  const permissions = await getEffectivePermissionsForFolders(
    actor,
    folders.map(({ id }) => id),
    database,
  );
  const visible = folders.filter((folder) =>
    permissions.get(folder.id)?.permissions.includes("VIEW"),
  );
  const children = await database.folder.findMany({
    where: {
      parentId: { in: visible.map(({ id }) => id) },
      deletedAt: null,
    },
    select: { id: true, parentId: true },
  });
  const childPermissions = await getEffectivePermissionsForFolders(
    actor,
    children.map(({ id }) => id),
    database,
  );
  const parentsWithVisibleChildren = new Set(
    children
      .filter((child) =>
        childPermissions.get(child.id)?.permissions.includes("VIEW"),
      )
      .map(({ parentId }) => parentId),
  );

  return visible.map((folder) =>
    toTreeNode(folder, parentsWithVisibleChildren.has(folder.id)),
  );
}

async function findFolderForAccess(
  database: DatabaseClient,
  id: string,
  actor: FolderActor,
  includeDeleted = false,
  requiredPermission: Permission = "VIEW",
): Promise<FolderRecord> {
  const folder = await database.folder.findUnique({
    where: { id },
    select: folderSelect,
  });

  if (!folder || (!includeDeleted && folder.deletedAt !== null)) {
    throw new AppError("NOT_FOUND", "Không tìm thấy thư mục", 404);
  }

  await assertFolderPermission(actor, folder.id, requiredPermission, database);
  return folder;
}

async function getFolderPath(
  database: DatabaseClient,
  folderId: string,
): Promise<PathRow[]> {
  const maxDepth = getMaxFolderDepth();
  const path = await database.$queryRaw<PathRow[]>`
    WITH RECURSIVE ancestors AS (
      SELECT
        id,
        name,
        parent_id,
        workspace_type,
        owner_user_id,
        1 AS depth
      FROM folders
      WHERE id = ${folderId}::uuid

      UNION ALL

      SELECT
        parent.id,
        parent.name,
        parent.parent_id,
        parent.workspace_type,
        parent.owner_user_id,
        ancestors.depth + 1
      FROM folders parent
      INNER JOIN ancestors ON ancestors.parent_id = parent.id
      WHERE ancestors.depth <= ${maxDepth}
    )
    SELECT
      id,
      name,
      parent_id AS "parentId",
      workspace_type AS "workspaceType",
      owner_user_id AS "ownerUserId",
      depth
    FROM ancestors
    ORDER BY depth DESC
  `;

  if (path.length > maxDepth) {
    throw new AppError(
      "MAX_FOLDER_DEPTH_EXCEEDED",
      `Cây thư mục vượt quá giới hạn ${maxDepth} cấp`,
      409,
    );
  }

  return path;
}

async function getSubtreeHeight(
  database: DatabaseClient,
  folderId: string,
): Promise<number> {
  const result = await database.$queryRaw<Array<{ height: number }>>`
    WITH RECURSIVE descendants AS (
      SELECT id, 1 AS depth
      FROM folders
      WHERE id = ${folderId}::uuid AND deleted_at IS NULL

      UNION ALL

      SELECT child.id, descendants.depth + 1
      FROM folders child
      INNER JOIN descendants ON child.parent_id = descendants.id
      WHERE child.deleted_at IS NULL
    )
    SELECT COALESCE(MAX(depth), 1)::int AS height
    FROM descendants
  `;

  return result[0]?.height ?? 1;
}

async function assertNameAvailable(
  database: DatabaseClient,
  parentId: string,
  name: string,
  excludedId?: string,
): Promise<void> {
  const duplicate = await database.folder.findFirst({
    where: {
      parentId,
      deletedAt: null,
      name: { equals: name, mode: "insensitive" },
      id: excludedId ? { not: excludedId } : undefined,
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppError(
      "FOLDER_NAME_CONFLICT",
      "Đã có thư mục cùng tên tại vị trí này",
      409,
    );
  }
}

function assertSameWorkspace(
  source: Pick<Folder, "workspaceType" | "ownerUserId">,
  target: Pick<Folder, "workspaceType" | "ownerUserId">,
): void {
  if (
    source.workspaceType !== target.workspaceType ||
    source.ownerUserId !== target.ownerUserId
  ) {
    throw new AppError(
      "INVALID_MOVE",
      "Không thể di chuyển thư mục sang workspace khác",
      409,
    );
  }
}

async function acquireTopologyLock(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext('folder-tree-topology'))
  `;
}

async function getWorkspaceRoot(
  actor: FolderActor,
  workspaceType: WorkspaceType,
  ownerUserId?: string,
): Promise<TreeNodeRecord | null> {
  const prisma = getPrismaClient();

  if (workspaceType === "PERSONAL") {
    const ownerId = ownerUserId ?? actor.id;

    const workspace = await prisma.personalWorkspace.findUnique({
      where: { ownerUserId: ownerId },
      select: {
        rootFolder: { select: treeNodeSelect },
      },
    });

    if (!workspace) {
      throw new AppError(
        "PERSONAL_WORKSPACE_NOT_FOUND",
        "Không tìm thấy kho cá nhân",
        404,
      );
    }

    await assertFolderPermission(
      actor,
      workspace.rootFolder.id,
      "VIEW",
      prisma,
    );
    return workspace.rootFolder;
  }

  const root = await prisma.folder.findFirst({
    where: {
      workspaceType: "SHARED",
      parentId: null,
      deletedAt: null,
    },
    select: treeNodeSelect,
  });

  if (!root) return null;
  const effective = await getEffectivePermissions(actor, root.id, prisma);
  return effective.permissions.includes("VIEW") ? root : null;
}

async function listDeletedRoots(actor: FolderActor, query: FolderTreeQuery) {
  const prisma = getPrismaClient();
  const ownerUserId =
    query.workspace === "PERSONAL" ? (query.ownerUserId ?? actor.id) : null;

  if (query.workspace === "PERSONAL") {
    const workspace = await prisma.personalWorkspace.findUnique({
      where: { ownerUserId: ownerUserId! },
      select: { rootFolderId: true },
    });
    if (!workspace) {
      throw new AppError(
        "PERSONAL_WORKSPACE_NOT_FOUND",
        "Không tìm thấy kho cá nhân",
        404,
      );
    }
    await assertFolderPermission(actor, workspace.rootFolderId, "VIEW", prisma);
  }

  const folders = await prisma.folder.findMany({
    where: {
      workspaceType: query.workspace,
      ownerUserId,
      deletedAt: { not: null },
      OR: [{ parentId: null }, { parent: { deletedAt: null } }],
    },
    select: treeNodeSelect,
    orderBy: [{ deletedAt: "desc" }, { name: "asc" }],
  });

  const permissions = await getEffectivePermissionsForFolders(
    actor,
    folders.map(({ id }) => id),
    prisma,
  );

  return folders
    .filter((folder) =>
      permissions.get(folder.id)?.permissions.includes("RESTORE"),
    )
    .map((folder) => toTreeNode(folder));
}

export async function getFolderTree(
  actor: FolderActor,
  query: FolderTreeQuery,
) {
  if (query.deleted) {
    if (query.rootId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Không dùng rootId khi xem thư mục đã xóa",
        400,
      );
    }

    return { data: await listDeletedRoots(actor, query) };
  }

  const root = await getWorkspaceRoot(
    actor,
    query.workspace,
    query.ownerUserId,
  );

  if (!root) {
    return { data: [] };
  }

  if (!query.rootId) {
    return { data: await toVisibleTreeNodes(actor, [root]) };
  }

  const parent = await findFolderForAccess(
    getPrismaClient(),
    query.rootId,
    actor,
  );

  if (
    parent.workspaceType !== query.workspace ||
    (query.workspace === "PERSONAL" && parent.ownerUserId !== root.ownerUserId)
  ) {
    throw new AppError(
      "FORBIDDEN",
      "Thư mục không thuộc workspace đã chọn",
      403,
    );
  }

  const children = await getPrismaClient().folder.findMany({
    where: {
      parentId: parent.id,
      deletedAt: null,
    },
    select: treeNodeSelect,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return { data: await toVisibleTreeNodes(actor, children) };
}

export async function getFolderDetails(id: string, actor: FolderActor) {
  const prisma = getPrismaClient();
  const folder = await findFolderForAccess(prisma, id, actor, true);
  const breadcrumbs = await getFolderPath(prisma, id);
  const [effective, breadcrumbPermissions, effectiveLock] = await Promise.all([
    getEffectivePermissions(actor, id, prisma),
    getEffectivePermissionsForFolders(
      actor,
      breadcrumbs.map((folder) => folder.id),
      prisma,
    ),
    getEffectiveFolderLock(id, prisma),
  ]);
  const has = (permission: Permission) =>
    effective.permissions.includes(permission);
  const ownsFolder = folder.createdBy === actor.id;
  const mutationLocked = actor.globalRole !== "ADMIN" && effectiveLock.isLocked;

  return {
    data: {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      workspaceType: folder.workspaceType,
      ownerUserId: folder.ownerUserId,
      inheritPermissions: folder.inheritPermissions,
      isLocked: folder.isLocked,
      lockDescendants: folder.lockDescendants,
      effectiveLock,
      sortOrder: folder.sortOrder,
      createdBy: folder.createdBy,
      deletedAt: folder.deletedAt,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      isSystemRoot: isSystemRoot(folder),
      breadcrumbs: breadcrumbs
        .filter((item) =>
          breadcrumbPermissions.get(item.id)?.permissions.includes("VIEW"),
        )
        .map(({ id: pathId, name }) => ({
          id: pathId,
          name,
        })),
      capabilities: {
        canUpload:
          folder.deletedAt === null && !mutationLocked && has("UPLOAD"),
        canCreateSubfolder:
          folder.deletedAt === null &&
          !mutationLocked &&
          has("CREATE_SUBFOLDER"),
        canRename:
          folder.deletedAt === null &&
          !mutationLocked &&
          !isSystemRoot(folder) &&
          (has("EDIT_ANY") || (ownsFolder && has("EDIT_OWN"))),
        canMove:
          folder.deletedAt === null &&
          !mutationLocked &&
          !isSystemRoot(folder) &&
          (has("MOVE_ANY") || (ownsFolder && has("MOVE_OWN"))),
        canDelete:
          folder.deletedAt === null &&
          !mutationLocked &&
          !isSystemRoot(folder) &&
          (has("DELETE_ANY") || (ownsFolder && has("DELETE_OWN"))),
        canRestore:
          folder.deletedAt !== null && !isSystemRoot(folder) && has("RESTORE"),
        canManagePermissions: has("MANAGE_PERMISSIONS"),
        canLockFolder: folder.deletedAt === null && has("LOCK_FOLDER"),
      },
    },
  };
}

export async function createFolder(
  input: CreateFolderInput,
  actor: FolderActor,
) {
  const prisma = getPrismaClient();

  try {
    return await prisma.$transaction(async (tx) => {
      await acquireTopologyLock(tx);
      await acquireFolderMutationLock(tx);
      const parent = await findFolderForAccess(
        tx,
        input.parentId,
        actor,
        false,
        "CREATE_SUBFOLDER",
      );
      await assertFolderUnlockedForMutation(actor, parent.id, tx);

      if (parent.workspaceType !== input.workspaceType) {
        throw new AppError(
          "WORKSPACE_MISMATCH",
          "Loại workspace không khớp với thư mục cha",
          409,
        );
      }

      const path = await getFolderPath(tx, parent.id);
      const maxDepth = getMaxFolderDepth();

      if (path.length + 1 > maxDepth) {
        throw new AppError(
          "MAX_FOLDER_DEPTH_EXCEEDED",
          `Cây thư mục không được vượt quá ${maxDepth} cấp`,
          409,
        );
      }

      await assertNameAvailable(tx, parent.id, input.name);

      const lastSibling = await tx.folder.aggregate({
        where: { parentId: parent.id, deletedAt: null },
        _max: { sortOrder: true },
      });

      const folder = await tx.folder.create({
        data: {
          name: input.name,
          parentId: parent.id,
          workspaceType: parent.workspaceType,
          ownerUserId: parent.ownerUserId,
          sortOrder: (lastSibling._max.sortOrder ?? -1) + 1,
          createdBy: actor.id,
        },
        select: folderSelect,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "FOLDER_CREATED",
          entityType: "FOLDER",
          entityId: folder.id,
          folderId: folder.id,
          metadata: {
            name: folder.name,
            parentId: parent.id,
            workspaceType: folder.workspaceType,
          },
        },
      });

      return { data: folder };
    });
  } catch (error) {
    handleFolderConflict(error);
  }
}

export async function renameFolder(
  id: string,
  name: string,
  actor: FolderActor,
) {
  const prisma = getPrismaClient();

  try {
    return await prisma.$transaction(async (tx) => {
      await acquireFolderMutationLock(tx);
      const current = await findFolderForAccess(tx, id, actor);
      await assertFolderPermission(
        actor,
        current.id,
        current.createdBy === actor.id ? "EDIT_OWN" : "EDIT_ANY",
        tx,
      );
      await assertFolderUnlockedForMutation(actor, current.id, tx);
      assertMutableFolder(current);
      await assertNameAvailable(tx, current.parentId!, name, current.id);

      const folder = await tx.folder.update({
        where: { id },
        data: { name },
        select: folderSelect,
      });

      if (current.name !== name) {
        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: "FOLDER_RENAMED",
            entityType: "FOLDER",
            entityId: id,
            folderId: id,
            metadata: {
              before: { name: current.name },
              after: { name },
            },
          },
        });
      }

      return { data: folder };
    });
  } catch (error) {
    handleFolderConflict(error);
  }
}

export async function moveFolder(
  id: string,
  input: MoveFolderInput,
  actor: FolderActor,
) {
  const prisma = getPrismaClient();

  try {
    return await prisma.$transaction(async (tx) => {
      await acquireTopologyLock(tx);
      await acquireFolderMutationLock(tx);
      const source = await findFolderForAccess(tx, id, actor);
      await assertFolderPermission(
        actor,
        source.id,
        source.createdBy === actor.id ? "MOVE_OWN" : "MOVE_ANY",
        tx,
      );
      await assertFolderSubtreeUnlockedForMutation(actor, source.id, tx);
      assertMutableFolder(source);
      const target = await findFolderForAccess(
        tx,
        input.targetParentId,
        actor,
        false,
        "CREATE_SUBFOLDER",
      );
      await assertFolderUnlockedForMutation(actor, target.id, tx);
      assertSameWorkspace(source, target);

      const targetPath = await getFolderPath(tx, target.id);
      const subtreeHeight = await getSubtreeHeight(tx, source.id);
      assertValidMoveTopology({
        sourceId: source.id,
        targetParentId: target.id,
        targetAncestorIds: targetPath.map((folder) => folder.id),
        targetDepth: targetPath.length,
        subtreeHeight,
        maxDepth: getMaxFolderDepth(),
      });

      await assertNameAvailable(tx, target.id, source.name, source.id);

      if (source.parentId === target.id) {
        return { data: source };
      }

      const lastSibling = await tx.folder.aggregate({
        where: { parentId: target.id, deletedAt: null },
        _max: { sortOrder: true },
      });

      const folder = await tx.folder.update({
        where: { id },
        data: {
          parentId: target.id,
          sortOrder: (lastSibling._max.sortOrder ?? -1) + 1,
        },
        select: folderSelect,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "FOLDER_MOVED",
          entityType: "FOLDER",
          entityId: id,
          folderId: id,
          metadata: {
            fromParentId: source.parentId,
            toParentId: target.id,
          },
        },
      });

      return { data: folder };
    });
  } catch (error) {
    handleFolderConflict(error);
  }
}

export async function softDeleteFolder(id: string, actor: FolderActor) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    await acquireTopologyLock(tx);
    await acquireFolderMutationLock(tx);
    const folder = await findFolderForAccess(tx, id, actor);
    await assertFolderPermission(
      actor,
      folder.id,
      folder.createdBy === actor.id ? "DELETE_OWN" : "DELETE_ANY",
      tx,
    );
    await assertFolderSubtreeUnlockedForMutation(actor, folder.id, tx);
    assertMutableFolder(folder);
    const deletionBatchId = randomUUID();
    const deletedAt = new Date();
    const descendants = await tx.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE subtree AS (
        SELECT id
        FROM folders
        WHERE id = ${id}::uuid AND deleted_at IS NULL

        UNION ALL

        SELECT child.id
        FROM folders child
        INNER JOIN subtree ON child.parent_id = subtree.id
        WHERE child.deleted_at IS NULL
      )
      SELECT id FROM subtree
    `;

    const ids = descendants.map((item) => item.id);
    await tx.folder.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: {
        deletedAt,
        deletedBy: actor.id,
        deletionBatchId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "FOLDER_DELETED",
        entityType: "FOLDER",
        entityId: id,
        folderId: id,
        metadata: {
          name: folder.name,
          parentId: folder.parentId,
          deletionBatchId,
          affectedFolders: ids.length,
        },
      },
    });

    return {
      data: {
        id,
        deletedAt,
        affectedFolders: ids.length,
      },
    };
  });
}

export async function restoreFolder(id: string, actor: FolderActor) {
  const prisma = getPrismaClient();

  try {
    return await prisma.$transaction(async (tx) => {
      await acquireTopologyLock(tx);
      await acquireFolderMutationLock(tx);
      const folder = await findFolderForAccess(tx, id, actor, true, "RESTORE");
      assertMutableFolder(folder);

      if (!folder.deletedAt || !folder.deletionBatchId) {
        throw new AppError("FOLDER_NOT_DELETED", "Thư mục chưa bị xóa", 409);
      }

      if (folder.parentId) {
        const parent = await tx.folder.findUnique({
          where: { id: folder.parentId },
          select: {
            id: true,
            deletedAt: true,
            deletionBatchId: true,
          },
        });

        if (!parent || parent.deletedAt !== null) {
          if (parent?.deletionBatchId === folder.deletionBatchId) {
            throw new AppError(
              "RESTORE_FROM_BATCH_ROOT",
              "Hãy khôi phục từ thư mục gốc của đợt xóa",
              409,
            );
          }

          throw new AppError(
            "FOLDER_PARENT_DELETED",
            "Thư mục cha chưa tồn tại hoặc vẫn đang bị xóa",
            409,
          );
        }

        await assertFolderUnlockedForMutation(actor, parent.id, tx);
        await assertNameAvailable(tx, parent.id, folder.name, folder.id);
      }

      const restored = await tx.folder.updateMany({
        where: { deletionBatchId: folder.deletionBatchId },
        data: {
          deletedAt: null,
          deletedBy: null,
          deletionBatchId: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "FOLDER_RESTORED",
          entityType: "FOLDER",
          entityId: id,
          folderId: id,
          metadata: {
            name: folder.name,
            restoredFolders: restored.count,
          },
        },
      });

      return {
        data: {
          id,
          restoredFolders: restored.count,
        },
      };
    });
  } catch (error) {
    handleFolderConflict(error);
  }
}

function handleFolderConflict(error: unknown): never {
  if (error instanceof AppError) {
    throw error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    throw new AppError(
      "FOLDER_NAME_CONFLICT",
      "Đã có thư mục cùng tên tại vị trí này",
      409,
    );
  }

  throw error;
}
