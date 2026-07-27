import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/lib/db/prisma";
import {
  activateAcademicYear,
  createAcademicYear,
  listAcademicYearFolderOptions,
  updateAcademicYear,
} from "@/modules/academic-years/academic-year.service";
import { createLinkDocument } from "@/modules/documents/document.service";
import {
  copyFolderStructure,
  previewFolderCopy,
} from "@/modules/folders/folder-copy.service";
import { createFolder } from "@/modules/folders/folder.service";
import { createFolderPermissions } from "@/modules/permissions/permission.service";
import { createUser } from "@/modules/users/user.service";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)(
  "Phase 7 academic years and folder structure copy",
  () => {
    const suffix = randomUUID();
    const userIds: string[] = [];
    const academicYearIds: string[] = [];
    let previousActiveYearId: string | null = null;
    let adminId: string;
    let teacherId: string;
    let sourceYearId: string;
    let targetYearId: string;
    let sourceRootId: string;
    let targetRootId: string;
    let sourceFolderId: string;
    let sourceChildId: string;

    const actor = (id: string, globalRole: "ADMIN" | "USER" = "USER") => ({
      id,
      globalRole,
    });

    beforeAll(async () => {
      const prisma = getPrismaClient();
      previousActiveYearId =
        (
          await prisma.academicYear.findFirst({
            where: { isActive: true },
            select: { id: true },
          })
        )?.id ?? null;

      const admin = await createUser(
        {
          email: `phase7-admin-${suffix}@example.com`,
          fullName: "Phase 7 Admin",
          globalRole: "ADMIN",
          status: "ACTIVE",
        },
        null,
      );
      const teacher = await createUser(
        {
          email: `phase7-teacher-${suffix}@example.com`,
          fullName: "Phase 7 Teacher",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );
      adminId = admin.id;
      teacherId = teacher.id;
      userIds.push(adminId, teacherId);

      const sourceYear = await createAcademicYear(
        {
          name: `Nguồn Phase7 ${suffix}`,
          startsOn: new Date("2025-08-01T00:00:00.000Z"),
          endsOn: new Date("2026-05-31T00:00:00.000Z"),
          isActive: false,
        },
        actor(adminId, "ADMIN"),
      );
      const targetYear = await createAcademicYear(
        {
          name: `Đích Phase7 ${suffix}`,
          startsOn: new Date("2026-08-01T00:00:00.000Z"),
          endsOn: new Date("2027-05-31T00:00:00.000Z"),
          isActive: false,
        },
        actor(adminId, "ADMIN"),
      );
      sourceYearId = sourceYear.data.id;
      targetYearId = targetYear.data.id;
      sourceRootId = sourceYear.data.rootFolder!.id;
      targetRootId = targetYear.data.rootFolder!.id;
      academicYearIds.push(sourceYearId, targetYearId);

      sourceFolderId = (
        await createFolder(
          {
            name: `Khối 1 Phase7 ${suffix}`,
            parentId: sourceRootId,
            workspaceType: "SHARED",
            academicYearId: sourceYearId,
          },
          actor(adminId, "ADMIN"),
        )
      ).data.id;
      sourceChildId = (
        await createFolder(
          {
            name: "Toán",
            parentId: sourceFolderId,
            workspaceType: "SHARED",
            academicYearId: sourceYearId,
          },
          actor(adminId, "ADMIN"),
        )
      ).data.id;

      await createFolderPermissions(
        sourceFolderId,
        {
          principalType: "USER",
          principalIds: [teacherId],
          permissions: ["VIEW"],
          appliesToDescendants: true,
        },
        actor(adminId, "ADMIN"),
      );
      await createFolderPermissions(
        targetRootId,
        {
          principalType: "USER",
          principalIds: [teacherId],
          permissions: ["VIEW", "CREATE_SUBFOLDER"],
          appliesToDescendants: true,
        },
        actor(adminId, "ADMIN"),
      );

      await createLinkDocument(
        {
          folderId: sourceChildId,
          title: "Tài liệu giữ ở năm nguồn",
          description: "",
          kind: "GOOGLE_DRIVE_LINK",
          externalUrl: "https://drive.google.com/file/d/phase7-test/view",
        },
        actor(adminId, "ADMIN"),
      );
    });

    afterAll(async () => {
      const prisma = getPrismaClient();
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.deleteMany({
          where: {
            OR: [
              { actorUserId: { in: userIds } },
              { entityId: { in: academicYearIds } },
            ],
          },
        });
        await tx.folderPermission.deleteMany({
          where: {
            OR: [
              { userId: { in: userIds } },
              { grantedBy: { in: userIds } },
              { folder: { academicYearId: { in: academicYearIds } } },
            ],
          },
        });
        await tx.document.updateMany({
          where: { folder: { academicYearId: { in: academicYearIds } } },
          data: { currentVersionId: null },
        });
        await tx.document.deleteMany({
          where: { folder: { academicYearId: { in: academicYearIds } } },
        });
        await tx.folder.deleteMany({
          where: { academicYearId: { in: academicYearIds } },
        });
        await tx.academicYear.deleteMany({
          where: { id: { in: academicYearIds } },
        });
        if (previousActiveYearId) {
          await tx.academicYear.updateMany({
            where: { isActive: true },
            data: { isActive: false },
          });
          await tx.academicYear.update({
            where: { id: previousActiveYearId },
            data: { isActive: true },
          });
        }
        await tx.personalWorkspace.deleteMany({
          where: { ownerUserId: { in: userIds } },
        });
        await tx.folder.deleteMany({
          where: { ownerUserId: { in: userIds } },
        });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      });
    });

    it("manages years and keeps exactly one active year", async () => {
      const renamed = await updateAcademicYear(
        targetYearId,
        { name: `Đích mới Phase7 ${suffix}` },
        actor(adminId, "ADMIN"),
      );
      expect(renamed.data.name).toContain("Đích mới Phase7");
      expect(renamed.data.rootFolder?.name).toContain("Đích mới Phase7");

      const activated = await activateAcademicYear(
        targetYearId,
        actor(adminId, "ADMIN"),
      );
      expect(activated.data.isActive).toBe(true);
      expect(
        await getPrismaClient().academicYear.count({
          where: { isActive: true },
        }),
      ).toBe(1);

      await expect(
        createAcademicYear(
          {
            name: renamed.data.name,
            isActive: false,
          },
          actor(adminId, "ADMIN"),
        ),
      ).rejects.toMatchObject({
        code: "ACADEMIC_YEAR_CONFLICT",
        status: 409,
      });
    });

    it("exposes only folders allowed for the requested copy purpose", async () => {
      const sources = await listAcademicYearFolderOptions(
        sourceYearId,
        "source",
        actor(teacherId),
      );
      expect(sources.data.map(({ id }) => id)).toEqual(
        expect.arrayContaining([sourceFolderId, sourceChildId]),
      );

      const targets = await listAcademicYearFolderOptions(
        targetYearId,
        "target",
        actor(teacherId),
      );
      expect(targets.data.map(({ id }) => id)).toContain(targetRootId);

      await expect(
        previewFolderCopy(
          sourceFolderId,
          {
            targetParentId: targetRootId,
            copyPermissions: true,
            copyDocuments: false,
          },
          actor(teacherId),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

      const previewWithoutAcl = await previewFolderCopy(
        sourceFolderId,
        {
          targetParentId: targetRootId,
          copyPermissions: false,
          copyDocuments: false,
        },
        actor(teacherId),
      );
      expect(previewWithoutAcl.data.folderCount).toBe(2);
      expect(previewWithoutAcl.data.permissionCount).toBe(0);
      expect(previewWithoutAcl.data.documentCountExcluded).toBe(1);
    });

    it("previews and transactionally copies structure plus direct ACL without documents", async () => {
      const input = {
        targetParentId: targetRootId,
        copyPermissions: true,
        copyDocuments: false as const,
      };
      const preview = await previewFolderCopy(
        sourceFolderId,
        input,
        actor(adminId, "ADMIN"),
      );
      expect(preview.data).toMatchObject({
        folderCount: 2,
        permissionCount: 1,
        documentCountExcluded: 1,
      });

      const copied = await copyFolderStructure(
        sourceFolderId,
        input,
        actor(adminId, "ADMIN"),
      );
      const prisma = getPrismaClient();
      const copiedFolders = await prisma.folder.findMany({
        where: {
          academicYearId: targetYearId,
          OR: [
            { id: copied.data.copiedRootId },
            { parentId: copied.data.copiedRootId },
          ],
        },
        select: { id: true, parentId: true, academicYearId: true },
      });

      expect(copiedFolders).toHaveLength(2);
      expect(
        copiedFolders.every(
          ({ academicYearId }) => academicYearId === targetYearId,
        ),
      ).toBe(true);
      expect(
        await prisma.folderPermission.count({
          where: {
            folderId: copied.data.copiedRootId,
            userId: teacherId,
          },
        }),
      ).toBe(1);
      expect(
        await prisma.document.count({
          where: {
            folder: { academicYearId: targetYearId },
          },
        }),
      ).toBe(0);
      expect(
        await prisma.auditLog.count({
          where: {
            action: "FOLDER_STRUCTURE_COPIED",
            entityId: copied.data.copiedRootId,
          },
        }),
      ).toBe(1);
    });
  },
);
