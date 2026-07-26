import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { initializeUpload } from "@/modules/documents/document.service";
import { uploadInitSchema } from "@/modules/documents/document.validation";

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser();
    const input = uploadInitSchema.parse(await request.json());
    return Response.json(
      await initializeUpload(input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
