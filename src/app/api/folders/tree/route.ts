import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { getFolderTree } from "@/modules/folders/folder.service";
import { folderTreeQuerySchema } from "@/modules/folders/folder.validation";

export async function GET(request: Request) {
  try {
    const user = await requireActiveUser();
    const query = folderTreeQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    return Response.json(
      await getFolderTree({ id: user.id, globalRole: user.globalRole }, query),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
