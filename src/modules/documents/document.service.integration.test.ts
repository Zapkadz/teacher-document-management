import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/lib/db/prisma";
import { createFolderPermissions } from "@/modules/permissions/permission.service";
import { deleteStoredObject, headStoredObject } from "@/modules/storage/s3";
import { createUser } from "@/modules/users/user.service";

import {
  completeUpload,
  createDownload,
  createLinkDocument,
  createPreview,
  initializeUpload,
  listDocuments,
} from "./document.service";

const runStorageTests =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_STORAGE_TESTS === "true";

describe.skipIf(!runStorageTests)(
  "Phase 4 document storage with PostgreSQL and MinIO",
  () => {
    const suffix = randomUUID();
    const userIds: string[] = [];
    let adminId: string;
    let ownerId: string;
    let viewerId: string;
    let rootId: string;
    let documentId: string;

    beforeAll(async () => {
      const admin = await createUser(
        {
          email: `document-admin-${suffix}@example.com`,
          fullName: "Document Admin",
          globalRole: "ADMIN",
          status: "ACTIVE",
        },
        null,
      );
      const owner = await createUser(
        {
          email: `document-owner-${suffix}@example.com`,
          fullName: "Document Owner",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );
      const viewer = await createUser(
        {
          email: `document-viewer-${suffix}@example.com`,
          fullName: "Document Viewer",
          globalRole: "USER",
          status: "ACTIVE",
        },
        admin.id,
      );
      adminId = admin.id;
      ownerId = owner.id;
      viewerId = viewer.id;
      rootId = owner.personalWorkspace!.rootFolderId;
      userIds.push(adminId, ownerId, viewerId);

      await createFolderPermissions(
        rootId,
        {
          principalType: "USER",
          principalIds: [viewerId],
          permissions: ["VIEW", "PREVIEW"],
          appliesToDescendants: true,
        },
        { id: adminId, globalRole: "ADMIN" },
      );
    });

    afterAll(async () => {
      const prisma = getPrismaClient();
      const stored = await prisma.document.findMany({
        where: { ownerUserId: ownerId },
        select: { storageKey: true },
      });
      for (const document of stored) {
        if (document.storageKey) {
          await deleteStoredObject(document.storageKey);
        }
      }
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ actorUserId: { in: userIds } }, { entityId: { in: userIds } }],
        },
      });
      await prisma.uploadSession.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.folderPermission.deleteMany({
        where: { userId: { in: userIds } },
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

    it("uploads a valid file, creates version 1, lists it, and downloads it", async () => {
      const content = new TextEncoder().encode("%PDF-1.7 test document");
      const actor = { id: ownerId, globalRole: "USER" as const };
      const initialized = await initializeUpload(
        {
          folderId: rootId,
          fileName: "giao-an.pdf",
          mimeType: "application/pdf",
          sizeBytes: content.byteLength,
        },
        actor,
      );

      const uploadResponse = await fetch(initialized.data.uploadUrl, {
        method: "PUT",
        headers: initialized.data.requiredHeaders,
        body: content,
      });
      if (!uploadResponse.ok) {
        throw new Error(
          `MinIO upload failed (${uploadResponse.status}): ${await uploadResponse.text()}`,
        );
      }

      const completed = await completeUpload(
        {
          uploadId: initialized.data.uploadId,
          title: "Giáo án kiểm thử",
          description: "Phiên bản đầu tiên",
        },
        actor,
      );
      documentId = completed.data.id;
      expect(completed.data.currentVersion?.versionNumber).toBe(1);

      const listed = await listDocuments(
        rootId,
        { page: 1, limit: 25, sort: "newest" },
        actor,
      );
      expect(listed.data.map(({ id }) => id)).toContain(documentId);

      const download = await createDownload(documentId, actor);
      const downloaded = await fetch(download.data.url);
      expect(downloaded.ok).toBe(true);
      expect(
        Array.from(new Uint8Array(await downloaded.arrayBuffer())),
      ).toEqual(Array.from(content));

      expect(
        await getPrismaClient().auditLog.count({
          where: {
            entityId: documentId,
            action: { in: ["DOCUMENT_UPLOADED", "DOCUMENT_DOWNLOADED"] },
          },
        }),
      ).toBe(2);
    });

    it("rejects direct upload and download calls without the required permission", async () => {
      const viewer = { id: viewerId, globalRole: "USER" as const };
      await expect(
        initializeUpload(
          {
            folderId: rootId,
            fileName: "blocked.pdf",
            mimeType: "application/pdf",
            sizeBytes: 100,
          },
          viewer,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

      await expect(createDownload(documentId, viewer)).rejects.toMatchObject({
        code: "FORBIDDEN",
        status: 403,
      });

      const preview = await createPreview(documentId, viewer);
      expect((await fetch(preview.data.url)).ok).toBe(true);
    });

    it("rejects mismatched object metadata and removes the invalid object", async () => {
      const actor = { id: ownerId, globalRole: "USER" as const };
      const content = new TextEncoder().encode("invalid PDF metadata");
      const initialized = await initializeUpload(
        {
          folderId: rootId,
          fileName: "mismatch.pdf",
          mimeType: "application/pdf",
          sizeBytes: content.byteLength,
        },
        actor,
      );
      const uploaded = await fetch(initialized.data.uploadUrl, {
        method: "PUT",
        body: content,
      });
      expect(uploaded.ok).toBe(true);

      await expect(
        completeUpload(
          {
            uploadId: initialized.data.uploadId,
            title: "Metadata không khớp",
            description: "",
          },
          actor,
        ),
      ).rejects.toMatchObject({
        code: "UPLOAD_OBJECT_MISMATCH",
        status: 409,
      });

      const upload = await getPrismaClient().uploadSession.findUniqueOrThrow({
        where: { id: initialized.data.uploadId },
        select: { storageKey: true },
      });
      await expect(headStoredObject(upload.storageKey)).rejects.toBeDefined();
    });

    it("creates an allowlisted Google Drive link as version 1", async () => {
      const actor = { id: ownerId, globalRole: "USER" as const };
      const linked = await createLinkDocument(
        {
          folderId: rootId,
          title: "Tài liệu trên Google Drive",
          description: "Liên kết kiểm thử",
          kind: "GOOGLE_DRIVE_LINK",
          externalUrl: "https://drive.google.com/file/d/example/view",
        },
        actor,
      );
      expect(linked.data.documentKind).toBe("GOOGLE_DRIVE_LINK");
      expect(linked.data.currentVersion?.versionNumber).toBe(1);
    });
  },
);
