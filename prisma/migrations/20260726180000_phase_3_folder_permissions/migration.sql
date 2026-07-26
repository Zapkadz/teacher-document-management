CREATE TABLE "groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "group_members" (
  "group_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id", "user_id")
);

CREATE TABLE "folder_permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "folder_id" UUID NOT NULL,
  "principal_type" VARCHAR(10) NOT NULL,
  "user_id" UUID,
  "group_id" UUID,
  "permissions" JSONB NOT NULL DEFAULT '[]',
  "applies_to_descendants" BOOLEAN NOT NULL DEFAULT true,
  "granted_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "folder_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "folder_permissions_principal_type_check"
    CHECK ("principal_type" IN ('USER', 'GROUP')),
  CONSTRAINT "folder_permissions_principal_check"
    CHECK (
      ("principal_type" = 'USER' AND "user_id" IS NOT NULL AND "group_id" IS NULL)
      OR
      ("principal_type" = 'GROUP' AND "group_id" IS NOT NULL AND "user_id" IS NULL)
    ),
  CONSTRAINT "folder_permissions_nonempty_check"
    CHECK (
      jsonb_typeof("permissions") = 'array'
      AND jsonb_array_length("permissions") > 0
    )
);

CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");
CREATE INDEX "group_members_user_id_group_id_idx"
  ON "group_members"("user_id", "group_id");
CREATE INDEX "folder_permissions_folder_id_principal_type_idx"
  ON "folder_permissions"("folder_id", "principal_type");
CREATE INDEX "folder_permissions_user_id_folder_id_idx"
  ON "folder_permissions"("user_id", "folder_id");
CREATE INDEX "folder_permissions_group_id_folder_id_idx"
  ON "folder_permissions"("group_id", "folder_id");
CREATE UNIQUE INDEX "folder_permissions_folder_user_key"
  ON "folder_permissions"("folder_id", "user_id")
  WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "folder_permissions_folder_group_key"
  ON "folder_permissions"("folder_id", "group_id")
  WHERE "group_id" IS NOT NULL;

ALTER TABLE "groups"
  ADD CONSTRAINT "groups_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "group_members"
  ADD CONSTRAINT "group_members_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_members"
  ADD CONSTRAINT "group_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "folder_permissions"
  ADD CONSTRAINT "folder_permissions_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "folders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "folder_permissions"
  ADD CONSTRAINT "folder_permissions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "folder_permissions"
  ADD CONSTRAINT "folder_permissions_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "folder_permissions"
  ADD CONSTRAINT "folder_permissions_granted_by_fkey"
  FOREIGN KEY ("granted_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
