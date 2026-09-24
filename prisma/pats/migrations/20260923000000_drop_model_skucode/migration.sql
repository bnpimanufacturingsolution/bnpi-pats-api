-- Drop Model.skuCode: fully derivable as productCode + '-' + modelNumber at read time.
-- The column was nullable and never written by the runtime seed, so no backfill is required.
-- See docs/decisions/2026-09-23-product-cleanup-decision.md (C-001).
ALTER TABLE "Model" DROP COLUMN "skuCode";
