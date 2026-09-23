-- Rename stationId → sectionId on QualityInspection.
-- Completes the Station → Section column rename started in migration
-- 20260922120000 (which covered StationStep, Booth, PrintJob).
-- QualityInspection stationId is a plain column (no FK to Station),
-- so only the column rename is needed.

ALTER TABLE "QualityInspection" RENAME COLUMN "stationId" TO "sectionId";
