CREATE TYPE "DocumentKind" AS ENUM (
  'FILE',
  'GOOGLE_DRIVE_LINK',
  'YOUTUBE_LINK'
);

CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "folder_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "document_kind" "DocumentKind" NOT NULL,
  "original_file_name" VARCHAR(255),
  "mime_type" VARCHAR(255),
  "file_extension" VARCHAR(20),
  "size_bytes" BIGINT,
  "storage_key" TEXT,
  "external_url" TEXT,
  "current_version_id" UUID,
  "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "deleted_at" TIMESTAMP(3),
  "deleted_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documents_kind_metadata_check" CHECK (
    (
      "document_kind" = 'FILE'
      AND "original_file_name" IS NOT NULL
      AND "mime_type" IS NOT NULL
      AND "file_extension" IS NOT NULL
      AND "size_bytes" IS NOT NULL
      AND "size_bytes" > 0
      AND "storage_key" IS NOT NULL
      AND "external_url" IS NULL
    )
    OR
    (
      "document_kind" IN ('GOOGLE_DRIVE_LINK', 'YOUTUBE_LINK')
      AND "original_file_name" IS NULL
      AND "mime_type" IS NULL
      AND "file_extension" IS NULL
      AND "size_bytes" IS NULL
      AND "storage_key" IS NULL
      AND "external_url" IS NOT NULL
    )
  )
);

CREATE TABLE "document_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "original_file_name" VARCHAR(255),
  "storage_key" TEXT,
  "external_url" TEXT,
  "mime_type" VARCHAR(255),
  "size_bytes" BIGINT,
  "change_note" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_versions_number_check" CHECK ("version_number" > 0),
  CONSTRAINT "document_versions_source_check" CHECK (
    (
      "storage_key" IS NOT NULL
      AND "external_url" IS NULL
      AND "original_file_name" IS NOT NULL
      AND "mime_type" IS NOT NULL
      AND "size_bytes" IS NOT NULL
      AND "size_bytes" > 0
    )
    OR
    (
      "storage_key" IS NULL
      AND "external_url" IS NOT NULL
      AND "original_file_name" IS NULL
      AND "mime_type" IS NULL
      AND "size_bytes" IS NULL
    )
  )
);

CREATE TABLE "upload_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "version_id" UUID NOT NULL,
  "folder_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "original_file_name" VARCHAR(255) NOT NULL,
  "safe_file_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(255) NOT NULL,
  "file_extension" VARCHAR(20) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "upload_sessions_size_check" CHECK ("size_bytes" > 0)
);

CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");
CREATE UNIQUE INDEX "documents_current_version_id_key"
  ON "documents"("current_version_id");
CREATE INDEX "documents_folder_id_deleted_at_created_at_idx"
  ON "documents"("folder_id", "deleted_at", "created_at" DESC);
CREATE INDEX "documents_owner_user_id_deleted_at_idx"
  ON "documents"("owner_user_id", "deleted_at");
CREATE INDEX "documents_document_kind_deleted_at_idx"
  ON "documents"("document_kind", "deleted_at");

CREATE UNIQUE INDEX "document_versions_storage_key_key"
  ON "document_versions"("storage_key");
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key"
  ON "document_versions"("document_id", "version_number");
CREATE INDEX "document_versions_created_by_created_at_idx"
  ON "document_versions"("created_by", "created_at" DESC);

CREATE UNIQUE INDEX "upload_sessions_document_id_key"
  ON "upload_sessions"("document_id");
CREATE UNIQUE INDEX "upload_sessions_version_id_key"
  ON "upload_sessions"("version_id");
CREATE UNIQUE INDEX "upload_sessions_storage_key_key"
  ON "upload_sessions"("storage_key");
CREATE INDEX "upload_sessions_user_id_expires_at_idx"
  ON "upload_sessions"("user_id", "expires_at");
CREATE INDEX "upload_sessions_folder_id_completed_at_idx"
  ON "upload_sessions"("folder_id", "completed_at");

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "folders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_deleted_by_fkey"
  FOREIGN KEY ("deleted_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_current_version_id_fkey"
  FOREIGN KEY ("current_version_id") REFERENCES "document_versions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "upload_sessions"
  ADD CONSTRAINT "upload_sessions_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "folders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "upload_sessions"
  ADD CONSTRAINT "upload_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
