import { randomUUID } from "node:crypto";

import { PrismaAdapter } from "@auth/prisma-adapter";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/lib/db/prisma";
import { createUser } from "@/modules/users/user.service";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)("Auth.js Prisma adapter", () => {
  const prisma = getPrismaClient();
  const adapter = PrismaAdapter(
    prisma as unknown as Parameters<typeof PrismaAdapter>[0],
  );
  const suffix = randomUUID();
  const providerAccountId = `google-${suffix}`;
  let userId: string;

  beforeAll(async () => {
    const user = await createUser(
      {
        email: `adapter-${suffix}@example.com`,
        fullName: "Adapter Test",
        globalRole: "USER",
        status: "ACTIVE",
      },
      null,
    );
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ actorUserId: userId }, { entityId: userId }],
      },
    });
    await prisma.personalWorkspace.deleteMany({
      where: { ownerUserId: userId },
    });
    await prisma.folder.deleteMany({ where: { ownerUserId: userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("persists the snake_case OAuth token fields used by Auth.js", async () => {
    await adapter.linkAccount!({
      userId,
      type: "oidc",
      provider: "google",
      providerAccountId,
      access_token: "test-access-token",
      id_token: "test-id-token",
      expires_at: 2_000_000_000,
      token_type: "bearer",
      scope: "openid profile email",
    });

    const account = await prisma.account.findUniqueOrThrow({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId,
        },
      },
    });

    expect(account.userId).toBe(userId);
    expect(account.access_token).toBe("test-access-token");
    expect(account.id_token).toBe("test-id-token");
  });
});
