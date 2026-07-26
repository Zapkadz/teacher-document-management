import type { GlobalRole, WorkspaceType } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors/app-error";

export type FolderActor = {
  id: string;
  globalRole: GlobalRole;
};

export type FolderAccessTarget = {
  workspaceType: WorkspaceType;
  ownerUserId: string | null;
};

export function canAccessFolder(
  actor: FolderActor,
  folder: FolderAccessTarget,
): boolean {
  if (actor.globalRole === "ADMIN") {
    return true;
  }

  return folder.workspaceType === "PERSONAL" && folder.ownerUserId === actor.id;
}

export function assertFolderAccess(
  actor: FolderActor,
  folder: FolderAccessTarget,
): void {
  if (!canAccessFolder(actor, folder)) {
    throw new AppError(
      "FORBIDDEN",
      "Bạn không có quyền truy cập thư mục này",
      403,
    );
  }
}

export function assertPersonalOwnerAccess(
  actor: FolderActor,
  ownerUserId: string,
): void {
  if (actor.globalRole !== "ADMIN" && actor.id !== ownerUserId) {
    throw new AppError(
      "FORBIDDEN",
      "Bạn không có quyền truy cập kho cá nhân này",
      403,
    );
  }
}
