-- Line → Station → Process (Station replaces Stages). Additive.
CREATE TYPE "ProductionLineKind" AS ENUM ('MANUFACTURING', 'WAREHOUSE');

CREATE TABLE "ProductionLine" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProductionLineKind" NOT NULL DEFAULT 'MANUFACTURING',
    "displayOrder" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProductionLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionLine_workspaceId_kind_idx" ON "ProductionLine"("workspaceId", "kind");

ALTER TABLE "Station" ADD COLUMN "productionLineId" TEXT;
CREATE INDEX "Station_productionLineId_idx" ON "Station"("productionLineId");
ALTER TABLE "Station" ADD CONSTRAINT "Station_productionLineId_fkey"
  FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product" ADD COLUMN "productionLineId" TEXT;
CREATE INDEX "Product_productionLineId_idx" ON "Product"("productionLineId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_productionLineId_fkey"
  FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StationProcess" (
    "stationId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,

    CONSTRAINT "StationProcess_pkey" PRIMARY KEY ("stationId", "processId")
);

CREATE INDEX "StationProcess_processId_idx" ON "StationProcess"("processId");
ALTER TABLE "StationProcess" ADD CONSTRAINT "StationProcess_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StationProcess" ADD CONSTRAINT "StationProcess_processId_fkey"
  FOREIGN KEY ("processId") REFERENCES "WorkProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkProcess" ALTER COLUMN "subStageId" DROP NOT NULL;
