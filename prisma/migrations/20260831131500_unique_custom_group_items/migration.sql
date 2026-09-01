-- Application-level duplicate checks are not sufficient under concurrent
-- requests. PostgreSQL's regular composite unique constraint permits multiple
-- NULL product_code values, so custom items need a partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS "product_group_items_group_custom_name_key"
ON "product_group_items" ("group_code", "custom_name")
WHERE "product_code" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "products_barcode_key"
ON "products" ("barcode")
WHERE "barcode" IS NOT NULL AND btrim("barcode") <> '';
