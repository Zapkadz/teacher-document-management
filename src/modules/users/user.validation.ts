import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Email không hợp lệ")
  .max(320)
  .transform((value) => value.toLowerCase());

export const userStatusSchema = z.enum([
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "INACTIVE",
]);

export const globalRoleSchema = z.enum(["ADMIN", "USER"]);

export const createUserSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(2).max(255),
  globalRole: globalRoleSchema.default("USER"),
  status: userStatusSchema.default("ACTIVE"),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(255).optional(),
    globalRole: globalRoleSchema.optional(),
    status: userStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần có ít nhất một trường để cập nhật",
  });

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  status: userStatusSchema.optional(),
  role: globalRoleSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
