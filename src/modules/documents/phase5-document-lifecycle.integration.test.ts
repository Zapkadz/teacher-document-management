import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/lib/db/prisma";
import { setFolderLock } from "@/modules/folders/folder-lock.service";
import { createFolder } from "@/modules/folders/folder.service";
import { createFolderPermissions } from "@/modules/permissions/permission.service";
import { createUser } from "@/modules/users/user.service";

import {
  createLinkDocument,
  listDocuments,
  listTrash,
  moveDocument,
  purgeTrashItems,
  restoreDocument,
  softDeleteDocument,
  updateDocument,
} from "./document.service";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)(
  "Phase 5 document ownership, trash, and folder locks",
  () => {
    const suffix = randomUUID();
    const userIds: string[] = [];
    let adminId: string;
    let ownerId: string;
    let ownOnlyId: string;
    let managerId: string;
    let rootId: string;
    let targetId: string;
    let documentId: string;

    const actor = (id: string, globalRole: "ADMIN" | "USER" = "USER") => ({
      id,
      globalRole,
    });

    beforeAll(async () => {
      const admin = await createUser(
        {
          email: `phase5-admin-${suffix}@example.com`,
          fullName: "Phase 5 Admin",
          globalRole: "ADMIN",
          status: "ACTIVE",
        },
        null,
      );
      const owner = await createUser(
        {
          email: `phase5-owner-${suffix}@example.com`,
          fullName: "Phase 5 Owner",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );
      const ownOnly = await createUser(
        {
          email: `phase5-own-only-${suffix}@example.com`,
          fullName: "Own only",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );
      const manager = await createUser(
        {
          email: `phase5-manager-${suffix}@example.com`,
          fullName: "Content manager",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );

      adminId = admin.id;
      ownerId = owner.id;
      ownOnlyId = ownOnly.id;
      managerId = manager.id;
      rootId = owner.personalWorkspace!.rootFolderId;
      userIds.push(adminId, ownerId, ownOnlyId, managerId);

      const target = await createFolder(
        {
          name: "Đích Phase 5",
          parentId: rootId,
          workspaceType: "PERSONAL",
        },
        actor(ownerId),
      );
      targetId = target.data.id;

      await createFolderPermissions(
        rootId,
        {
          principalType: "USER",
          principalIds: [ownOnlyId],
          permissions: ["VIEW", "EDIT_OWN", "MOVE_OWN", "DELETE_OWN"],
          appliesToDescendants: true,
        },
        actor(adminId, "ADMIN"),
      );
      await createFolderPermissions(
        rootId,
        {
          principalType: "USER",
          principalIds: [managerId],
          permissions: [
            "VIEW",
            "PREVIEW",
            "DOWNLOAD",
            "UPLOAD",
            "EDIT_ANY",
            "MOVE_ANY",
            "DELETE_ANY",
            "RESTORE",
            "LOCK_FOLDER",
          ],
          appliesToDescendants: true,
        },
        actor(adminId, "ADMIN"),
      );

      const document = await createLinkDocument(
        {
          folderId: rootId,
          title: "Tài liệu vòng đời",
          description: "Bản đầu",
          kind: "YOUTUBE_LINK",
          externalUrl: "https://www.youtube.com/watch?v=phase5",
        },
        actor(ownerId),
      );
      documentId = document.data.id;
    });

    afterAll(async () => {
      const prisma = getPrismaClient();
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ actorUserId: { in: userIds } }, { entityId: { in: userIds } }],
        },
      });
      await prisma.uploadSession.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.folderPermission.deleteMany({
        where: {
          OR: [{ userId: { in: userIds } }, { grantedBy: { in: userIds } }],
        },
      });
      await prisma.document.updateMany({
        where: { ownerUserId: { in: userIds } },
        data: { currentVersionId: null },
      });
      await prisma.document.deleteMany({
        where: { ownerUserId: { in: userIds } },
      });
      await prisma.personalWorkspace.deleteMany({
        where: { ownerUserId: { in: userIds } },
      });
      await prisma.folder.deleteMany({
        where: { ownerUserId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    });

    it("enforces EDIT_OWN versus EDIT_ANY and MOVE_ANY", async () => {
      await updateDocument(
        documentId,
        { title: "Chủ sở hữu đã sửa", description: "Own" },
        actor(ownerId),
      );
      await expect(
        updateDocument(
          documentId,
          { title: "Không được phép", description: "" },
          actor(ownOnlyId),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

      const updated = await updateDocument(
        documentId,
        { title: "Quản lý đã sửa", description: "Any" },
        actor(managerId),
      );
      expect(updated.data.title).toBe("Quản lý đã sửa");

      const moved = await moveDocument(
        documentId,
        { targetFolderId: targetId },
        actor(managerId),
      );
      expect(moved.data.folderId).toBe(targetId);
    });

    it("soft deletes, hides, lists in trash, restores, and audits", async () => {
      await expect(
        softDeleteDocument(documentId, actor(ownOnlyId)),
      ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

      await softDeleteDocument(documentId, actor(managerId));
      const active = await listDocuments(
        targetId,
        { page: 1, limit: 25, sort: "newest" },
        actor(managerId),
      );
      expect(active.data.map(({ id }) => id)).not.toContain(documentId);

      const trash = await listTrash(
        {
          entityType: "DOCUMENT",
          folderId: targetId,
          page: 1,
          limit: 25,
        },
        actor(managerId),
      );
      expect(trash.data.map(({ id }) => id)).toContain(documentId);

      await restoreDocument(documentId, {}, actor(managerId));
      expect(
        (
          await getPrismaClient().document.findUniqueOrThrow({
            where: { id: documentId },
            select: { deletedAt: true, deletedBy: true },
          })
        ).deletedAt,
      ).toBeNull();
      expect(
        await getPrismaClient().auditLog.count({
          where: {
            entityId: documentId,
            action: { in: ["DOCUMENT_DELETED", "DOCUMENT_RESTORED"] },
          },
        }),
      ).toBe(2);
    });

    it("blocks content mutations under a lock but keeps view and admin bypass", async () => {
      const lockedChild = await createFolder(
        {
          name: "Con bị khóa kế thừa",
          parentId: targetId,
          workspaceType: "PERSONAL",
        },
        actor(ownerId),
      );
      await setFolderLock(
        targetId,
        { locked: true, applyToDescendants: true },
        actor(managerId),
      );

      await expect(
        updateDocument(
          documentId,
          { title: "Bị khóa", description: "" },
          actor(managerId),
        ),
      ).rejects.toMatchObject({ code: "FOLDER_LOCKED", status: 423 });
      await expect(
        createLinkDocument(
          {
            folderId: lockedChild.data.id,
            title: "Link bị khóa kế thừa",
            description: "",
            kind: "YOUTUBE_LINK",
            externalUrl: "https://www.youtube.com/watch?v=inherited-lock",
          },
          actor(ownerId),
        ),
      ).rejects.toMatchObject({ code: "FOLDER_LOCKED", status: 423 });
      await expect(
        createFolder(
          {
            name: "Không thể tạo",
            parentId: targetId,
            workspaceType: "PERSONAL",
          },
          actor(ownerId),
        ),
      ).rejects.toMatchObject({ code: "FOLDER_LOCKED", status: 423 });
      await expect(
        createLinkDocument(
          {
            folderId: targetId,
            title: "Link bị chặn",
            description: "",
            kind: "GOOGLE_DRIVE_LINK",
            externalUrl: "https://drive.google.com/file/d/locked/view",
          },
          actor(ownerId),
        ),
      ).rejects.toMatchObject({ code: "FOLDER_LOCKED", status: 423 });

      const visible = await listDocuments(
        targetId,
        { page: 1, limit: 25, sort: "newest" },
        actor(managerId),
      );
      expect(visible.data.map(({ id }) => id)).toContain(documentId);
      expect(
        (
          await updateDocument(
            documentId,
            { title: "Admin bypass", description: "" },
            actor(adminId, "ADMIN"),
          )
        ).data.title,
      ).toBe("Admin bypass");

      await setFolderLock(
        targetId,
        { locked: false, applyToDescendants: false },
        actor(adminId, "ADMIN"),
      );
    });

    it("allows only admin to purge permanently", async () => {
      const purgeCandidate = await createLinkDocument(
        {
          folderId: rootId,
          title: "Sẽ purge",
          description: "",
          kind: "GOOGLE_DRIVE_LINK",
          externalUrl: "https://drive.google.com/file/d/purge/view",
        },
        actor(ownerId),
      );
      await softDeleteDocument(purgeCandidate.data.id, actor(ownerId));
      const input = {
        items: [
          {
            entityType: "DOCUMENT" as const,
            entityId: purgeCandidate.data.id,
          },
        ],
      };

      await expect(
        purgeTrashItems(input, actor(managerId)),
      ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
      expect(
        (await purgeTrashItems(input, actor(adminId, "ADMIN"))).data.purged,
      ).toBe(1);
      expect(
        await getPrismaClient().document.findUnique({
          where: { id: purgeCandidate.data.id },
        }),
      ).toBeNull();
    });
  },
);
