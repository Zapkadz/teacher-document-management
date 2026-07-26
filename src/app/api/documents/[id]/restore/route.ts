import { z } from "zod";

import { AppError, toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { restoreDocument } from "@/modules/documents/document.service";
import { restoreDocumentSchema } from "@/modules/documents/document.validation";

const idSchema = z.uuid("ID tài liệu không hợp lệ");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const id = idSchema.parse((await context.params).id);
    const body = await request.text();
    let payload: unknown = {};
    if (body) {
      try {
        payload = JSON.parse(body);
      } catch {
        throw new AppError("VALIDATION_ERROR", "JSON không hợp lệ", 400);
      }
    }
    const input = restoreDocumentSchema.parse(payload);
    return Response.json(
      await restoreDocument(id, input, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
