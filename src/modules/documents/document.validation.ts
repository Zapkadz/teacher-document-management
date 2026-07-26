import path from "node:path";

import { z } from "zod";

import { AppError } from "@/lib/errors/app-error";

const supportedMimeTypes = {
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".pdf": ["application/pdf"],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
} as const satisfies Record<string, readonly string[]>;

const defaultExtensions = Object.keys(supportedMimeTypes);

export type ValidatedFile = {
  originalFileName: string;
  safeFileName: string;
  fileExtension: string;
  mimeType: string;
  sizeBytes: number;
};

export function getFileRules() {
  const maxSizeMb = z.coerce
    .number()
    .positive()
    .max(1024)
    .default(100)
    .parse(process.env.MAX_FILE_SIZE_MB);
  const configured = (
    process.env.ALLOWED_FILE_EXTENSIONS ?? defaultExtensions.join(",")
  )
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => (item.startsWith(".") ? item : `.${item}`));

  return {
    maxSizeMb,
    maxSizeBytes: Math.floor(maxSizeMb * 1024 * 1024),
    allowedExtensions: new Set(
      configured.filter((extension) => extension in supportedMimeTypes),
    ),
  };
}

export function validateFile(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): ValidatedFile {
  const originalFileName = input.fileName.trim();
  if (
    originalFileName.length === 0 ||
    originalFileName.length > 255 ||
    originalFileName.includes("\0") ||
    path.posix.basename(originalFileName) !== originalFileName ||
    path.win32.basename(originalFileName) !== originalFileName
  ) {
    throw new AppError("INVALID_FILE_NAME", "Tên file không hợp lệ", 400);
  }

  const extension = path.extname(originalFileName).toLowerCase();
  const rules = getFileRules();
  if (
    !rules.allowedExtensions.has(extension) ||
    !(extension in supportedMimeTypes)
  ) {
    throw new AppError(
      "FILE_TYPE_NOT_ALLOWED",
      `Định dạng ${extension || "(không có)"} không được phép`,
      400,
    );
  }

  const allowedMimeTypes =
    supportedMimeTypes[extension as keyof typeof supportedMimeTypes];
  if (!(allowedMimeTypes as readonly string[]).includes(input.mimeType)) {
    throw new AppError(
      "FILE_MIME_MISMATCH",
      "MIME type không khớp với phần mở rộng file",
      400,
    );
  }

  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new AppError(
      "INVALID_FILE_SIZE",
      "Dung lượng file không hợp lệ",
      400,
    );
  }
  if (input.sizeBytes > rules.maxSizeBytes) {
    throw new AppError(
      "FILE_TOO_LARGE",
      `File vượt quá giới hạn ${rules.maxSizeMb} MB`,
      413,
    );
  }

  const stem = path.basename(originalFileName, extension);
  const safeStem =
    stem
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180) || "document";

  return {
    originalFileName,
    safeFileName: `${safeStem}${extension}`,
    fileExtension: extension,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  };
}

export const uploadInitSchema = z.object({
  folderId: z.uuid(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

export const uploadCompleteSchema = z.object({
  uploadId: z.uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional().default(""),
});

export const createLinkSchema = z.object({
  folderId: z.uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional().default(""),
  kind: z.enum(["GOOGLE_DRIVE_LINK", "YOUTUBE_LINK"]),
  externalUrl: z.url().max(2048),
});

export const listDocumentsSchema = z.object({
  search: z.string().trim().max(255).optional(),
  kind: z.enum(["FILE", "GOOGLE_DRIVE_LINK", "YOUTUBE_LINK"]).optional(),
  ownerUserId: z.uuid().optional(),
  sort: z
    .enum(["newest", "oldest", "title_asc", "title_desc"])
    .default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).default(""),
  })
  .strict();

export const moveDocumentSchema = z
  .object({
    targetFolderId: z.uuid(),
  })
  .strict();

export const restoreDocumentSchema = z
  .object({
    targetFolderId: z.uuid().optional(),
  })
  .strict();

export const trashQuerySchema = z.object({
  workspace: z
    .enum(["personal", "shared"])
    .transform((value) => (value === "personal" ? "PERSONAL" : "SHARED"))
    .optional(),
  entityType: z.literal("DOCUMENT").default("DOCUMENT"),
  folderId: z.uuid().optional(),
  deletedBy: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const trashItemSchema = z.object({
  entityType: z.literal("DOCUMENT"),
  entityId: z.uuid(),
  targetFolderId: z.uuid().optional(),
});

export const restoreTrashSchema = z
  .object({
    items: z.array(trashItemSchema).min(1).max(100),
  })
  .strict();

export const purgeTrashSchema = z
  .object({
    items: z
      .array(
        z.object({
          entityType: z.literal("DOCUMENT"),
          entityId: z.uuid(),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();

export type UploadInitInput = z.infer<typeof uploadInitSchema>;
export type UploadCompleteInput = z.infer<typeof uploadCompleteSchema>;
export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type MoveDocumentInput = z.infer<typeof moveDocumentSchema>;
export type RestoreDocumentInput = z.infer<typeof restoreDocumentSchema>;
export type TrashQuery = z.infer<typeof trashQuerySchema>;
export type RestoreTrashInput = z.infer<typeof restoreTrashSchema>;
export type PurgeTrashInput = z.infer<typeof purgeTrashSchema>;

export function validateExternalUrl(
  kind: CreateLinkInput["kind"],
  value: string,
) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new AppError(
      "INVALID_EXTERNAL_URL",
      "Liên kết phải sử dụng HTTPS",
      400,
    );
  }

  const host = url.hostname.toLowerCase();
  const allowed =
    kind === "GOOGLE_DRIVE_LINK"
      ? new Set(["drive.google.com", "docs.google.com"])
      : new Set(["youtube.com", "www.youtube.com", "youtu.be"]);

  if (!allowed.has(host)) {
    throw new AppError(
      "EXTERNAL_URL_NOT_ALLOWED",
      "Tên miền liên kết không nằm trong danh sách cho phép",
      400,
    );
  }

  return url.toString();
}

export function isPreviewableMimeType(mimeType: string | null) {
  return (
    mimeType === "application/pdf" ||
    (mimeType?.startsWith("image/") === true && mimeType !== "image/svg+xml")
  );
}
