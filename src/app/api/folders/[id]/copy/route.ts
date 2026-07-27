import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { copyFolderStructure } from "@/modules/folders/folder-copy.service";
import { copyFolderSchema } from "@/modules/folders/folder.validation";

export async function POST(
  request: Request,
  context: RouteContext<"/api/folders/[id]/copy">,
) {
  try {
    const user = await requireActiveUser();
    const { id } = await context.params;
    const input = copyFolderSchema.parse(await request.json());
    return Response.json(
      await copyFolderStructure(id, input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
