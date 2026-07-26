import { z } from "zod";

const uuidSchema = z.uuid("ID thư mục không hợp lệ");

export const folderNameSchema = z
  .string()
  .trim()
  .min(1, "Tên thư mục không được để trống")
  .max(255, "Tên thư mục không được quá 255 ký tự")
  .refine((name) => name !== "." && name !== "..", {
    message: "Tên thư mục không hợp lệ",
  })
  .refine((name) => !/[\/\\\u0000-\u001f]/.test(name), {
    message: "Tên thư mục không được chứa /, \\ hoặc ký tự điều khiển",
  });

export const workspaceQuerySchema = z
  .enum(["personal", "shared"])
  .transform((value) => (value === "personal" ? "PERSONAL" : "SHARED"));

export const createFolderSchema = z.object({
  name: folderNameSchema,
  parentId: uuidSchema,
  workspaceType: z.enum(["PERSONAL", "SHARED"]),
});

export const renameFolderSchema = z
  .object({
    name: folderNameSchema,
  })
  .strict();

export const moveFolderSchema = z
  .object({
    targetParentId: uuidSchema,
  })
  .strict();

export const lockFolderSchema = z
  .object({
    locked: z.boolean(),
    applyToDescendants: z.boolean().default(false),
  })
  .strict();

const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional()
  .default(false);

export const folderTreeQuerySchema = z.object({
  workspace: workspaceQuerySchema,
  rootId: uuidSchema.optional(),
  ownerUserId: uuidSchema.optional(),
  deleted: booleanQuerySchema,
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type MoveFolderInput = z.infer<typeof moveFolderSchema>;
export type FolderTreeQuery = z.infer<typeof folderTreeQuerySchema>;
