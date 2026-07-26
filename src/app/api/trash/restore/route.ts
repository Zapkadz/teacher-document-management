import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { restoreTrashItems } from "@/modules/documents/document.service";
import { restoreTrashSchema } from "@/modules/documents/document.validation";

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser();
    const input = restoreTrashSchema.parse(await request.json());
    return Response.json(
      await restoreTrashItems(input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
