import { z } from "zod";

import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { restoreFolder } from "@/modules/folders/folder.service";

const idSchema = z.uuid("ID thư mục không hợp lệ");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const id = idSchema.parse((await context.params).id);

    return Response.json(
      await restoreFolder(id, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
