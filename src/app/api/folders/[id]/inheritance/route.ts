import { z } from "zod";

import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { updateFolderInheritance } from "@/modules/permissions/permission.service";
import { updateFolderInheritanceSchema } from "@/modules/permissions/permission.validation";

const idSchema = z.uuid("ID thư mục không hợp lệ");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const id = idSchema.parse((await context.params).id);
    const input = updateFolderInheritanceSchema.parse(await request.json());
    return Response.json(
      await updateFolderInheritance(id, input.inheritPermissions, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
