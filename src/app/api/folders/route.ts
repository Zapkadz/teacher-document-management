import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { createFolder } from "@/modules/folders/folder.service";
import { createFolderSchema } from "@/modules/folders/folder.validation";

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser();
    const input = createFolderSchema.parse(await request.json());

    return Response.json(
      await createFolder(input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
