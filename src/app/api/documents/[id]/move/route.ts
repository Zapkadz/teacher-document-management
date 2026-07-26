import { z } from "zod";

import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { moveDocument } from "@/modules/documents/document.service";
import { moveDocumentSchema } from "@/modules/documents/document.validation";

const idSchema = z.uuid("ID tài liệu không hợp lệ");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const id = idSchema.parse((await context.params).id);
    const input = moveDocumentSchema.parse(await request.json());
    return Response.json(
      await moveDocument(id, input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
