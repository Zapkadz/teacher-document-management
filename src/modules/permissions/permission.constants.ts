export const PERMISSIONS = [
  "VIEW",
  "PREVIEW",
  "DOWNLOAD",
  "UPLOAD",
  "CREATE_SUBFOLDER",
  "EDIT_OWN",
  "DELETE_OWN",
  "MOVE_OWN",
  "EDIT_ANY",
  "DELETE_ANY",
  "MOVE_ANY",
  "LOCK_FOLDER",
  "MANAGE_PERMISSIONS",
  "VIEW_AUDIT",
  "RESTORE",
  "PURGE",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const GRANTABLE_PERMISSIONS = PERMISSIONS.filter(
  (permission) => permission !== "PURGE",
);

export const PERMISSION_PRESETS = {
  VIEWER: ["VIEW", "PREVIEW"],
  VIEW_DOWNLOAD: ["VIEW", "PREVIEW", "DOWNLOAD"],
  CONTRIBUTOR: [
    "VIEW",
    "PREVIEW",
    "DOWNLOAD",
    "UPLOAD",
    "CREATE_SUBFOLDER",
    "EDIT_OWN",
    "DELETE_OWN",
    "MOVE_OWN",
  ],
  CONTENT_MANAGER: [
    "VIEW",
    "PREVIEW",
    "DOWNLOAD",
    "UPLOAD",
    "CREATE_SUBFOLDER",
    "EDIT_OWN",
    "DELETE_OWN",
    "MOVE_OWN",
    "EDIT_ANY",
    "DELETE_ANY",
    "MOVE_ANY",
    "LOCK_FOLDER",
    "RESTORE",
    "VIEW_AUDIT",
  ],
  FOLDER_MANAGER: GRANTABLE_PERMISSIONS,
} as const satisfies Record<string, readonly Permission[]>;

export const PERSONAL_OWNER_PERMISSIONS = new Set<Permission>(
  PERMISSION_PRESETS.CONTENT_MANAGER,
);

const VIEW_DEPENDENCIES = new Set<Permission>([
  "PREVIEW",
  "DOWNLOAD",
  "EDIT_OWN",
  "DELETE_OWN",
  "MOVE_OWN",
  "EDIT_ANY",
  "DELETE_ANY",
  "MOVE_ANY",
  "MANAGE_PERMISSIONS",
]);

export function isPermission(value: unknown): value is Permission {
  return (
    typeof value === "string" &&
    (PERMISSIONS as readonly string[]).includes(value)
  );
}

export function normalizePermissions(
  permissions: readonly Permission[],
): Permission[] {
  const normalized = new Set<Permission>(permissions);

  if ([...normalized].some((permission) => VIEW_DEPENDENCIES.has(permission))) {
    normalized.add("VIEW");
  }

  return PERMISSIONS.filter((permission) => normalized.has(permission));
}
