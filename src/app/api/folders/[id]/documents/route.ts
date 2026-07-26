import { z } from "zod";

import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { listDocuments } from "@/modules/documents/document.service";
import { listDocumentsSchema } from "@/modules/documents/document.validation";

const idSchema = z.uuid("ID thư mục không hợp lệ");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireActiveUser();
    const folderId = idSchema.parse((await context.params).id);
    const url = new URL(request.url);
    const query = listDocumentsSchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    return Response.json(
      await listDocuments(folderId, query, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
