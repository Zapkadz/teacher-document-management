import { z } from "zod";

import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { setFolderLock } from "@/modules/folders/folder-lock.service";
import { lockFolderSchema } from "@/modules/folders/folder.validation";

const idSchema = z.uuid("ID thư mục không hợp lệ");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const id = idSchema.parse((await context.params).id);
    const input = lockFolderSchema.parse(await request.json());
    return Response.json(
      await setFolderLock(id, input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
