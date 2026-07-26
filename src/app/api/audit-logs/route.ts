import { toErrorResponse } from "@/lib/errors/app-error";
import { requireActiveUser } from "@/modules/auth/auth.guard";
import { listAuditLogs } from "@/modules/audit/audit.service";
import { listAuditLogsSchema } from "@/modules/audit/audit.validation";

export async function GET(request: Request) {
  try {
    const user = await requireActiveUser();
    const url = new URL(request.url);
    const query = listAuditLogsSchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    return Response.json(
      await listAuditLogs(query, {
        id: user.id,
        globalRole: user.globalRole,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
