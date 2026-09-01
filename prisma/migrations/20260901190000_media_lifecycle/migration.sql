CREATE TYPE "media_status" AS ENUM ('PENDING', 'READY', 'DELETE_PENDING', 'DELETED');

ALTER TABLE "media_assets"
  ADD COLUMN "status" "media_status" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "original_name" TEXT,
  ADD COLUMN "etag" TEXT,
  ADD COLUMN "upload_expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "confirmed_at" TIMESTAMPTZ(3),
  ADD COLUMN "deletion_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deletion_error" TEXT;

UPDATE "media_assets"
SET "status" = 'READY', "confirmed_at" = "created_at";

CREATE INDEX "media_assets_status_upload_expires_at_idx" ON "media_assets"("status", "upload_expires_at");
CREATE INDEX "media_assets_status_deleted_at_idx" ON "media_assets"("status", "deleted_at");

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_lifecycle_check" CHECK (
    ("status" = 'PENDING' AND "confirmed_at" IS NULL AND "deleted_at" IS NULL)
    OR ("status" = 'READY' AND "confirmed_at" IS NOT NULL AND "deleted_at" IS NULL)
    OR ("status" IN ('DELETE_PENDING', 'DELETED') AND "deleted_at" IS NOT NULL)
  );
