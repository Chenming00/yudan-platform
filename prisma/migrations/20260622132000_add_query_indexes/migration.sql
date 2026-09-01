-- Speed up stock aggregation and FEFO batch filtering.
CREATE INDEX "inventory_batches_product_status_expiry_idx"
ON "inventory_batches"("product_code", "status", "expiry_date");

CREATE INDEX "inventory_batches_status_expiry_available_idx"
ON "inventory_batches"("status", "expiry_date", "available_quantity");

-- Speed up log pages and per-product history.
CREATE INDEX "inventory_logs_product_created_idx"
ON "inventory_logs"("product_code", "created_at" DESC);

CREATE INDEX "inventory_logs_action_created_idx"
ON "inventory_logs"("action_type", "created_at" DESC);

-- Keep product lists stable and cheap.
CREATE INDEX "products_active_sort_idx"
ON "products"("is_active", "sort_order");
