-- Lot quantity is the single execution target (D-037: one Lot per Project).
-- Project.requiredProductionQuantity always duplicated Lot.requiredProductionQuantity
-- (both were written from the same requirements total), so the Project column is
-- dropped with no backfill; the Lot value remains the source of truth.
ALTER TABLE "Project" DROP COLUMN "requiredProductionQuantity";
