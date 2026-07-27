CREATE TABLE "academic_years" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "starts_on" DATE,
    "ends_on" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "academic_year_dates_valid" CHECK (
        "starts_on" IS NULL
        OR "ends_on" IS NULL
        OR "starts_on" <= "ends_on"
    )
);

CREATE UNIQUE INDEX "academic_years_name_key" ON "academic_years"("name");
CREATE INDEX "academic_years_is_active_idx" ON "academic_years"("is_active");
CREATE UNIQUE INDEX "academic_years_single_active_idx"
ON "academic_years"("is_active")
WHERE "is_active" = true;

ALTER TABLE "folders" ADD COLUMN "academic_year_id" UUID;

INSERT INTO "academic_years" (
    "id",
    "name",
    "is_active",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    'Dữ liệu hiện có',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1
    FROM "folders"
    WHERE "workspace_type" = 'SHARED'
);

UPDATE "folders"
SET "academic_year_id" = (
    SELECT "id"
    FROM "academic_years"
    WHERE "is_active" = true
    LIMIT 1
)
WHERE "workspace_type" = 'SHARED';

ALTER TABLE "folders"
ADD CONSTRAINT "folders_academic_year_id_fkey"
FOREIGN KEY ("academic_year_id")
REFERENCES "academic_years"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "folders_academic_year_id_workspace_type_idx"
ON "folders"("academic_year_id", "workspace_type");

CREATE UNIQUE INDEX "folders_academic_year_root_key"
ON "folders"("academic_year_id")
WHERE
    "workspace_type" = 'SHARED'
    AND "parent_id" IS NULL
    AND "deleted_at" IS NULL;

ALTER TABLE "folders"
ADD CONSTRAINT "folders_academic_year_scope_valid"
CHECK (
    ("workspace_type" = 'PERSONAL' AND "academic_year_id" IS NULL)
    OR ("workspace_type" = 'SHARED' AND "academic_year_id" IS NOT NULL)
);
