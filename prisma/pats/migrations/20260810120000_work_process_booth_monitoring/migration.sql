-- Work process (catalog leaf under SubStage — not a device mount)
CREATE TABLE "WorkProcess" (
    "id" TEXT NOT NULL,
    "subStageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isSystemSeed" BOOLEAN NOT NULL DEFAULT false,
    "labelledCycleTimeSec" INTEGER,

    CONSTRAINT "WorkProcess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkProcess_subStageId_idx" ON "WorkProcess"("subStageId");
CREATE INDEX "WorkProcess_name_idx" ON "WorkProcess"("name");

ALTER TABLE "WorkProcess" ADD CONSTRAINT "WorkProcess_subStageId_fkey"
  FOREIGN KEY ("subStageId") REFERENCES "SubStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Physical booth capacity (N booths : 1 Station)
CREATE TABLE "Booth" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "boothCode" TEXT NOT NULL,
    "label" TEXT,
    "stationId" TEXT,
    "stageId" TEXT NOT NULL,
    "subStageId" TEXT,
    "workProcessId" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Booth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Booth_workspaceId_boothCode_key" ON "Booth"("workspaceId", "boothCode");
CREATE INDEX "Booth_stationId_idx" ON "Booth"("stationId");
CREATE INDEX "Booth_stageId_subStageId_idx" ON "Booth"("stageId", "subStageId");

ALTER TABLE "Booth" ADD CONSTRAINT "Booth_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booth" ADD CONSTRAINT "Booth_workProcessId_fkey"
  FOREIGN KEY ("workProcessId") REFERENCES "WorkProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Monitoring encode kernel
CREATE TABLE "MonitoringDailySheet" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productionDate" TEXT NOT NULL,
    "lineLabel" TEXT NOT NULL,
    "workProcessId" TEXT,
    "processName" TEXT NOT NULL,
    "lineLeaderName" TEXT NOT NULL DEFAULT '',
    "productName" TEXT NOT NULL DEFAULT '',
    "modelName" TEXT NOT NULL DEFAULT '',
    "partName" TEXT NOT NULL DEFAULT '',
    "lotCode" TEXT NOT NULL DEFAULT '',
    "targetPerShift" INTEGER NOT NULL DEFAULT 0,
    "hourlyTarget" INTEGER NOT NULL DEFAULT 0,
    "operatorNames" TEXT NOT NULL DEFAULT '',
    "inputPartsAvailable" INTEGER,
    "defectiveQty" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "slotsJson" JSONB NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringDailySheet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonitoringDailySheet_workspaceId_productionDate_idx"
  ON "MonitoringDailySheet"("workspaceId", "productionDate");
CREATE INDEX "MonitoringDailySheet_workProcessId_idx" ON "MonitoringDailySheet"("workProcessId");

ALTER TABLE "MonitoringDailySheet" ADD CONSTRAINT "MonitoringDailySheet_workProcessId_fkey"
  FOREIGN KEY ("workProcessId") REFERENCES "WorkProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MonitoringStationBoard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productionDate" TEXT NOT NULL,
    "boothId" TEXT,
    "workProcessId" TEXT,
    "boothLabel" TEXT NOT NULL DEFAULT '',
    "processName" TEXT NOT NULL DEFAULT '',
    "partName" TEXT NOT NULL DEFAULT '',
    "lotCode" TEXT NOT NULL DEFAULT '',
    "labelledCycleTimeSec" INTEGER NOT NULL DEFAULT 0,
    "targetPerHour" INTEGER NOT NULL DEFAULT 0,
    "targetPerDay" INTEGER NOT NULL DEFAULT 0,
    "slotsJson" JSONB NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringStationBoard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonitoringStationBoard_workspaceId_productionDate_idx"
  ON "MonitoringStationBoard"("workspaceId", "productionDate");
CREATE INDEX "MonitoringStationBoard_boothId_idx" ON "MonitoringStationBoard"("boothId");

ALTER TABLE "MonitoringStationBoard" ADD CONSTRAINT "MonitoringStationBoard_boothId_fkey"
  FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonitoringStationBoard" ADD CONSTRAINT "MonitoringStationBoard_workProcessId_fkey"
  FOREIGN KEY ("workProcessId") REFERENCES "WorkProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
