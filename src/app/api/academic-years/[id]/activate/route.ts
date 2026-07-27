import { toErrorResponse } from "@/lib/errors/app-error";
import { requireAdmin } from "@/modules/auth/auth.guard";
import { activateAcademicYear } from "@/modules/academic-years/academic-year.service";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/academic-years/[id]/activate">,
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    return Response.json(
      await activateAcademicYear(id, {
        id: admin.id,
        globalRole: admin.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
