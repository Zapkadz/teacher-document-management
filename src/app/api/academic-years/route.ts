import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser, requireAdmin } from "@/modules/auth/auth.guard";
import {
  createAcademicYear,
  listAcademicYears,
} from "@/modules/academic-years/academic-year.service";
import { createAcademicYearSchema } from "@/modules/academic-years/academic-year.validation";

export async function GET() {
  try {
    await requireActiveUser();
    return Response.json(await listAcademicYears());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = createAcademicYearSchema.parse(await request.json());
    const result = await createAcademicYear(input, {
      id: admin.id,
      globalRole: admin.globalRole,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
