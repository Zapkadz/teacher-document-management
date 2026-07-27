import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { PrismaClient } from "../src/generated/prisma/client";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  INITIAL_ADMIN_EMAIL: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  INITIAL_ADMIN_NAME: z.string().trim().min(2).max(255),
});

const env = envSchema.parse(process.env);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

async function main() {
  await prisma.$transaction(async (tx) => {
    const admin = await tx.user.upsert({
      where: { email: env.INITIAL_ADMIN_EMAIL },
      create: {
        email: env.INITIAL_ADMIN_EMAIL,
        name: env.INITIAL_ADMIN_NAME,
        globalRole: "ADMIN",
        status: "ACTIVE",
      },
      update: {
        name: env.INITIAL_ADMIN_NAME,
        globalRole: "ADMIN",
        status: "ACTIVE",
      },
      select: {
        id: true,
        personalWorkspace: { select: { id: true } },
      },
    });

    if (!admin.personalWorkspace) {
      const root = await tx.folder.create({
        data: {
          name: "Kho của tôi",
          workspaceType: "PERSONAL",
          ownerUserId: admin.id,
          createdBy: admin.id,
        },
      });

      await tx.personalWorkspace.create({
        data: {
          ownerUserId: admin.id,
          rootFolderId: root.id,
        },
      });
    }

    let activeYear = await tx.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    if (!activeYear) {
      const now = new Date();
      const startYear =
        now.getUTCMonth() >= 6
          ? now.getUTCFullYear()
          : now.getUTCFullYear() - 1;
      const name = `${startYear}-${startYear + 1}`;
      activeYear = await tx.academicYear.upsert({
        where: { name },
        create: {
          name,
          startsOn: new Date(Date.UTC(startYear, 7, 1)),
          endsOn: new Date(Date.UTC(startYear + 1, 4, 31)),
          isActive: true,
        },
        update: { isActive: true },
        select: { id: true, name: true },
      });
    }

    const sharedRoot = await tx.folder.findFirst({
      where: {
        workspaceType: "SHARED",
        parentId: null,
        deletedAt: null,
        academicYearId: activeYear.id,
      },
      select: { id: true },
    });

    if (!sharedRoot) {
      const root = await tx.folder.create({
        data: {
          name: "Kho dùng chung",
          workspaceType: "SHARED",
          academicYearId: activeYear.id,
          createdBy: admin.id,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          action: "SHARED_ROOT_CREATED",
          actorUserId: admin.id,
          entityType: "FOLDER",
          entityId: root.id,
          folderId: root.id,
          metadata: { name: "Kho dùng chung" },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "INITIAL_ADMIN_SEEDED",
        entityType: "USER",
        entityId: admin.id,
        metadata: { email: env.INITIAL_ADMIN_EMAIL },
      },
    });
  });

  console.log(`Initial admin is ready: ${env.INITIAL_ADMIN_EMAIL}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
