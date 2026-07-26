import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { purgeTrashItems } from "@/modules/documents/document.service";
import { purgeTrashSchema } from "@/modules/documents/document.validation";

export async function DELETE(request: Request) {
  try {
    const user = await requireActiveUser();
    const input = purgeTrashSchema.parse(await request.json());
    return Response.json(
      await purgeTrashItems(input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
