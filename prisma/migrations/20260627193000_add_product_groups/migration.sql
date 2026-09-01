-- AlterTable
ALTER TABLE "products" ADD COLUMN "is_groupable" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "product_groups" (
    "id" SERIAL NOT NULL,
    "group_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "qr_token" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_group_items" (
    "id" SERIAL NOT NULL,
    "group_code" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "suggested_qty" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_group_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_groups_group_code_key" ON "product_groups"("group_code");

-- CreateIndex
CREATE UNIQUE INDEX "product_groups_qr_token_key" ON "product_groups"("qr_token");

-- CreateIndex
CREATE UNIQUE INDEX "product_group_items_group_code_product_code_key" ON "product_group_items"("group_code", "product_code");

-- CreateIndex
CREATE INDEX "product_group_items_product_code_idx" ON "product_group_items"("product_code");

-- AddForeignKey
ALTER TABLE "product_group_items" ADD CONSTRAINT "product_group_items_group_code_fkey" FOREIGN KEY ("group_code") REFERENCES "product_groups"("group_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_group_items" ADD CONSTRAINT "product_group_items_product_code_fkey" FOREIGN KEY ("product_code") REFERENCES "products"("product_code") ON DELETE RESTRICT ON UPDATE CASCADE;
