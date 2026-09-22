-- Planned/required cycle time, seconds, keyed on the part (REQ-CT-1 decision
-- 2026-09-22: per-part master default + per-project editable override).
--
-- ModelPart.plannedCycleTimeSec is the catalog master default (nullable = unset,
-- honest absence). Part.plannedCycleTimeSec snapshots it at project creation
-- (runs freeze master values, like parts-list versioning);
-- Part.plannedCycleTimeSecOverride is the finalization edit (null = use snapshot).
-- No backfill: existing rows stay NULL.

ALTER TABLE "ModelPart" ADD COLUMN "plannedCycleTimeSec" INTEGER;
ALTER TABLE "Part" ADD COLUMN "plannedCycleTimeSec" INTEGER;
ALTER TABLE "Part" ADD COLUMN "plannedCycleTimeSecOverride" INTEGER;
