-- DropForeignKey
ALTER TABLE "product_group_items" DROP CONSTRAINT "product_group_items_product_code_fkey";

-- DropIndex
DROP INDEX "product_group_items_group_code_product_code_key";

-- AlterTable
ALTER TABLE "product_group_items"
  ADD COLUMN "custom_name" TEXT,
  ADD COLUMN "custom_category" TEXT,
  ADD COLUMN "custom_spec" TEXT,
  ADD COLUMN "custom_unit" TEXT,
  ALTER COLUMN "product_code" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "product_group_items_group_code_product_code_key"
  ON "product_group_items"("group_code", "product_code")
  WHERE "product_code" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "product_group_items" ADD CONSTRAINT "product_group_items_product_code_fkey" FOREIGN KEY ("product_code") REFERENCES "products"("product_code") ON DELETE RESTRICT ON UPDATE CASCADE;
