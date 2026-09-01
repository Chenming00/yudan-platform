ALTER TABLE "wardrobe_items"
  ADD COLUMN "sale_transaction_allocation_id" UUID;

CREATE UNIQUE INDEX "wardrobe_items_sale_transaction_allocation_id_key"
  ON "wardrobe_items"("sale_transaction_allocation_id");

ALTER TABLE "wardrobe_items"
  ADD CONSTRAINT "wardrobe_items_sale_transaction_allocation_id_fkey"
  FOREIGN KEY ("sale_transaction_allocation_id")
  REFERENCES "transaction_allocations"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
