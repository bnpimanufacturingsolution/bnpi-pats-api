-- Optional equipment identity owned by a ProductionLine (admin-configured on
-- the line configuration). Zero-or-more: no rows = no machines. Prints
-- snapshot the machine name as free text, never an FK.
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "productionLineId" TEXT NOT NULL,
    "machineCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Machine_machineCode_key" ON "Machine"("machineCode");

CREATE INDEX "Machine_productionLineId_idx" ON "Machine"("productionLineId");

ALTER TABLE "Machine" ADD CONSTRAINT "Machine_productionLineId_fkey" FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
