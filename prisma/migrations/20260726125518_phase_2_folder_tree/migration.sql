-- AlterTable
ALTER TABLE "folders" ADD COLUMN     "deletion_batch_id" UUID;

-- CreateIndex
CREATE INDEX "folders_deletion_batch_id_idx" ON "folders"("deletion_batch_id");

-- Folder invariants that Prisma cannot express in the schema.
ALTER TABLE "folders"
ADD CONSTRAINT "folders_parent_not_self_check"
CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

ALTER TABLE "folders"
ADD CONSTRAINT "folders_workspace_owner_check"
CHECK (
  ("workspace_type" = 'PERSONAL' AND "owner_user_id" IS NOT NULL)
  OR
  ("workspace_type" = 'SHARED' AND "owner_user_id" IS NULL)
);

ALTER TABLE "folders"
ADD CONSTRAINT "folders_name_not_blank_check"
CHECK (char_length(btrim("name")) > 0);

CREATE UNIQUE INDEX "folders_active_sibling_name_key"
ON "folders" ("parent_id", lower(btrim("name")))
WHERE "deleted_at" IS NULL AND "parent_id" IS NOT NULL;

CREATE UNIQUE INDEX "folders_active_personal_root_owner_key"
ON "folders" ("owner_user_id")
WHERE
  "workspace_type" = 'PERSONAL'
  AND "parent_id" IS NULL
  AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "folders_single_active_shared_root_key"
ON "folders" ("workspace_type")
WHERE
  "workspace_type" = 'SHARED'
  AND "parent_id" IS NULL
  AND "deleted_at" IS NULL;
