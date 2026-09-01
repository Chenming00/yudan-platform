-- DropIndex
DROP INDEX "product_group_items_group_code_product_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "product_group_items_group_code_product_code_key"
  ON "product_group_items"("group_code", "product_code");
