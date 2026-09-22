-- Rename stationId → sectionId on StationStep, Booth, PrintJob.
-- Matches the Station → Section table rename (migration 20260918050756).
-- PostgreSQL RENAME COLUMN also renames dependent indexes and unique constraints.
-- FK constraint names must be renamed explicitly.

ALTER TABLE "StationStep" RENAME COLUMN "stationId" TO "sectionId";
ALTER TABLE "StationStep" RENAME CONSTRAINT "StationStep_stationId_fkey" TO "StationStep_sectionId_fkey";

ALTER TABLE "Booth" RENAME COLUMN "stationId" TO "sectionId";
ALTER TABLE "Booth" RENAME CONSTRAINT "Booth_stationId_fkey" TO "Booth_sectionId_fkey";

ALTER TABLE "PrintJob" RENAME COLUMN "stationId" TO "sectionId";
ALTER TABLE "PrintJob" RENAME CONSTRAINT "PrintJob_stationId_fkey" TO "PrintJob_sectionId_fkey";
