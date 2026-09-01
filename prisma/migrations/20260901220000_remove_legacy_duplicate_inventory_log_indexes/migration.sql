-- The platform foundation migration introduced schema-aligned index names for
-- these access paths. Remove the equivalent legacy indexes to avoid duplicate
-- write and storage overhead while retaining the same query coverage.
DROP INDEX IF EXISTS "inventory_logs_batch_created_idx";
DROP INDEX IF EXISTS "inventory_logs_product_created_idx";
