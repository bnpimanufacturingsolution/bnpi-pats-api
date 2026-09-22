-- Rename Station -> Section (model rename, no @@map). Prisma cannot auto-detect
-- renames, so this is hand-authored: metadata-only RENAMEs preserve all rows,
-- primary keys, and inbound foreign keys (StationStep, Booth, PrintJob).
-- A naive generated migration would DROP "Station" (11 rows) and CREATE an
-- empty "Section".
ALTER TABLE "Station" RENAME TO "Section";

ALTER TABLE "Section" RENAME COLUMN "stationCode" TO "sectionCode";
