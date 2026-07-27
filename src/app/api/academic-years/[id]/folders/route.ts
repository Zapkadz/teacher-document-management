import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { listAcademicYearFolderOptions } from "@/modules/academic-years/academic-year.service";
import { academicYearFolderOptionsQuerySchema } from "@/modules/academic-years/academic-year.validation";

export async function GET(
  request: Request,
  context: RouteContext<"/api/academic-years/[id]/folders">,
) {
  try {
    const user = await requireActiveUser();
    const { id } = await context.params;
    const url = new URL(request.url);
    const query = academicYearFolderOptionsQuerySchema.parse(
      Object.fromEntries(url.searchParams),
    );
    return Response.json(
      await listAcademicYearFolderOptions(id, query.purpose, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
