-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "role_scope" AS ENUM ('GLOBAL', 'HOUSEHOLD');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "registration_intent_status" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "credential_status" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('EXPENSE', 'INCOME', 'REFUND');

-- CreateEnum
CREATE TYPE "allocation_module" AS ENUM ('CHILD_CARE', 'WARDROBE', 'CONSUMABLES', 'OTHER');

-- CreateEnum
CREATE TYPE "care_record_type" AS ENUM ('CHECKUP', 'MEDICAL_VISIT', 'MEDICATION', 'SUPPLEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "wardrobe_item_status" AS ENUM ('ACTIVE', 'STORED', 'DONATED', 'SOLD', 'DISCARDED');

-- CreateEnum
CREATE TYPE "media_visibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- DropForeignKey
ALTER TABLE "product_group_items" DROP CONSTRAINT "product_group_items_group_code_fkey";

-- DropForeignKey
ALTER TABLE "product_group_items" DROP CONSTRAINT "product_group_items_product_code_fkey";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "household_id" UUID;

-- AlterTable
ALTER TABLE "product_groups" ADD COLUMN     "household_id" UUID;

-- AlterTable
ALTER TABLE "product_group_items" ADD COLUMN     "household_id" UUID;

-- AlterTable
ALTER TABLE "inventory_batches" ADD COLUMN     "household_id" UUID,
ADD COLUMN     "purchase_item_id" UUID,
ALTER COLUMN "purchase_price" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "inventory_logs" ADD COLUMN     "household_id" UUID;

-- CreateTable
CREATE TABLE "app_users" (
    "id" UUID NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "display_name" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "time_zone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CNY',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- Preserve every yudan-wupin row by assigning the retained inventory to one
-- platform household before household_id becomes mandatory.
DO $$
DECLARE
    retained_household_id UUID;
BEGIN
    INSERT INTO "households" ("name", "time_zone", "currency", "updated_at")
    VALUES ('鱼蛋家庭', 'Asia/Shanghai', 'CNY', CURRENT_TIMESTAMP)
    RETURNING "id" INTO retained_household_id;

    UPDATE "products" SET "household_id" = retained_household_id;
    UPDATE "product_groups" SET "household_id" = retained_household_id;
    UPDATE "product_group_items" SET "household_id" = retained_household_id;
    UPDATE "inventory_batches" SET "household_id" = retained_household_id;
    UPDATE "inventory_logs" SET "household_id" = retained_household_id;
END $$;

ALTER TABLE "products" ALTER COLUMN "household_id" SET NOT NULL;
ALTER TABLE "product_groups" ALTER COLUMN "household_id" SET NOT NULL;
ALTER TABLE "product_group_items" ALTER COLUMN "household_id" SET NOT NULL;
ALTER TABLE "inventory_batches" ALTER COLUMN "household_id" SET NOT NULL;
ALTER TABLE "inventory_logs" ALTER COLUMN "household_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "role_scope" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(96) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_global_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_global_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "email_normalized" TEXT,
    "status" "invitation_status" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_intents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invitation_id" UUID NOT NULL,
    "intent_token_hash" VARCHAR(128) NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "status" "registration_intent_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_by_id" UUID,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID,
    "name" TEXT NOT NULL,
    "key_prefix" VARCHAR(16) NOT NULL,
    "secret_hash" VARCHAR(128) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "credential_status" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(3),
    "last_used_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "household_id" UUID,
    "actor_user_id" UUID,
    "action" VARCHAR(96) NOT NULL,
    "entity_type" VARCHAR(96) NOT NULL,
    "entity_id" TEXT,
    "request_id" VARCHAR(128),
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "scope" VARCHAR(96) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID,
    "parent_id" UUID,
    "code" VARCHAR(64) NOT NULL,
    "name" TEXT NOT NULL,
    "module" "allocation_module" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CNY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "type" "transaction_type" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CNY',
    "transaction_at" TIMESTAMPTZ(3) NOT NULL,
    "payment_account_id" UUID,
    "merchant" TEXT,
    "note" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "category_id" UUID,
    "module" "allocation_module" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transaction_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baby_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "birthday" DATE NOT NULL,
    "sex" VARCHAR(16),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "baby_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "baby_profile_id" UUID NOT NULL,
    "measured_on" DATE NOT NULL,
    "weight_kg" DECIMAL(6,3) NOT NULL,
    "height_cm" DECIMAL(5,2),
    "head_circumference_cm" DECIMAL(5,2),
    "note" TEXT,
    "legacy_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "growth_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccine_catalog" (
    "id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "age_months" INTEGER NOT NULL,
    "age_label" TEXT NOT NULL,
    "vaccine" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "funding" VARCHAR(16) NOT NULL,
    "date_rule" TEXT,
    "date_offset_days" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "region" TEXT NOT NULL,
    "schedule_version" TEXT NOT NULL,
    "prevents" TEXT NOT NULL DEFAULT '',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audience" TEXT,
    "schedule_note" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vaccine_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccine_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "baby_profile_id" UUID NOT NULL,
    "vaccine_id" TEXT NOT NULL,
    "administered_on" DATE NOT NULL,
    "place" TEXT,
    "batch_no" TEXT,
    "manufacturer" TEXT,
    "note" TEXT,
    "legacy_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vaccine_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "baby_profile_id" UUID NOT NULL,
    "transaction_allocation_id" UUID,
    "type" "care_record_type" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "care_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wardrobe_purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "transaction_allocation_id" UUID,
    "purchased_at" TIMESTAMPTZ(3) NOT NULL,
    "merchant" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wardrobe_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wardrobe_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "baby_profile_id" UUID,
    "wardrobe_purchase_id" UUID,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "size" TEXT,
    "season" TEXT,
    "color" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "wardrobe_item_status" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wardrobe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "transaction_allocation_id" UUID,
    "purchased_at" TIMESTAMPTZ(3) NOT NULL,
    "merchant" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consumable_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_purchase_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "consumable_purchase_id" UUID NOT NULL,
    "product_code" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(14,4),
    "line_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumable_purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "visibility" "media_visibility" NOT NULL DEFAULT 'PRIVATE',
    "mime_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "checksum_sha256" VARCHAR(64),
    "width" INTEGER,
    "height" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "purpose" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_import_maps" (
    "id" BIGSERIAL NOT NULL,
    "source_project" VARCHAR(64) NOT NULL,
    "source_table" VARCHAR(96) NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_table" VARCHAR(96) NOT NULL,
    "target_id" TEXT NOT NULL,
    "source_hash" VARCHAR(128),
    "imported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_import_maps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_users_email_normalized_key" ON "app_users"("email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "user_global_roles_role_id_idx" ON "user_global_roles"("role_id");

-- CreateIndex
CREATE INDEX "household_members_user_id_status_idx" ON "household_members"("user_id", "status");

-- CreateIndex
CREATE INDEX "household_members_role_id_idx" ON "household_members"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_household_id_user_id_key" ON "household_members"("household_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_household_id_status_expires_at_idx" ON "invitations"("household_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "invitations_role_id_idx" ON "invitations"("role_id");

-- CreateIndex
CREATE INDEX "invitations_created_by_user_id_idx" ON "invitations"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "registration_intents_intent_token_hash_key" ON "registration_intents"("intent_token_hash");

-- CreateIndex
CREATE INDEX "registration_intents_invitation_id_status_expires_at_idx" ON "registration_intents"("invitation_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "registration_intents_email_normalized_status_idx" ON "registration_intents"("email_normalized", "status");

-- CreateIndex
CREATE INDEX "registration_intents_consumed_by_id_idx" ON "registration_intents"("consumed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_credentials_secret_hash_key" ON "api_credentials"("secret_hash");

-- CreateIndex
CREATE INDEX "api_credentials_household_id_status_idx" ON "api_credentials"("household_id", "status");

-- CreateIndex
CREATE INDEX "api_credentials_created_by_user_id_idx" ON "api_credentials"("created_by_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_household_id_created_at_idx" ON "audit_logs"("household_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_household_id_scope_key_key" ON "idempotency_keys"("household_id", "scope", "key");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_household_id_module_is_active_idx" ON "categories"("household_id", "module", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "categories_household_id_code_key" ON "categories"("household_id", "code");

-- CreateIndex
CREATE INDEX "payment_accounts_household_id_is_active_sort_order_idx" ON "payment_accounts"("household_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "payment_accounts_household_id_name_key" ON "payment_accounts"("household_id", "name");

-- CreateIndex
CREATE INDEX "transactions_household_id_transaction_at_id_idx" ON "transactions"("household_id", "transaction_at" DESC, "id");

-- CreateIndex
CREATE INDEX "transactions_household_id_type_transaction_at_idx" ON "transactions"("household_id", "type", "transaction_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_payment_account_id_idx" ON "transactions"("payment_account_id");

-- CreateIndex
CREATE INDEX "transactions_created_by_user_id_idx" ON "transactions"("created_by_user_id");

-- CreateIndex
CREATE INDEX "transaction_allocations_household_id_module_created_at_idx" ON "transaction_allocations"("household_id", "module", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transaction_allocations_transaction_id_idx" ON "transaction_allocations"("transaction_id");

-- CreateIndex
CREATE INDEX "transaction_allocations_category_id_idx" ON "transaction_allocations"("category_id");

-- CreateIndex
CREATE INDEX "baby_profiles_household_id_birthday_idx" ON "baby_profiles"("household_id", "birthday");

-- CreateIndex
CREATE INDEX "growth_records_household_id_measured_on_idx" ON "growth_records"("household_id", "measured_on" DESC);

-- CreateIndex
CREATE INDEX "growth_records_baby_profile_id_measured_on_idx" ON "growth_records"("baby_profile_id", "measured_on" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "vaccine_catalog_sort_order_key" ON "vaccine_catalog"("sort_order");

-- CreateIndex
CREATE INDEX "vaccine_catalog_active_sort_order_idx" ON "vaccine_catalog"("active", "sort_order");

-- CreateIndex
CREATE INDEX "vaccine_records_household_id_administered_on_idx" ON "vaccine_records"("household_id", "administered_on" DESC);

-- CreateIndex
CREATE INDEX "vaccine_records_vaccine_id_idx" ON "vaccine_records"("vaccine_id");

-- CreateIndex
CREATE UNIQUE INDEX "vaccine_records_baby_profile_id_vaccine_id_administered_on_key" ON "vaccine_records"("baby_profile_id", "vaccine_id", "administered_on");

-- CreateIndex
CREATE UNIQUE INDEX "care_records_transaction_allocation_id_key" ON "care_records"("transaction_allocation_id");

-- CreateIndex
CREATE INDEX "care_records_household_id_occurred_at_idx" ON "care_records"("household_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "care_records_baby_profile_id_occurred_at_idx" ON "care_records"("baby_profile_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wardrobe_purchases_transaction_allocation_id_key" ON "wardrobe_purchases"("transaction_allocation_id");

-- CreateIndex
CREATE INDEX "wardrobe_purchases_household_id_purchased_at_idx" ON "wardrobe_purchases"("household_id", "purchased_at" DESC);

-- CreateIndex
CREATE INDEX "wardrobe_items_household_id_status_category_idx" ON "wardrobe_items"("household_id", "status", "category");

-- CreateIndex
CREATE INDEX "wardrobe_items_baby_profile_id_idx" ON "wardrobe_items"("baby_profile_id");

-- CreateIndex
CREATE INDEX "wardrobe_items_wardrobe_purchase_id_idx" ON "wardrobe_items"("wardrobe_purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "consumable_purchases_transaction_allocation_id_key" ON "consumable_purchases"("transaction_allocation_id");

-- CreateIndex
CREATE INDEX "consumable_purchases_household_id_purchased_at_idx" ON "consumable_purchases"("household_id", "purchased_at" DESC);

-- CreateIndex
CREATE INDEX "consumable_purchase_items_household_id_created_at_idx" ON "consumable_purchase_items"("household_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "consumable_purchase_items_consumable_purchase_id_idx" ON "consumable_purchase_items"("consumable_purchase_id");

-- CreateIndex
CREATE INDEX "consumable_purchase_items_product_code_idx" ON "consumable_purchase_items"("product_code");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_object_key_key" ON "media_assets"("object_key");

-- CreateIndex
CREATE INDEX "media_assets_household_id_created_at_idx" ON "media_assets"("household_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "media_assets_uploaded_by_user_id_idx" ON "media_assets"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "media_links_household_id_entity_type_entity_id_sort_order_idx" ON "media_links"("household_id", "entity_type", "entity_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "media_links_media_asset_id_entity_type_entity_id_purpose_key" ON "media_links"("media_asset_id", "entity_type", "entity_id", "purpose");

-- CreateIndex
CREATE INDEX "legacy_import_maps_target_table_target_id_idx" ON "legacy_import_maps"("target_table", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_import_maps_source_project_source_table_source_id_key" ON "legacy_import_maps"("source_project", "source_table", "source_id");

-- CreateIndex
CREATE INDEX "products_household_id_is_active_sort_order_idx" ON "products"("household_id", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "product_groups_household_id_is_active_sort_order_idx" ON "product_groups"("household_id", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "product_group_items_household_id_group_code_sort_order_idx" ON "product_group_items"("household_id", "group_code", "sort_order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_group_items_product_code_idx" ON "product_group_items"("product_code");

-- CreateIndex
CREATE INDEX "inventory_batches_household_id_product_code_status_expiry_d_idx" ON "inventory_batches"("household_id", "product_code", "status", "expiry_date");

-- CreateIndex
CREATE INDEX "inventory_batches_purchase_item_id_idx" ON "inventory_batches"("purchase_item_id");

-- CreateIndex
CREATE INDEX "inventory_logs_household_id_created_at_idx" ON "inventory_logs"("household_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_logs_product_code_created_at_idx" ON "inventory_logs"("product_code", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inventory_logs_batch_code_created_at_idx" ON "inventory_logs"("batch_code", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_global_roles" ADD CONSTRAINT "user_global_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_global_roles" ADD CONSTRAINT "user_global_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_intents" ADD CONSTRAINT "registration_intents_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_intents" ADD CONSTRAINT "registration_intents_consumed_by_id_fkey" FOREIGN KEY ("consumed_by_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_allocations" ADD CONSTRAINT "transaction_allocations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_allocations" ADD CONSTRAINT "transaction_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_allocations" ADD CONSTRAINT "transaction_allocations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baby_profiles" ADD CONSTRAINT "baby_profiles_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_records" ADD CONSTRAINT "growth_records_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_records" ADD CONSTRAINT "growth_records_baby_profile_id_fkey" FOREIGN KEY ("baby_profile_id") REFERENCES "baby_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccine_records" ADD CONSTRAINT "vaccine_records_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccine_records" ADD CONSTRAINT "vaccine_records_baby_profile_id_fkey" FOREIGN KEY ("baby_profile_id") REFERENCES "baby_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccine_records" ADD CONSTRAINT "vaccine_records_vaccine_id_fkey" FOREIGN KEY ("vaccine_id") REFERENCES "vaccine_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_records" ADD CONSTRAINT "care_records_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_records" ADD CONSTRAINT "care_records_baby_profile_id_fkey" FOREIGN KEY ("baby_profile_id") REFERENCES "baby_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_records" ADD CONSTRAINT "care_records_transaction_allocation_id_fkey" FOREIGN KEY ("transaction_allocation_id") REFERENCES "transaction_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wardrobe_purchases" ADD CONSTRAINT "wardrobe_purchases_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wardrobe_purchases" ADD CONSTRAINT "wardrobe_purchases_transaction_allocation_id_fkey" FOREIGN KEY ("transaction_allocation_id") REFERENCES "transaction_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_baby_profile_id_fkey" FOREIGN KEY ("baby_profile_id") REFERENCES "baby_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_wardrobe_purchase_id_fkey" FOREIGN KEY ("wardrobe_purchase_id") REFERENCES "wardrobe_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_group_items" ADD CONSTRAINT "product_group_items_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_group_items" ADD CONSTRAINT "product_group_items_group_code_fkey" FOREIGN KEY ("group_code") REFERENCES "product_groups"("group_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_group_items" ADD CONSTRAINT "product_group_items_product_code_fkey" FOREIGN KEY ("product_code") REFERENCES "products"("product_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_purchase_item_id_fkey" FOREIGN KEY ("purchase_item_id") REFERENCES "consumable_purchase_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_purchases" ADD CONSTRAINT "consumable_purchases_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_purchases" ADD CONSTRAINT "consumable_purchases_transaction_allocation_id_fkey" FOREIGN KEY ("transaction_allocation_id") REFERENCES "transaction_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_purchase_items" ADD CONSTRAINT "consumable_purchase_items_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_purchase_items" ADD CONSTRAINT "consumable_purchase_items_consumable_purchase_id_fkey" FOREIGN KEY ("consumable_purchase_id") REFERENCES "consumable_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_purchase_items" ADD CONSTRAINT "consumable_purchase_items_product_code_fkey" FOREIGN KEY ("product_code") REFERENCES "products"("product_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_links" ADD CONSTRAINT "media_links_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_links" ADD CONSTRAINT "media_links_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase Auth owns password hashes. The application profile shares the same
-- UUID but never duplicates a password or OAuth secret.
ALTER TABLE "app_users"
ADD CONSTRAINT "app_users_id_fkey"
FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;

-- Domain constraints not expressible in Prisma Schema Language.
ALTER TABLE "app_users"
  ADD CONSTRAINT "app_users_email_normalized_check"
  CHECK ("email_normalized" = lower(btrim("email_normalized")) AND position('@' in "email_normalized") > 1);
ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_expiry_check" CHECK ("expires_at" > "created_at");
ALTER TABLE "registration_intents"
  ADD CONSTRAINT "registration_intents_expiry_check" CHECK ("expires_at" > "created_at");
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "transaction_allocations"
  ADD CONSTRAINT "transaction_allocations_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "growth_records"
  ADD CONSTRAINT "growth_records_measurements_check" CHECK (
    "weight_kg" BETWEEN 0.1 AND 200
    AND ("height_cm" IS NULL OR "height_cm" > 0)
    AND ("head_circumference_cm" IS NULL OR "head_circumference_cm" > 0)
  );
ALTER TABLE "wardrobe_items"
  ADD CONSTRAINT "wardrobe_items_quantity_positive_check" CHECK ("quantity" > 0);
ALTER TABLE "products"
  ADD CONSTRAINT "products_flags_check" CHECK (
    "min_stock" >= 0
    AND "is_favorite" IN (0, 1)
    AND "is_groupable" IN (0, 1)
    AND "is_active" IN (0, 1)
  );
ALTER TABLE "inventory_batches"
  ADD CONSTRAINT "inventory_batches_quantity_check" CHECK (
    "init_quantity" >= 0
    AND "available_quantity" >= 0
  ),
  ADD CONSTRAINT "inventory_batches_money_check" CHECK (
    ("purchase_price" IS NULL OR "purchase_price" >= 0)
    AND ("unit_price" IS NULL OR "unit_price" >= 0)
  );
ALTER TABLE "consumable_purchase_items"
  ADD CONSTRAINT "consumable_purchase_items_amount_check" CHECK (
    "quantity" > 0 AND "line_amount" >= 0 AND ("unit_price" IS NULL OR "unit_price" >= 0)
  );
ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_size_check" CHECK ("byte_size" > 0);

CREATE UNIQUE INDEX "categories_system_code_key"
  ON "categories"("code") WHERE "household_id" IS NULL;
CREATE INDEX "transactions_active_household_time_idx"
  ON "transactions"("household_id", "transaction_at" DESC, "id")
  WHERE "deleted_at" IS NULL;
CREATE INDEX "registration_intents_pending_expiry_idx"
  ON "registration_intents"("expires_at") WHERE "status" = 'PENDING';
CREATE INDEX "inventory_batches_active_stock_idx"
  ON "inventory_batches"("household_id", "product_code", "expiry_date")
  WHERE "status" = 'ACTIVE' AND "available_quantity" > 0;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- RLS membership helper: private, fixed search path, and rejects anonymous use.
CREATE OR REPLACE FUNCTION private.is_household_member(target_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.household_members AS member
      WHERE member.household_id = target_household_id
        AND member.user_id = (SELECT auth.uid())
        AND member.status = 'ACTIVE'
    );
$$;
REVOKE ALL ON FUNCTION private.is_household_member(UUID) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_household_member(UUID) TO authenticated;

ALTER TABLE "app_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_global_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "household_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registration_intents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transaction_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "baby_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "growth_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vaccine_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vaccine_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wardrobe_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wardrobe_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_group_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consumable_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consumable_purchase_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legacy_import_maps" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

CREATE POLICY "app_users_select_self" ON "app_users"
  FOR SELECT TO authenticated USING ("id" = (SELECT auth.uid()));
CREATE POLICY "households_select_member" ON "households"
  FOR SELECT TO authenticated USING (private.is_household_member("id"));
CREATE POLICY "household_members_select_member" ON "household_members"
  FOR SELECT TO authenticated USING (
    "user_id" = (SELECT auth.uid()) OR private.is_household_member("household_id")
  );
CREATE POLICY "roles_select_authenticated" ON "roles"
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_select_authenticated" ON "permissions"
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_select_authenticated" ON "role_permissions"
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "vaccine_catalog_select_authenticated" ON "vaccine_catalog"
  FOR SELECT TO authenticated USING (true);

DO $$
DECLARE
  protected_table TEXT;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'categories', 'payment_accounts', 'transactions', 'transaction_allocations',
    'baby_profiles', 'growth_records', 'vaccine_records', 'care_records',
    'wardrobe_purchases', 'wardrobe_items', 'products', 'product_groups',
    'product_group_items', 'inventory_batches', 'inventory_logs',
    'consumable_purchases', 'consumable_purchase_items', 'media_assets', 'media_links'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY household_member_select ON public.%I FOR SELECT TO authenticated USING (private.is_household_member(household_id))',
      protected_table
    );
  END LOOP;
END $$;

GRANT SELECT ON "app_users", "households", "roles", "permissions", "role_permissions",
  "household_members", "categories", "payment_accounts", "transactions",
  "transaction_allocations", "baby_profiles", "growth_records", "vaccine_catalog",
  "vaccine_records", "care_records", "wardrobe_purchases", "wardrobe_items",
  "products", "product_groups", "product_group_items", "inventory_batches",
  "inventory_logs", "consumable_purchases", "consumable_purchase_items",
  "media_assets", "media_links"
TO authenticated;

-- Before User Created Hook. The browser passes only a short-lived opaque
-- registration_intent token. Invitation, role and household remain DB facts.
CREATE OR REPLACE FUNCTION private.before_user_created(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  supplied_token TEXT;
  normalized_email TEXT;
  matching_intent UUID;
BEGIN
  supplied_token := event->'user'->'user_metadata'->>'registration_intent';
  normalized_email := lower(btrim(event->'user'->>'email'));

  IF supplied_token IS NULL OR normalized_email IS NULL THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', '需要有效邀请码才能注册。')
    );
  END IF;

  SELECT intent.id INTO matching_intent
  FROM public.registration_intents AS intent
  JOIN public.invitations AS invitation ON invitation.id = intent.invitation_id
  WHERE intent.intent_token_hash = encode(extensions.digest(supplied_token, 'sha256'), 'hex')
    AND intent.email_normalized = normalized_email
    AND intent.status = 'PENDING'
    AND intent.expires_at > now()
    AND invitation.status = 'ACTIVE'
    AND invitation.expires_at > now()
    AND (invitation.email_normalized IS NULL OR invitation.email_normalized = normalized_email)
  LIMIT 1;

  IF matching_intent IS NULL THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', '邀请码无效、已使用或已过期。')
    );
  END IF;

  RETURN '{}'::jsonb;
END;
$$;

GRANT USAGE ON SCHEMA private, extensions TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.before_user_created(JSONB) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION private.before_user_created(JSONB) FROM PUBLIC, anon, authenticated;

-- Runs in the same Auth transaction: create the platform profile/membership and
-- atomically consume both intent and invitation.
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  supplied_token TEXT;
  normalized_email TEXT;
  matched_intent RECORD;
BEGIN
  supplied_token := NEW.raw_user_meta_data->>'registration_intent';
  normalized_email := lower(btrim(NEW.email));

  SELECT intent.id AS intent_id, invitation.id AS invitation_id,
         invitation.household_id, invitation.role_id
  INTO matched_intent
  FROM public.registration_intents AS intent
  JOIN public.invitations AS invitation ON invitation.id = intent.invitation_id
  WHERE intent.intent_token_hash = encode(extensions.digest(supplied_token, 'sha256'), 'hex')
    AND intent.email_normalized = normalized_email
    AND intent.status = 'PENDING'
    AND intent.expires_at > now()
    AND invitation.status = 'ACTIVE'
    AND invitation.expires_at > now()
  FOR UPDATE OF intent, invitation
  LIMIT 1;

  IF matched_intent.intent_id IS NULL THEN
    RAISE EXCEPTION 'registration intent is no longer valid';
  END IF;

  INSERT INTO public.app_users (
    id, email_normalized, display_name, status, created_at, updated_at
  ) VALUES (
    NEW.id, normalized_email, NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    'PENDING_VERIFICATION', now(), now()
  );

  INSERT INTO public.household_members (
    household_id, user_id, role_id, status, joined_at, updated_at
  ) VALUES (
    matched_intent.household_id, NEW.id, matched_intent.role_id, 'ACTIVE', now(), now()
  );

  UPDATE public.registration_intents
  SET status = 'CONSUMED', consumed_by_id = NEW.id, consumed_at = now()
  WHERE id = matched_intent.intent_id;

  UPDATE public.invitations
  SET status = 'CONSUMED', consumed_at = now()
  WHERE id = matched_intent.invitation_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created_yudan_platform ON auth.users;
CREATE TRIGGER on_auth_user_created_yudan_platform
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user();
