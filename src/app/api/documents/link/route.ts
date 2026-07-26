import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { createLinkDocument } from "@/modules/documents/document.service";
import { createLinkSchema } from "@/modules/documents/document.validation";

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser();
    const input = createLinkSchema.parse(await request.json());
    return Response.json(
      await createLinkDocument(input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
