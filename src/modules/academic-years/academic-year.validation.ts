import { z } from "zod";

const academicYearNameSchema = z.string().trim().min(3).max(100);
const dateSchema = z.iso
  .date()
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

function datesAreValid(value: {
  startsOn?: Date | null;
  endsOn?: Date | null;
}) {
  return (
    value.startsOn === undefined ||
    value.startsOn === null ||
    value.endsOn === undefined ||
    value.endsOn === null ||
    value.startsOn <= value.endsOn
  );
}

export const createAcademicYearSchema = z
  .object({
    name: academicYearNameSchema,
    startsOn: dateSchema.nullable().optional(),
    endsOn: dateSchema.nullable().optional(),
    isActive: z.boolean().default(false),
  })
  .refine(datesAreValid, {
    message: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc",
    path: ["endsOn"],
  });

export const updateAcademicYearSchema = z
  .object({
    name: academicYearNameSchema.optional(),
    startsOn: dateSchema.nullable().optional(),
    endsOn: dateSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần có ít nhất một trường để cập nhật",
  })
  .refine(datesAreValid, {
    message: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc",
    path: ["endsOn"],
  });

export const academicYearFolderOptionsQuerySchema = z.object({
  purpose: z.enum(["source", "target"]).default("source"),
});

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
