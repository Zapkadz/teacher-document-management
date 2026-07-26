import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/lib/db/prisma";
import {
  createFolder,
  getFolderTree,
  renameFolder,
  softDeleteFolder,
} from "@/modules/folders/folder.service";
import { createUser } from "@/modules/users/user.service";

import { PERMISSIONS } from "./permission.constants";
import { getEffectivePermissions } from "./permission.engine";
import {
  createFolderPermissions,
  listFolderPermissions,
  updateFolderInheritance,
} from "./permission.service";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)(
  "Phase 3 permission engine with PostgreSQL",
  () => {
    const suffix = randomUUID();
    const userIds: string[] = [];
    const folderIds: string[] = [];
    let adminId: string;
    let granteeId: string;
    let outsiderId: string;
    let sharedRootId: string;
    let boundaryId: string;
    let descendantId: string;
    let groupId: string;

    beforeAll(async () => {
      const prisma = getPrismaClient();
      const admin = await createUser(
        {
          email: `permission-admin-${suffix}@example.com`,
          fullName: "Permission Admin",
          globalRole: "ADMIN",
          status: "ACTIVE",
        },
        null,
      );
      const grantee = await createUser(
        {
          email: `permission-user-${suffix}@example.com`,
          fullName: "Permission User",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );
      const outsider = await createUser(
        {
          email: `permission-outsider-${suffix}@example.com`,
          fullName: "Permission Outsider",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );
      adminId = admin.id;
      granteeId = grantee.id;
      outsiderId = outsider.id;
      userIds.push(adminId, granteeId, outsiderId);

      const sharedRoot = await prisma.folder.findFirstOrThrow({
        where: { workspaceType: "SHARED", parentId: null, deletedAt: null },
        select: { id: true },
      });
      sharedRootId = sharedRoot.id;

      const boundary = await prisma.folder.create({
        data: {
          name: `ACL boundary ${suffix}`,
          parentId: sharedRootId,
          workspaceType: "SHARED",
          createdBy: adminId,
        },
        select: { id: true },
      });
      const descendant = await prisma.folder.create({
        data: {
          name: `ACL descendant ${suffix}`,
          parentId: boundary.id,
          workspaceType: "SHARED",
          createdBy: adminId,
        },
        select: { id: true },
      });
      boundaryId = boundary.id;
      descendantId = descendant.id;
      folderIds.push(boundaryId, descendantId);

      const group = await prisma.group.create({
        data: {
          name: `Permission Group ${suffix}`,
          createdBy: adminId,
          members: { create: { userId: granteeId } },
        },
        select: { id: true },
      });
      groupId = group.id;
    });

    afterAll(async () => {
      const prisma = getPrismaClient();
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorUserId: { in: userIds } },
            { folderId: { in: folderIds } },
            { entityId: { in: userIds } },
          ],
        },
      });
      await prisma.folderPermission.deleteMany({
        where: {
          OR: [
            { folderId: { in: [sharedRootId, ...folderIds] } },
            { userId: { in: userIds } },
            { groupId },
          ],
        },
      });
      await prisma.group.deleteMany({ where: { id: groupId } });
      await prisma.folder.deleteMany({ where: { id: { in: folderIds } } });
      await prisma.personalWorkspace.deleteMany({
        where: { ownerUserId: { in: userIds } },
      });
      await prisma.folder.deleteMany({
        where: { ownerUserId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    });

    it("unions direct, inherited, and group permissions", async () => {
      const admin = { id: adminId, globalRole: "ADMIN" as const };
      const grantee = { id: granteeId, globalRole: "USER" as const };

      await createFolderPermissions(
        sharedRootId,
        {
          principalType: "USER",
          principalIds: [granteeId],
          permissions: [
            "VIEW",
            "PREVIEW",
            "DOWNLOAD",
            "UPLOAD",
            "CREATE_SUBFOLDER",
            "EDIT_OWN",
            "DELETE_OWN",
            "MOVE_OWN",
          ],
          appliesToDescendants: true,
        },
        admin,
      );
      await createFolderPermissions(
        descendantId,
        {
          principalType: "GROUP",
          principalIds: [groupId],
          permissions: ["DOWNLOAD"],
          appliesToDescendants: false,
        },
        admin,
      );

      const effective = await getEffectivePermissions(grantee, descendantId);
      expect(effective.permissions).toEqual(
        expect.arrayContaining(["VIEW", "UPLOAD", "DOWNLOAD"]),
      );
      expect(effective.sources.map(({ kind }) => kind)).toEqual(
        expect.arrayContaining(["DIRECT", "INHERITED"]),
      );

      const tree = await getFolderTree(grantee, {
        workspace: "SHARED",
        deleted: false,
      });
      expect(tree.data.map(({ id }) => id)).toContain(sharedRootId);

      const ownedFolder = await createFolder(
        {
          name: `Contributor folder ${suffix}`,
          parentId: sharedRootId,
          workspaceType: "SHARED",
        },
        grantee,
      );
      folderIds.push(ownedFolder.data.id);
      await renameFolder(
        ownedFolder.data.id,
        `Contributor renamed ${suffix}`,
        grantee,
      );
      await softDeleteFolder(ownedFolder.data.id, grantee);
    });

    it("stops above a disabled inheritance boundary but inherits its direct grant", async () => {
      const admin = { id: adminId, globalRole: "ADMIN" as const };
      const grantee = { id: granteeId, globalRole: "USER" as const };

      await updateFolderInheritance(boundaryId, false, admin);
      const filteredTree = await getFolderTree(grantee, {
        workspace: "SHARED",
        deleted: false,
      });
      expect(
        filteredTree.data.find(({ id }) => id === sharedRootId)?.hasChildren,
      ).toBe(false);

      await createFolderPermissions(
        boundaryId,
        {
          principalType: "USER",
          principalIds: [granteeId],
          permissions: ["PREVIEW"],
          appliesToDescendants: true,
        },
        admin,
      );

      const boundary = await getEffectivePermissions(grantee, boundaryId);
      expect(boundary.permissions).toEqual(
        expect.arrayContaining(["VIEW", "PREVIEW"]),
      );
      expect(boundary.permissions).not.toContain("UPLOAD");

      const descendant = await getEffectivePermissions(grantee, descendantId);
      expect(descendant.permissions).toEqual(
        expect.arrayContaining(["VIEW", "PREVIEW", "DOWNLOAD"]),
      );
      expect(descendant.permissions).not.toContain("UPLOAD");
    });

    it("gives admins all permissions and rejects unauthorized permission APIs", async () => {
      const admin = await getEffectivePermissions(
        { id: adminId, globalRole: "ADMIN" },
        descendantId,
      );
      expect(admin.permissions).toEqual([...PERMISSIONS]);

      await expect(
        listFolderPermissions(descendantId, {
          id: outsiderId,
          globalRole: "USER",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

      await expect(
        createFolderPermissions(
          descendantId,
          {
            principalType: "USER",
            principalIds: [outsiderId],
            permissions: ["VIEW"],
            appliesToDescendants: true,
          },
          { id: outsiderId, globalRole: "USER" },
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    });
  },
);
