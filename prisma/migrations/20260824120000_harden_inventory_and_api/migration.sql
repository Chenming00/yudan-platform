-- Structured inventory audit data and one-time reversal linkage.
ALTER TABLE "inventory_logs"
ADD COLUMN "details" JSONB,
ADD COLUMN "reversed_log_id" INTEGER;

CREATE UNIQUE INDEX "inventory_logs_reversed_log_id_key"
ON "inventory_logs"("reversed_log_id");

ALTER TABLE "inventory_logs"
ADD CONSTRAINT "inventory_logs_reversed_log_id_fkey"
FOREIGN KEY ("reversed_log_id") REFERENCES "inventory_logs"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "inventory_logs_batch_created_idx"
ON "inventory_logs"("batch_code", "created_at" DESC);

-- Guard core inventory invariants even when a write bypasses the application API.
ALTER TABLE "inventory_batches"
ADD CONSTRAINT "inventory_batches_init_quantity_positive"
CHECK ("init_quantity" > 0),
ADD CONSTRAINT "inventory_batches_available_quantity_nonnegative"
CHECK ("available_quantity" >= 0),
ADD CONSTRAINT "inventory_batches_purchase_price_nonnegative"
CHECK ("purchase_price" IS NULL OR "purchase_price" >= 0),
ADD CONSTRAINT "inventory_batches_unit_price_nonnegative"
CHECK ("unit_price" IS NULL OR "unit_price" >= 0),
ADD CONSTRAINT "inventory_batches_status_valid"
CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'DISCARDED'));

ALTER TABLE "products"
ADD CONSTRAINT "products_min_stock_nonnegative"
CHECK ("min_stock" >= 0),
ADD CONSTRAINT "products_boolean_flags_valid"
CHECK (
  "is_favorite" IN (0, 1)
  AND "is_groupable" IN (0, 1)
  AND "is_active" IN (0, 1)
);

ALTER TABLE "product_groups"
ADD CONSTRAINT "product_groups_is_active_valid"
CHECK ("is_active" IN (0, 1));

ALTER TABLE "product_group_items"
ADD CONSTRAINT "product_group_items_suggested_qty_positive"
CHECK ("suggested_qty" > 0),
ADD CONSTRAINT "product_group_items_source_valid"
CHECK (
  "product_code" IS NOT NULL
  OR ("custom_name" IS NOT NULL AND "custom_unit" IS NOT NULL)
);

-- Prisma connects with the database role. Browser clients must not reach these
-- tables through Supabase Data API, even if grants were inherited previously.
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_group_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "products" FROM anon, authenticated;
REVOKE ALL ON TABLE "product_groups" FROM anon, authenticated;
REVOKE ALL ON TABLE "product_group_items" FROM anon, authenticated;
REVOKE ALL ON TABLE "inventory_batches" FROM anon, authenticated;
REVOKE ALL ON TABLE "inventory_logs" FROM anon, authenticated;
REVOKE ALL ON TABLE "_prisma_migrations" FROM anon, authenticated;
REVOKE ALL ON SEQUENCE "product_groups_id_seq" FROM anon, authenticated;
REVOKE ALL ON SEQUENCE "product_group_items_id_seq" FROM anon, authenticated;
REVOKE ALL ON SEQUENCE "inventory_batches_id_seq" FROM anon, authenticated;
REVOKE ALL ON SEQUENCE "inventory_logs_id_seq" FROM anon, authenticated;
