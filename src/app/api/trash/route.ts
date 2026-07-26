import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { listTrash } from "@/modules/documents/document.service";
import { trashQuerySchema } from "@/modules/documents/document.validation";

export async function GET(request: Request) {
  try {
    const user = await requireActiveUser();
    const url = new URL(request.url);
    const query = trashQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    return Response.json(
      await listTrash(query, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
