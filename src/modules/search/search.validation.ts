import { z } from "zod";

export const SEARCH_FILE_TYPES = [
  "file",
  "word",
  "excel",
  "pdf",
  "powerpoint",
  "image",
  "google_drive",
  "youtube",
] as const;

export const searchSchema = z
  .object({
    q: z.string().trim().min(2).max(100),
    type: z.enum(["document", "folder", "all"]).default("all"),
    fileType: z.enum(SEARCH_FILE_TYPES).optional(),
    academicYearId: z.uuid().optional(),
    ownerUserId: z.uuid().optional(),
    folderId: z.uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine(
    ({ from, to }) => from === undefined || to === undefined || from <= to,
    {
      message: "Ngày bắt đầu phải trước ngày kết thúc",
      path: ["to"],
    },
  );

export type SearchQuery = z.infer<typeof searchSchema>;
