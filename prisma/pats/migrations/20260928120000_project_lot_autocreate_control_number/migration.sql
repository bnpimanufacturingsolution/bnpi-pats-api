-- Project creation now owns its single Lot (no separate Create-lot step) and
-- carries the paper control number. Preflight 2026-09-28 (disposable dev DB):
-- Lot 9. Backup: backups/pats-pre-model-series-qc-20260927.dump (pre-Batch/Lot
-- cleanup baseline; post-cleanup state is reseedable from scripts/pats-seed.mjs).
-- Historical migrations untouched.
ALTER TABLE "Lot" ADD COLUMN "controlNumber" TEXT;
UPDATE "Lot" SET "controlNumber" = "lotCode" || '-001' WHERE "controlNumber" IS NULL;
