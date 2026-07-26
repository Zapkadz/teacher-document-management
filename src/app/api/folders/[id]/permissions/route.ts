import { z } from "zod";

import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import {
  createFolderPermissions,
  listFolderPermissions,
} from "@/modules/permissions/permission.service";
import { createFolderPermissionSchema } from "@/modules/permissions/permission.validation";

const idSchema = z.uuid("ID thư mục không hợp lệ");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const id = idSchema.parse((await context.params).id);
    return Response.json(
      await listFolderPermissions(id, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const id = idSchema.parse((await context.params).id);
    const input = createFolderPermissionSchema.parse(await request.json());
    return Response.json(
      await createFolderPermissions(id, input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
