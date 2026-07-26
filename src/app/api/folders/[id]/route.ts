import { z } from "zod";

import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import {
  getFolderDetails,
  renameFolder,
  softDeleteFolder,
} from "@/modules/folders/folder.service";
import { renameFolderSchema } from "@/modules/folders/folder.validation";

const idSchema = z.uuid("ID thư mục không hợp lệ");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const id = idSchema.parse((await context.params).id);

    return Response.json(
      await getFolderDetails(id, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const id = idSchema.parse((await context.params).id);
    const input = renameFolderSchema.parse(await request.json());

    return Response.json(
      await renameFolder(id, input.name, {
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
    const id = idSchema.parse((await context.params).id);

    return Response.json(
      await softDeleteFolder(id, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
