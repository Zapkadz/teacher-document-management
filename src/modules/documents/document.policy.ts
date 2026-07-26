import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors/app-error";
import type { Permission } from "@/modules/permissions/permission.constants";
import {
  type PermissionActor,
  getEffectivePermissions,
} from "@/modules/permissions/permission.engine";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type OwnershipAction = "EDIT" | "MOVE" | "DELETE";

const actionPermissions: Record<
  OwnershipAction,
  { own: Permission; any: Permission }
> = {
  EDIT: { own: "EDIT_OWN", any: "EDIT_ANY" },
  MOVE: { own: "MOVE_OWN", any: "MOVE_ANY" },
  DELETE: { own: "DELETE_OWN", any: "DELETE_ANY" },
};

export function canMutateDocument(
  action: OwnershipAction,
  actorId: string,
  ownerUserId: string,
  permissions: readonly string[],
): boolean {
  const required = actionPermissions[action];
  return (
    permissions.includes(required.any) ||
    (actorId === ownerUserId && permissions.includes(required.own))
  );
}

export async function assertDocumentMutationPermission(
  action: OwnershipAction,
  actor: PermissionActor,
  folderId: string,
  ownerUserId: string,
  database: DatabaseClient,
) {
  const effective = await getEffectivePermissions(actor, folderId, database);
  if (
    !canMutateDocument(action, actor.id, ownerUserId, effective.permissions)
  ) {
    throw new AppError(
      "FORBIDDEN",
      "Bạn không có quyền thực hiện thao tác này trên tài liệu",
      403,
    );
  }
  return effective;
}
