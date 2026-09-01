-- A discarded batch represents inventory loss, not a reversible hidden state.
-- Normalize records created by older application versions before enforcing the
-- corrected behavior in the API.
UPDATE "inventory_logs"
SET
  "quantity" = COALESCE("before_quantity", 0),
  "after_quantity" = 0,
  "details" = jsonb_build_object(
    'version', 1,
    'batches', jsonb_build_array(
      jsonb_build_object(
        'batch_code', "batch_code",
        'quantity', COALESCE("before_quantity", 0),
        'before_quantity', COALESCE("before_quantity", 0),
        'after_quantity', 0
      )
    )
  )
WHERE "action_type" = 'DISCARD'
  AND "quantity" = 0
  AND "batch_code" IS NOT NULL;

UPDATE "inventory_batches"
SET "available_quantity" = 0,
    "updated_at" = NOW()
WHERE "status" = 'DISCARDED'
  AND "available_quantity" <> 0;
