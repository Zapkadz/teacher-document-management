import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/lib/db/prisma";
import { listAuditLogs } from "@/modules/audit/audit.service";
import { createLinkDocument } from "@/modules/documents/document.service";
import { createFolder } from "@/modules/folders/folder.service";
import { createFolderPermissions } from "@/modules/permissions/permission.service";
import { createUser } from "@/modules/users/user.service";

import { searchMetadata } from "./search.service";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)(
  "Phase 6 permission-aware audit and search",
  () => {
    const suffix = randomUUID();
    const userIds: string[] = [];
    let adminId: string;
    let authorId: string;
    let viewerId: string;
    let auditorId: string;
    let outsiderId: string;
    let visibleFolderId: string;
    let hiddenFolderId: string;
    let visibleDocumentId: string;
    let hiddenDocumentId: string;

    const actor = (id: string, globalRole: "ADMIN" | "USER" = "USER") => ({
      id,
      globalRole,
    });

    beforeAll(async () => {
      const admin = await createUser(
        {
          email: `phase6-admin-${suffix}@example.com`,
          fullName: "Phase 6 Admin",
          globalRole: "ADMIN",
          status: "ACTIVE",
        },
        null,
      );
      const author = await createUser(
        {
          email: `phase6-author-${suffix}@example.com`,
          fullName: "Phase 6 Author",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );
      const viewer = await createUser(
        {
          email: `phase6-viewer-${suffix}@example.com`,
          fullName: "Phase 6 Viewer",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );
      const auditor = await createUser(
        {
          email: `phase6-auditor-${suffix}@example.com`,
          fullName: "Phase 6 Auditor",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );
      const outsider = await createUser(
        {
          email: `phase6-outsider-${suffix}@example.com`,
          fullName: "Phase 6 Outsider",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );

      adminId = admin.id;
      authorId = author.id;
      viewerId = viewer.id;
      auditorId = auditor.id;
      outsiderId = outsider.id;
      userIds.push(adminId, authorId, viewerId, auditorId, outsiderId);

      const visibleFolder = await createFolder(
        {
          name: `Hồ sơ Phase6 ${suffix}`,
          parentId: author.personalWorkspace!.rootFolderId,
          workspaceType: "PERSONAL",
        },
        actor(authorId),
      );
      const hiddenFolder = await createFolder(
        {
          name: `Bí mật Phase6 ${suffix}`,
          parentId: outsider.personalWorkspace!.rootFolderId,
          workspaceType: "PERSONAL",
        },
        actor(outsiderId),
      );
      visibleFolderId = visibleFolder.data.id;
      hiddenFolderId = hiddenFolder.data.id;

      await createFolderPermissions(
        author.personalWorkspace!.rootFolderId,
        {
          principalType: "USER",
          principalIds: [viewerId],
          permissions: ["VIEW", "PREVIEW"],
          appliesToDescendants: true,
        },
        actor(adminId, "ADMIN"),
      );
      await createFolderPermissions(
        author.personalWorkspace!.rootFolderId,
        {
          principalType: "USER",
          principalIds: [auditorId],
          permissions: ["VIEW", "VIEW_AUDIT"],
          appliesToDescendants: true,
        },
        actor(adminId, "ADMIN"),
      );

      visibleDocumentId = (
        await createLinkDocument(
          {
            folderId: visibleFolderId,
            title: `Giáo án Toán Phase6 ${suffix}`,
            description: "Metadata được phép tìm",
            kind: "GOOGLE_DRIVE_LINK",
            externalUrl: "https://drive.google.com/file/d/phase6-visible/view",
          },
          actor(authorId),
        )
      ).data.id;
      hiddenDocumentId = (
        await createLinkDocument(
          {
            folderId: hiddenFolderId,
            title: `Bí mật Phase6 ${suffix}`,
            description: "Metadata không được phép lộ",
            kind: "YOUTUBE_LINK",
            externalUrl: "https://www.youtube.com/watch?v=phase6-hidden",
          },
          actor(outsiderId),
        )
      ).data.id;

      await getPrismaClient().auditLog.create({
        data: {
          actorUserId: auditorId,
          action: "LOGIN_SUCCEEDED",
          entityType: "AUTH",
          entityId: auditorId,
          metadata: { provider: "test" },
        },
      });
    });

    afterAll(async () => {
      const prisma = getPrismaClient();
      await prisma.auditLog.deleteMany({
        where: { actorUserId: { in: userIds } },
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

    it("returns only VIEW-authorized search results and supports metadata filters", async () => {
      const query = {
        q: "Phase6",
        type: "all" as const,
        page: 1,
        limit: 25,
      };
      const viewerResults = await searchMetadata(query, actor(viewerId));
      expect(viewerResults.data.map(({ id }) => id)).toContain(
        visibleDocumentId,
      );
      expect(viewerResults.data.map(({ id }) => id)).toContain(visibleFolderId);
      expect(viewerResults.data.map(({ id }) => id)).not.toContain(
        hiddenDocumentId,
      );
      expect(viewerResults.data.map(({ id }) => id)).not.toContain(
        hiddenFolderId,
      );

      const driveOnly = await searchMetadata(
        {
          ...query,
          type: "document",
          fileType: "google_drive",
        },
        actor(viewerId),
      );
      expect(driveOnly.data).toHaveLength(1);
      expect(driveOnly.data[0]?.id).toBe(visibleDocumentId);

      const adminResults = await searchMetadata(query, actor(adminId, "ADMIN"));
      expect(adminResults.data.map(({ id }) => id)).toEqual(
        expect.arrayContaining([visibleDocumentId, hiddenDocumentId]),
      );
    });

    it("shows own audit plus VIEW_AUDIT scope without leaking hidden folders", async () => {
      const auditorLogs = await listAuditLogs(
        { page: 1, limit: 100 },
        actor(auditorId),
      );
      expect(
        auditorLogs.data.some(
          (log) =>
            log.entityId === visibleDocumentId &&
            log.action === "DOCUMENT_LINK_CREATED",
        ),
      ).toBe(true);
      expect(
        auditorLogs.data.some(
          (log) =>
            log.entityId === hiddenDocumentId &&
            log.action === "DOCUMENT_LINK_CREATED",
        ),
      ).toBe(false);
      expect(
        auditorLogs.data.some(
          (log) =>
            log.actorUserId === auditorId && log.action === "LOGIN_SUCCEEDED",
        ),
      ).toBe(true);

      await expect(
        listAuditLogs(
          { folderId: hiddenFolderId, page: 1, limit: 25 },
          actor(auditorId),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

      const adminLogs = await listAuditLogs(
        {
          folderId: hiddenFolderId,
          page: 1,
          limit: 25,
        },
        actor(adminId, "ADMIN"),
      );
      expect(adminLogs.data.map(({ entityId }) => entityId)).toContain(
        hiddenDocumentId,
      );
    });

    it("lets a user read personal activity without VIEW_AUDIT", async () => {
      await getPrismaClient().auditLog.create({
        data: {
          actorUserId: viewerId,
          action: "LOGIN_SUCCEEDED",
          entityType: "AUTH",
          entityId: viewerId,
          metadata: { provider: "test" },
        },
      });
      const own = await listAuditLogs(
        { actorUserId: viewerId, page: 1, limit: 25 },
        actor(viewerId),
      );
      expect(
        own.data.every(({ actorUserId }) => actorUserId === viewerId),
      ).toBe(true);
      expect(own.data.map(({ action }) => action)).toContain("LOGIN_SUCCEEDED");
    });
  },
);
