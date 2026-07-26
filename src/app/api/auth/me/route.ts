import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";

export async function GET() {
  try {
    const user = await requireActiveUser();

    return Response.json({
      data: {
        id: user.id,
        email: user.email,
        fullName: user.name,
        avatarUrl: user.image,
        globalRole: user.globalRole,
        status: user.status,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
