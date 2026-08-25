-- Part route = ordered (stationId, processId). Stage/SubStage columns stay as a compatibility bridge.
ALTER TABLE "RoutingStep" ADD COLUMN "stationId" TEXT;
ALTER TABLE "RoutingStep" ADD COLUMN "processId" TEXT;

CREATE INDEX "RoutingStep_stationId_idx" ON "RoutingStep"("stationId");
CREATE INDEX "RoutingStep_processId_idx" ON "RoutingStep"("processId");

ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_processId_fkey"
  FOREIGN KEY ("processId") REFERENCES "WorkProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
