import { toErrorResponse } from "@/lib/errors/app-error";
import { requireAdmin } from "@/modules/auth/auth.guard";
import { createUser, listUsers } from "@/modules/users/user.service";
import {
  createUserSchema,
  listUsersQuerySchema,
} from "@/modules/users/user.validation";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const query = listUsersQuerySchema.parse(
      Object.fromEntries(url.searchParams),
    );

    return Response.json(await listUsers(query));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = createUserSchema.parse(await request.json());
    const user = await createUser(input, admin.id);

    return Response.json({ data: user }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
