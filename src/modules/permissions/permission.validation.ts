import { z } from "zod";

import { GRANTABLE_PERMISSIONS } from "./permission.constants";

const permissionSchema = z.enum(GRANTABLE_PERMISSIONS);

export const createFolderPermissionSchema = z.object({
  principalType: z.enum(["USER", "GROUP"]),
  principalIds: z.array(z.uuid()).min(1).max(100),
  permissions: z.array(permissionSchema).min(1),
  appliesToDescendants: z.boolean().default(true),
});

export const updateFolderPermissionSchema = z
  .object({
    permissions: z.array(permissionSchema).min(1).optional(),
    appliesToDescendants: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.permissions !== undefined ||
      input.appliesToDescendants !== undefined,
    { message: "Cần có ít nhất một thay đổi" },
  );

export const updateFolderInheritanceSchema = z.object({
  inheritPermissions: z.boolean(),
});

export type CreateFolderPermissionInput = z.infer<
  typeof createFolderPermissionSchema
>;
export type UpdateFolderPermissionInput = z.infer<
  typeof updateFolderPermissionSchema
>;
