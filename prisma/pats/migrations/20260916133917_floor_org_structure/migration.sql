-- Bind a station's routing step to a specific work process (sub-process),
-- completing the Section (Stage) -> Process (SubStage) -> Sub-process (WorkProcess)
-- hierarchy so a station can carry multiple processes/sub-processes.

-- AlterTable
ALTER TABLE "StationStep" ADD COLUMN "workProcessId" TEXT;

-- Drop old unique constraint that ignored workProcessId.
DROP INDEX "StationStep_stationId_stageId_subStageId_key";

-- CreateIndex (new composite unique includes workProcessId so one station-step grain per process)
CREATE UNIQUE INDEX "StationStep_stationId_stageId_subStageId_workProcessId_key" ON "StationStep"("stationId", "stageId", "subStageId", "workProcessId");

-- CreateIndex
CREATE INDEX "StationStep_workProcessId_idx" ON "StationStep"("workProcessId");

-- AddForeignKey
ALTER TABLE "StationStep" ADD CONSTRAINT "StationStep_workProcessId_fkey" FOREIGN KEY ("workProcessId") REFERENCES "WorkProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
