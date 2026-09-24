-- Cycle time goes per (part, process): the scalar seconds columns from
-- 20260922140000 could not hold e.g. "Part A 1.5s on Full Spray, 1s on Line
-- Spray". Replaced by step-keyed maps (`stageId::subStageId`, empty subStageId
-- when stage-wide), mirroring how `routingSteps` is keyed. Dev only: no data
-- worth migrating, drop and re-add.

ALTER TABLE "ModelPart" DROP COLUMN "plannedCycleTimeSec";
ALTER TABLE "ModelPart" ADD COLUMN "plannedCycleTimes" JSONB;
ALTER TABLE "Part" DROP COLUMN "plannedCycleTimeSec";
ALTER TABLE "Part" DROP COLUMN "plannedCycleTimeSecOverride";
ALTER TABLE "Part" ADD COLUMN "plannedCycleTimes" JSONB;
ALTER TABLE "Part" ADD COLUMN "plannedCycleTimesOverride" JSONB;
