import { getPrismaClient } from "@/lib/db/prisma";
import { getHealthStatus } from "@/modules/health/health.service";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const result = await getHealthStatus(async () => {
    await getPrismaClient().$queryRaw`SELECT 1`;
  });

  return Response.json(result.body, {
    status: result.httpStatus,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
