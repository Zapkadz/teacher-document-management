import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";

import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from "./user.validation";

const userSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  globalRole: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  personalWorkspace: {
    select: {
      id: true,
      rootFolderId: true,
    },
  },
} satisfies Prisma.UserSelect;

type UserRecord = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export type UserDto = ReturnType<typeof toUserDto>;

function toUserDto(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.name,
    avatarUrl: user.image,
    globalRole: user.globalRole,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    personalWorkspace: user.personalWorkspace,
  };
}

export async function createUser(
  input: CreateUserInput,
  actorUserId: string | null,
): Promise<UserDto> {
  const prisma = getPrismaClient();

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (existing) {
        throw new AppError(
          "EMAIL_ALREADY_EXISTS",
          "Email đã được cấp tài khoản",
          409,
        );
      }

      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.fullName,
          globalRole: input.globalRole,
          status: input.status,
        },
        select: { id: true },
      });

      const rootFolder = await tx.folder.create({
        data: {
          name: "Kho của tôi",
          workspaceType: "PERSONAL",
          ownerUserId: user.id,
          createdBy: user.id,
        },
        select: { id: true },
      });

      await tx.personalWorkspace.create({
        data: {
          ownerUserId: user.id,
          rootFolderId: rootFolder.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "USER_CREATED",
          entityType: "USER",
          entityId: user.id,
          metadata: {
            email: input.email,
            globalRole: input.globalRole,
            status: input.status,
          },
        },
      });

      const created = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: userSelect,
      });

      return toUserDto(created);
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "EMAIL_ALREADY_EXISTS",
        "Email đã được cấp tài khoản",
        409,
      );
    }

    throw error;
  }
}

export async function listUsers(query: ListUsersQuery) {
  const prisma = getPrismaClient();
  const where: Prisma.UserWhereInput = {
    status: query.status,
    globalRole: query.role,
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: "insensitive" } },
            { name: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [records, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: records.map(toUserDto),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getUserById(id: string): Promise<UserDto> {
  const user = await getPrismaClient().user.findUnique({
    where: { id },
    select: userSelect,
  });

  if (!user) {
    throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
  }

  return toUserDto(user);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actorUserId: string,
): Promise<UserDto> {
  return getPrismaClient().$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        globalRole: true,
        status: true,
      },
    });

    if (!current) {
      throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
    }

    const removesActiveAdmin =
      current.globalRole === "ADMIN" &&
      current.status === "ACTIVE" &&
      (input.globalRole === "USER" ||
        (input.status !== undefined && input.status !== "ACTIVE"));

    if (removesActiveAdmin) {
      const activeAdminCount = await tx.user.count({
        where: { globalRole: "ADMIN", status: "ACTIVE" },
      });

      if (activeAdminCount <= 1) {
        throw new AppError(
          "LAST_ACTIVE_ADMIN",
          "Không thể vô hiệu hóa quản trị viên ACTIVE cuối cùng",
          409,
        );
      }
    }

    const updated = await tx.user.update({
      where: { id },
      data: {
        name: input.fullName,
        globalRole: input.globalRole,
        status: input.status,
      },
      select: userSelect,
    });

    const changes: Record<string, { from: string | null; to: string | null }> =
      {};

    if (input.fullName !== undefined && input.fullName !== current.name) {
      changes.fullName = { from: current.name, to: input.fullName };
    }
    if (
      input.globalRole !== undefined &&
      input.globalRole !== current.globalRole
    ) {
      changes.globalRole = {
        from: current.globalRole,
        to: input.globalRole,
      };
    }
    if (input.status !== undefined && input.status !== current.status) {
      changes.status = { from: current.status, to: input.status };
    }

    if (Object.keys(changes).length > 0) {
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "USER_UPDATED",
          entityType: "USER",
          entityId: id,
          metadata: { changes },
        },
      });
    }

    return toUserDto(updated);
  });
}
