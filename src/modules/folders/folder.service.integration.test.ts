import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { createUser } from "@/modules/users/user.service";

import {
  createFolder,
  getFolderDetails,
  getFolderTree,
  moveFolder,
  restoreFolder,
  softDeleteFolder,
} from "./folder.service";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)("folder service with PostgreSQL", () => {
  const suffix = randomUUID();
  const createdUserIds: string[] = [];
  let ownerId: string;
  let otherUserId: string;
  let rootId: string;

  beforeAll(async () => {
    const owner = await createUser(
      {
        email: `folder-owner-${suffix}@example.com`,
        fullName: "Folder Owner",
        globalRole: "USER",
        status: "ACTIVE",
      },
      null,
    );
    const other = await createUser(
      {
        email: `folder-other-${suffix}@example.com`,
        fullName: "Other User",
        globalRole: "USER",
        status: "ACTIVE",
      },
      null,
    );

    ownerId = owner.id;
    otherUserId = other.id;
    rootId = owner.personalWorkspace!.rootFolderId;
    createdUserIds.push(ownerId, otherUserId);
  });

  afterAll(async () => {
    const prisma = getPrismaClient();
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorUserId: { in: createdUserIds } },
          { entityId: { in: createdUserIds } },
        ],
      },
    });
    await prisma.personalWorkspace.deleteMany({
      where: { ownerUserId: { in: createdUserIds } },
    });
    await prisma.folder.deleteMany({
      where: { ownerUserId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  });

  it("moves folders, rejects descendant cycles, and restores a deleted branch", async () => {
    const actor = { id: ownerId, globalRole: "USER" as const };
    const folderA = await createFolder(
      { name: "A", parentId: rootId, workspaceType: "PERSONAL" },
      actor,
    );
    const folderB = await createFolder(
      { name: "B", parentId: rootId, workspaceType: "PERSONAL" },
      actor,
    );
    const child = await createFolder(
      {
        name: "Child",
        parentId: folderA.data.id,
        workspaceType: "PERSONAL",
      },
      actor,
    );

    await moveFolder(child.data.id, { targetParentId: folderB.data.id }, actor);
    expect((await getFolderDetails(child.data.id, actor)).data.parentId).toBe(
      folderB.data.id,
    );

    const descendant = await createFolder(
      {
        name: "Descendant",
        parentId: folderA.data.id,
        workspaceType: "PERSONAL",
      },
      actor,
    );
    await expect(
      moveFolder(
        folderA.data.id,
        { targetParentId: descendant.data.id },
        actor,
      ),
    ).rejects.toMatchObject({ code: "INVALID_MOVE" });

    const deleted = await softDeleteFolder(folderA.data.id, actor);
    expect(deleted.data.affectedFolders).toBe(2);
    const activeRootChildren = await getFolderTree(actor, {
      workspace: "PERSONAL",
      rootId,
      deleted: false,
    });
    expect(activeRootChildren.data.map((folder) => folder.id)).not.toContain(
      folderA.data.id,
    );

    const trash = await getFolderTree(actor, {
      workspace: "PERSONAL",
      deleted: true,
    });
    expect(trash.data.map((folder) => folder.id)).toContain(folderA.data.id);

    const restored = await restoreFolder(folderA.data.id, actor);
    expect(restored.data.restoredFolders).toBe(2);
    expect(
      (await getFolderDetails(descendant.data.id, actor)).data.deletedAt,
    ).toBeNull();
  });

  it("returns 403 for direct access to another personal workspace", async () => {
    await expect(
      getFolderTree(
        { id: otherUserId, globalRole: "USER" },
        {
          workspace: "PERSONAL",
          ownerUserId: ownerId,
          deleted: false,
        },
      ),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      getFolderDetails(rootId, {
        id: otherUserId,
        globalRole: "USER",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
