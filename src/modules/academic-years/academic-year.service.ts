import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  type PermissionActor,
  getEffectivePermissionsForFolders,
} from "@/modules/permissions/permission.engine";

import type {
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from "./academic-year.validation";

const academicYearSelect = {
  id: true,
  name: true,
  startsOn: true,
  endsOn: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  folders: {
    where: {
      workspaceType: "SHARED" as const,
      parentId: null,
      deletedAt: null,
    },
    select: { id: true, name: true },
    take: 1,
  },
  _count: {
    select: {
      folders: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.AcademicYearSelect;

function assertAdmin(actor: PermissionActor) {
  if (actor.globalRole !== "ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Chỉ quản trị viên được quản lý năm học",
      403,
    );
  }
}

function toAcademicYearDto(
  record: Prisma.AcademicYearGetPayload<{
    select: typeof academicYearSelect;
  }>,
) {
  return {
    id: record.id,
    name: record.name,
    startsOn: record.startsOn,
    endsOn: record.endsOn,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    rootFolder: record.folders[0] ?? null,
    folderCount: record._count.folders,
  };
}

function handleAcademicYearConflict(error: unknown): never {
  if (error instanceof AppError) throw error;

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    throw new AppError("ACADEMIC_YEAR_CONFLICT", "Tên năm học đã tồn tại", 409);
  }

  throw error;
}

export async function listAcademicYears() {
  const records = await getPrismaClient().academicYear.findMany({
    select: academicYearSelect,
    orderBy: [{ isActive: "desc" }, { startsOn: "desc" }, { name: "desc" }],
  });

  return { data: records.map(toAcademicYearDto) };
}

export async function createAcademicYear(
  input: CreateAcademicYearInput,
  actor: PermissionActor,
) {
  assertAdmin(actor);
  const prisma = getPrismaClient();

  try {
    return await prisma.$transaction(async (tx) => {
      const yearCount = await tx.academicYear.count();
      const isActive = input.isActive || yearCount === 0;

      if (isActive) {
        await tx.academicYear.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      const year = await tx.academicYear.create({
        data: {
          name: input.name,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          isActive,
        },
        select: { id: true },
      });
      const root = await tx.folder.create({
        data: {
          name: `Kho dùng chung · ${input.name}`,
          workspaceType: "SHARED",
          academicYearId: year.id,
          createdBy: actor.id,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "ACADEMIC_YEAR_CREATED",
          entityType: "ACADEMIC_YEAR",
          entityId: year.id,
          folderId: root.id,
          metadata: {
            name: input.name,
            startsOn: input.startsOn?.toISOString() ?? null,
            endsOn: input.endsOn?.toISOString() ?? null,
            isActive,
            rootFolderId: root.id,
          },
        },
      });

      const created = await tx.academicYear.findUniqueOrThrow({
        where: { id: year.id },
        select: academicYearSelect,
      });
      return { data: toAcademicYearDto(created) };
    });
  } catch (error) {
    handleAcademicYearConflict(error);
  }
}

export async function updateAcademicYear(
  id: string,
  input: UpdateAcademicYearInput,
  actor: PermissionActor,
) {
  assertAdmin(actor);
  const prisma = getPrismaClient();

  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.academicYear.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          startsOn: true,
          endsOn: true,
          folders: {
            where: {
              workspaceType: "SHARED",
              parentId: null,
              deletedAt: null,
            },
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!current) {
        throw new AppError(
          "ACADEMIC_YEAR_NOT_FOUND",
          "Không tìm thấy năm học",
          404,
        );
      }

      const startsOn =
        input.startsOn === undefined ? current.startsOn : input.startsOn;
      const endsOn = input.endsOn === undefined ? current.endsOn : input.endsOn;
      if (startsOn && endsOn && startsOn > endsOn) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc",
          400,
        );
      }

      await tx.academicYear.update({
        where: { id },
        data: input,
      });

      if (input.name && input.name !== current.name && current.folders[0]) {
        await tx.folder.update({
          where: { id: current.folders[0].id },
          data: { name: `Kho dùng chung · ${input.name}` },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "ACADEMIC_YEAR_UPDATED",
          entityType: "ACADEMIC_YEAR",
          entityId: id,
          folderId: current.folders[0]?.id,
          metadata: {
            before: {
              name: current.name,
              startsOn: current.startsOn?.toISOString() ?? null,
              endsOn: current.endsOn?.toISOString() ?? null,
            },
            after: {
              name: input.name ?? current.name,
              startsOn: startsOn?.toISOString() ?? null,
              endsOn: endsOn?.toISOString() ?? null,
            },
          },
        },
      });

      const updated = await tx.academicYear.findUniqueOrThrow({
        where: { id },
        select: academicYearSelect,
      });
      return { data: toAcademicYearDto(updated) };
    });
  } catch (error) {
    handleAcademicYearConflict(error);
  }
}

export async function activateAcademicYear(id: string, actor: PermissionActor) {
  assertAdmin(actor);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const year = await tx.academicYear.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        folders: {
          where: {
            workspaceType: "SHARED",
            parentId: null,
            deletedAt: null,
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!year) {
      throw new AppError(
        "ACADEMIC_YEAR_NOT_FOUND",
        "Không tìm thấy năm học",
        404,
      );
    }

    if (!year.isActive) {
      await tx.academicYear.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      await tx.academicYear.update({
        where: { id },
        data: { isActive: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "ACADEMIC_YEAR_ACTIVATED",
          entityType: "ACADEMIC_YEAR",
          entityId: id,
          folderId: year.folders[0]?.id,
          metadata: { name: year.name },
        },
      });
    }

    const updated = await tx.academicYear.findUniqueOrThrow({
      where: { id },
      select: academicYearSelect,
    });
    return { data: toAcademicYearDto(updated) };
  });
}

export async function listAcademicYearFolderOptions(
  academicYearId: string,
  purpose: "source" | "target",
  actor: PermissionActor,
) {
  const prisma = getPrismaClient();
  const year = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { id: true },
  });
  if (!year) {
    throw new AppError(
      "ACADEMIC_YEAR_NOT_FOUND",
      "Không tìm thấy năm học",
      404,
    );
  }

  const folders = await prisma.folder.findMany({
    where: {
      academicYearId,
      workspaceType: "SHARED",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      parentId: true,
      isLocked: true,
      lockDescendants: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const effective = await getEffectivePermissionsForFolders(
    actor,
    folders.map(({ id }) => id),
    prisma,
  );
  const required = purpose === "source" ? "VIEW" : "CREATE_SUBFOLDER";
  const visibleIds = new Set(
    folders
      .filter((folder) =>
        effective.get(folder.id)?.permissions.includes(required),
      )
      .map(({ id }) => id),
  );
  const byId = new Map(folders.map((folder) => [folder.id, folder]));

  function labelFor(folder: (typeof folders)[number]) {
    const names = [folder.name];
    let parentId = folder.parentId;
    let depth = 0;
    while (parentId && depth < 20) {
      const parent = byId.get(parentId);
      if (!parent) break;
      if (visibleIds.has(parent.id)) names.unshift(parent.name);
      parentId = parent.parentId;
      depth += 1;
    }
    return names.join(" / ");
  }

  return {
    data: folders
      .filter(({ id }) => visibleIds.has(id))
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        label: labelFor(folder),
        isSystemRoot: folder.parentId === null,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "vi")),
  };
}
