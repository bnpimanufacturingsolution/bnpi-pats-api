-- D-040 floor identity model: ProductionLine umbrella for the Section tree, and
-- WorkProcess.subStageId becomes an optional explicit route mapping (no inference).
-- Coordinated backup and row-count review apply to persistent environments; fresh
-- disposable databases may reseed instead.

CREATE TABLE "ProductionLine" (
    "id" TEXT NOT NULL,
    "lineCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductionLine_lineCode_key" ON "ProductionLine"("lineCode");

ALTER TABLE "Section" ADD COLUMN "productionLineId" TEXT;

CREATE INDEX "Section_productionLineId_idx" ON "Section"("productionLineId");

ALTER TABLE "Section" ADD CONSTRAINT "Section_productionLineId_fkey"
  FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkProcess" ALTER COLUMN "subStageId" DROP NOT NULL;
