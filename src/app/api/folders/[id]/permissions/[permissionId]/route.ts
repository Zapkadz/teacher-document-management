import { z } from "zod";

import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import {
  deleteFolderPermission,
  updateFolderPermission,
} from "@/modules/permissions/permission.service";
import { updateFolderPermissionSchema } from "@/modules/permissions/permission.validation";

const idSchema = z.uuid();

type RouteContext = {
  params: Promise<{ id: string; permissionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const params = await context.params;
    const folderId = idSchema.parse(params.id);
    const permissionId = idSchema.parse(params.permissionId);
    const input = updateFolderPermissionSchema.parse(await request.json());
    return Response.json(
      await updateFolderPermission(folderId, permissionId, input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const params = await context.params;
    const folderId = idSchema.parse(params.id);
    const permissionId = idSchema.parse(params.permissionId);
    return Response.json(
      await deleteFolderPermission(folderId, permissionId, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
