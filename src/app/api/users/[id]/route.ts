import { z } from "zod";

import { toErrorResponse } from "@/lib/errors/app-error";
import { requireAdmin } from "@/modules/auth/auth.guard";
import { getUserById, updateUser } from "@/modules/users/user.service";
import { updateUserSchema } from "@/modules/users/user.validation";

const idSchema = z.uuid("ID người dùng không hợp lệ");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const id = idSchema.parse((await context.params).id);

    return Response.json({ data: await getUserById(id) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const id = idSchema.parse((await context.params).id);
    const input = updateUserSchema.parse(await request.json());

    return Response.json({
      data: await updateUser(id, input, admin.id),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
