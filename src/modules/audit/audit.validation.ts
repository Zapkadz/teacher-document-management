import { z } from "zod";

const auditCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Mã audit không hợp lệ");

export const listAuditLogsSchema = z
  .object({
    folderId: z.uuid().optional(),
    actorUserId: z.uuid().optional(),
    action: auditCodeSchema.optional(),
    entityType: auditCodeSchema.max(50).optional(),
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

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>;
