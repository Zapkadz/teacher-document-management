import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { isPreviewableMimeType } from "@/modules/documents/document.validation";
import {
  type PermissionActor,
  getEffectivePermissionsForFolders,
} from "@/modules/permissions/permission.engine";

import type { SearchQuery } from "./search.validation";

const documentSearchSelect = {
  id: true,
  folderId: true,
  ownerUserId: true,
  title: true,
  description: true,
  documentKind: true,
  originalFileName: true,
  mimeType: true,
  fileExtension: true,
  sizeBytes: true,
  externalUrl: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  folder: {
    select: {
      id: true,
      name: true,
      workspaceType: true,
    },
  },
} satisfies Prisma.DocumentSelect;

const folderSearchSelect = {
  id: true,
  name: true,
  parentId: true,
  workspaceType: true,
  ownerUserId: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { id: true, name: true, email: true } },
} satisfies Prisma.FolderSelect;

type SearchItem =
  | {
      type: "DOCUMENT";
      sortAt: Date;
      id: string;
      data: Prisma.DocumentGetPayload<{
        select: typeof documentSearchSelect;
      }>;
    }
  | {
      type: "FOLDER";
      sortAt: Date;
      id: string;
      data: Prisma.FolderGetPayload<{
        select: typeof folderSearchSelect;
      }>;
    };

function fileTypeWhere(
  fileType: SearchQuery["fileType"],
): Prisma.DocumentWhereInput | undefined {
  switch (fileType) {
    case "file":
      return { documentKind: "FILE" };
    case "word":
      return { fileExtension: { in: [".doc", ".docx"] } };
    case "excel":
      return { fileExtension: { in: [".xls", ".xlsx"] } };
    case "pdf":
      return { fileExtension: ".pdf" };
    case "powerpoint":
      return { fileExtension: { in: [".ppt", ".pptx"] } };
    case "image":
      return { mimeType: { startsWith: "image/" } };
    case "google_drive":
      return { documentKind: "GOOGLE_DRIVE_LINK" };
    case "youtube":
      return { documentKind: "YOUTUBE_LINK" };
    default:
      return undefined;
  }
}

function serializeDocument(
  document: Prisma.DocumentGetPayload<{
    select: typeof documentSearchSelect;
  }>,
  permissions: readonly string[],
) {
  return {
    type: "DOCUMENT" as const,
    id: document.id,
    title: document.title,
    description: document.description,
    documentKind: document.documentKind,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    fileExtension: document.fileExtension,
    sizeBytes: document.sizeBytes === null ? null : Number(document.sizeBytes),
    externalUrl: document.externalUrl,
    owner: document.owner,
    folder: document.folder,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    capabilities: {
      canDownload:
        document.documentKind === "FILE" &&
        permissions.includes("VIEW") &&
        permissions.includes("DOWNLOAD"),
      canPreview:
        document.documentKind === "FILE" &&
        permissions.includes("VIEW") &&
        permissions.includes("PREVIEW") &&
        isPreviewableMimeType(document.mimeType),
      canOpenLink: document.documentKind !== "FILE",
    },
  };
}

export async function searchMetadata(
  query: SearchQuery,
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();
  const includeDocuments = query.type !== "folder";
  const includeFolders = query.type !== "document";
  const [documents, folders] = await Promise.all([
    includeDocuments
      ? prisma.document.findMany({
          where: {
            deletedAt: null,
            status: "ACTIVE",
            folder: {
              deletedAt: null,
              academicYearId: query.academicYearId,
            },
            ownerUserId: query.ownerUserId,
            folderId: query.folderId,
            createdAt: { gte: query.from, lte: query.to },
            AND: [
              fileTypeWhere(query.fileType) ?? {},
              {
                OR: [
                  { title: { contains: query.q, mode: "insensitive" } },
                  { description: { contains: query.q, mode: "insensitive" } },
                  {
                    originalFileName: {
                      contains: query.q,
                      mode: "insensitive",
                    },
                  },
                  {
                    owner: {
                      is: {
                        OR: [
                          {
                            name: {
                              contains: query.q,
                              mode: "insensitive",
                            },
                          },
                          {
                            email: {
                              contains: query.q,
                              mode: "insensitive",
                            },
                          },
                        ],
                      },
                    },
                  },
                  {
                    folder: {
                      is: {
                        name: { contains: query.q, mode: "insensitive" },
                      },
                    },
                  },
                ],
              },
            ],
          },
          select: documentSearchSelect,
        })
      : Promise.resolve([]),
    includeFolders
      ? prisma.folder.findMany({
          where: {
            deletedAt: null,
            academicYearId: query.academicYearId,
            id: query.folderId,
            createdBy: query.ownerUserId,
            createdAt: { gte: query.from, lte: query.to },
            name: { contains: query.q, mode: "insensitive" },
          },
          select: folderSearchSelect,
        })
      : Promise.resolve([]),
  ]);

  const items: SearchItem[] = [
    ...documents.map((data) => ({
      type: "DOCUMENT" as const,
      id: data.id,
      sortAt: data.updatedAt,
      data,
    })),
    ...folders.map((data) => ({
      type: "FOLDER" as const,
      id: data.id,
      sortAt: data.updatedAt,
      data,
    })),
  ];
  const folderIds = [
    ...new Set(
      items.map((item) =>
        item.type === "DOCUMENT" ? item.data.folderId : item.data.id,
      ),
    ),
  ];
  const permissions = await getEffectivePermissionsForFolders(
    actor,
    folderIds,
    prisma,
  );
  const visible = items
    .filter((item) => {
      const folderId =
        item.type === "DOCUMENT" ? item.data.folderId : item.data.id;
      return permissions.get(folderId)?.permissions.includes("VIEW") === true;
    })
    .sort(
      (left, right) =>
        right.sortAt.getTime() - left.sortAt.getTime() ||
        left.type.localeCompare(right.type) ||
        left.id.localeCompare(right.id),
    );
  const skip = (query.page - 1) * query.limit;
  const page = visible.slice(skip, skip + query.limit);

  return {
    data: page.map((item) => {
      if (item.type === "FOLDER") {
        return {
          type: item.type,
          id: item.data.id,
          name: item.data.name,
          parentId: item.data.parentId,
          workspaceType: item.data.workspaceType,
          ownerUserId: item.data.ownerUserId,
          creator: item.data.creator,
          createdAt: item.data.createdAt,
          updatedAt: item.data.updatedAt,
        };
      }
      return serializeDocument(
        item.data,
        permissions.get(item.data.folderId)!.permissions,
      );
    }),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: visible.length,
      totalPages: Math.ceil(visible.length / query.limit),
    },
  };
}
