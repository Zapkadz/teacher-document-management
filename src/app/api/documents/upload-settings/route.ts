import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { getFileRules } from "@/modules/documents/document.validation";

export async function GET() {
  try {
    await requireActiveUser();
    const rules = getFileRules();
    return Response.json({
      data: {
        maxSizeMb: rules.maxSizeMb,
        maxSizeBytes: rules.maxSizeBytes,
        allowedExtensions: [...rules.allowedExtensions],
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
