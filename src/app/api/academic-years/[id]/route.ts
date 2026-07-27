import { toErrorResponse } from "@/lib/errors/app-error";
import { requireAdmin } from "@/modules/auth/auth.guard";
import { updateAcademicYear } from "@/modules/academic-years/academic-year.service";
import { updateAcademicYearSchema } from "@/modules/academic-years/academic-year.validation";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/academic-years/[id]">,
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const input = updateAcademicYearSchema.parse(await request.json());
    return Response.json(
      await updateAcademicYear(id, input, {
        id: admin.id,
        globalRole: admin.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
