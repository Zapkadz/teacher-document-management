import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  type PermissionActor,
  assertFolderPermission,
} from "@/modules/permissions/permission.engine";

import { getMaxFolderDepth } from "./folder-topology";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type LockRow = {
  id: string;
  name: string;
  isLocked: boolean;
  lockDescendants: boolean;
  depth: number;
};

export type EffectiveFolderLock = {
  isLocked: boolean;
  isDirectlyLocked: boolean;
  sourceFolderId: string | null;
  sourceFolderName: string | null;
};

export async function acquireFolderMutationLock(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext('folder-content-mutations'))
  `;
}

export async function getEffectiveFolderLock(
  folderId: string,
  database: DatabaseClient = getPrismaClient(),
): Promise<EffectiveFolderLock> {
  const rows = await database.$queryRaw<LockRow[]>`
    WITH RECURSIVE ancestors AS (
      SELECT
        id,
        name,
        parent_id,
        is_locked,
        lock_descendants,
        0 AS depth
      FROM folders
      WHERE id = ${folderId}::uuid

      UNION ALL

      SELECT
        parent.id,
        parent.name,
        parent.parent_id,
        parent.is_locked,
        parent.lock_descendants,
        ancestors.depth + 1
      FROM folders parent
      INNER JOIN ancestors ON ancestors.parent_id = parent.id
      WHERE ancestors.depth < ${getMaxFolderDepth()}
    )
    SELECT
      id,
      name,
      is_locked AS "isLocked",
      lock_descendants AS "lockDescendants",
      depth
    FROM ancestors
    ORDER BY depth
  `;

  const current = rows[0];
  if (!current) {
    throw new AppError("NOT_FOUND", "Không tìm thấy thư mục", 404);
  }

  const source = rows.find(
    (row) => row.isLocked && (row.depth === 0 || row.lockDescendants),
  );

  return {
    isLocked: source !== undefined,
    isDirectlyLocked: current.isLocked,
    sourceFolderId: source?.id ?? null,
    sourceFolderName: source?.name ?? null,
  };
}

export async function assertFolderUnlockedForMutation(
  actor: PermissionActor,
  folderId: string,
  database: DatabaseClient = getPrismaClient(),
): Promise<EffectiveFolderLock> {
  if (actor.globalRole === "ADMIN") {
    return {
      isLocked: false,
      isDirectlyLocked: false,
      sourceFolderId: null,
      sourceFolderName: null,
    };
  }

  const lock = await getEffectiveFolderLock(folderId, database);
  if (lock.isLocked) {
    throw new AppError(
      "FOLDER_LOCKED",
      `Thư mục đang bị khóa${lock.sourceFolderName ? ` bởi “${lock.sourceFolderName}”` : ""}`,
      423,
      { sourceFolderId: lock.sourceFolderId },
    );
  }
  return lock;
}

export async function assertFolderSubtreeUnlockedForMutation(
  actor: PermissionActor,
  folderId: string,
  database: DatabaseClient = getPrismaClient(),
): Promise<void> {
  if (actor.globalRole === "ADMIN") return;

  await assertFolderUnlockedForMutation(actor, folderId, database);
  const locked = await database.$queryRaw<Array<{ id: string; name: string }>>`
    WITH RECURSIVE subtree AS (
      SELECT id, name
      FROM folders
      WHERE id = ${folderId}::uuid AND deleted_at IS NULL

      UNION ALL

      SELECT child.id, child.name
      FROM folders child
      INNER JOIN subtree ON child.parent_id = subtree.id
      WHERE child.deleted_at IS NULL
    )
    SELECT folder.id, folder.name
    FROM subtree
    INNER JOIN folders folder USING (id)
    WHERE folder.is_locked = true
    LIMIT 1
  `;

  if (locked[0]) {
    throw new AppError(
      "FOLDER_LOCKED",
      `Nhánh thư mục chứa thư mục đang khóa “${locked[0].name}”`,
      423,
      { sourceFolderId: locked[0].id },
    );
  }
}

export async function setFolderLock(
  folderId: string,
  input: { locked: boolean; applyToDescendants: boolean },
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    await acquireFolderMutationLock(tx);
    const folder = await tx.folder.findFirst({
      where: { id: folderId, deletedAt: null },
      select: {
        id: true,
        name: true,
        isLocked: true,
        lockDescendants: true,
      },
    });
    if (!folder) {
      throw new AppError("NOT_FOUND", "Không tìm thấy thư mục", 404);
    }

    await assertFolderPermission(actor, folder.id, "LOCK_FOLDER", tx);
    const lockDescendants = input.locked && input.applyToDescendants;
    const updated = await tx.folder.update({
      where: { id: folder.id },
      data: {
        isLocked: input.locked,
        lockDescendants,
      },
      select: {
        id: true,
        name: true,
        isLocked: true,
        lockDescendants: true,
      },
    });

    if (
      folder.isLocked !== updated.isLocked ||
      folder.lockDescendants !== updated.lockDescendants
    ) {
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: updated.isLocked ? "FOLDER_LOCKED" : "FOLDER_UNLOCKED",
          entityType: "FOLDER",
          entityId: folder.id,
          folderId: folder.id,
          metadata: {
            before: {
              isLocked: folder.isLocked,
              lockDescendants: folder.lockDescendants,
            },
            after: {
              isLocked: updated.isLocked,
              lockDescendants: updated.lockDescendants,
            },
          },
        },
      });
    }

    return { data: updated };
  });
}
