ALTER TABLE "transactions"
  ADD COLUMN "refund_of_transaction_id" UUID;

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_refund_shape_check"
  CHECK (
    ("type" = 'REFUND' AND "refund_of_transaction_id" IS NOT NULL)
    OR ("type" <> 'REFUND' AND "refund_of_transaction_id" IS NULL)
  );

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_refund_not_self_check"
  CHECK ("refund_of_transaction_id" IS NULL OR "refund_of_transaction_id" <> "id");

CREATE INDEX "transactions_refund_of_transaction_id_idx"
  ON "transactions"("refund_of_transaction_id");

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_refund_of_transaction_id_fkey"
  FOREIGN KEY ("refund_of_transaction_id") REFERENCES "transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
