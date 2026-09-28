-- D-041 approved Batch/Lot v1.2.1 §7 contract extension (2026-09-27).
-- Preflight: 27 Batch rows, exactly one BatchPartLine each, and every line quantity
-- equals Batch.plannedQuantity. Preserve the LotPartAllocation table/data; it is no
-- longer exposed by Project reads and is not used to identify a Batch's Part.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "BatchPartLine"
        GROUP BY "batchId"
        HAVING COUNT(*) <> 1
    ) THEN
        RAISE EXCEPTION 'Cannot migrate BatchPartLine: every existing Batch must have exactly one Part.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "Batch" b
        LEFT JOIN "BatchPartLine" line ON line."batchId" = b."id"
        WHERE line."batchId" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot migrate BatchPartLine: every existing Batch must have a Part.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "Batch" b
        JOIN "BatchPartLine" line ON line."batchId" = b."id"
        WHERE line."quantity" <> b."plannedQuantity"
    ) THEN
        RAISE EXCEPTION 'Cannot migrate BatchPartLine: Batch quantity differs from its Part quantity.';
    END IF;
END $$;

ALTER TABLE "Batch" ADD COLUMN "partId" TEXT;
UPDATE "Batch" b
SET "partId" = line."partId"
FROM "BatchPartLine" line
WHERE line."batchId" = b."id";
ALTER TABLE "Batch" ALTER COLUMN "partId" SET NOT NULL;
CREATE INDEX "Batch_partId_idx" ON "Batch"("partId");
ALTER TABLE "Batch"
  ADD CONSTRAINT "Batch_partId_fkey"
  FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BatchPartLine" DROP CONSTRAINT "BatchPartLine_lotPartAllocationId_fkey";
ALTER TABLE "BatchPartLine" DROP CONSTRAINT "BatchPartLine_batchId_fkey";
ALTER TABLE "BatchPartLine" DROP CONSTRAINT "BatchPartLine_partId_fkey";
DROP TABLE "BatchPartLine";

ALTER TABLE "Lot" DROP CONSTRAINT "Lot_partId_fkey";
ALTER TABLE "Lot"
  DROP COLUMN "partId",
  DROP COLUMN "partName",
  DROP COLUMN "quantityMagnitude",
  DROP COLUMN "quantityUom",
  DROP COLUMN "usageBasis";
