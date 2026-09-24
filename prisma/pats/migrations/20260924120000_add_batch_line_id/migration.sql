-- Batch → Line: which physical line a batch is published to.
-- Post-release floor wiring (2026-09-24): station/line queues must exclude batches
-- belonging to a different line. Nullable: null = not yet assigned to a line
-- (honest absence; no backfill — existing rows stay unassigned).
--
-- Filter semantics (app): when a queue is scoped to line L, include a batch when
-- batch."lineId" IS NULL OR batch."lineId" = L.

ALTER TABLE "Batch" ADD COLUMN "lineId" TEXT;

CREATE INDEX "Batch_lineId_idx" ON "Batch"("lineId");

ALTER TABLE "Batch" ADD CONSTRAINT "Batch_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;
