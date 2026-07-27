import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { searchMetadata } from "@/modules/search/search.service";
import { searchSchema } from "@/modules/search/search.validation";

export async function GET(request: Request) {
  try {
    const user = await requireActiveUser();
    const url = new URL(request.url);
    const query = searchSchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    return Response.json(
      await searchMetadata(query, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
