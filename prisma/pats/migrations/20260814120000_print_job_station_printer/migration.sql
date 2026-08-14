-- AlterTable
ALTER TABLE "Station" ADD COLUMN "printerConnection" TEXT;
ALTER TABLE "Station" ADD COLUMN "printerAddress" TEXT;
ALTER TABLE "Station" ADD COLUMN "printerLanguage" TEXT;
ALTER TABLE "Station" ADD COLUMN "printerDpi" INTEGER;
ALTER TABLE "Station" ADD COLUMN "printerModel" TEXT;
ALTER TABLE "Station" ADD COLUMN "labelWidthMm" INTEGER;
ALTER TABLE "Station" ADD COLUMN "labelHeightMm" INTEGER;
ALTER TABLE "Station" ADD COLUMN "printerAgent" TEXT;

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SIMULATED');

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "fromStageId" TEXT NOT NULL,
    "fromSubStageId" TEXT,
    "toStageId" TEXT,
    "toSubStageId" TEXT,
    "barcodeValue" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "reprintOf" TEXT,
    "language" TEXT NOT NULL,
    "renderedPayload" TEXT NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'QUEUED',
    "failureReason" TEXT,
    "actor" TEXT NOT NULL,
    "actorSubjectId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintJob_batchId_occurredAt_idx" ON "PrintJob"("batchId", "occurredAt");

-- CreateIndex
CREATE INDEX "PrintJob_stationId_occurredAt_idx" ON "PrintJob"("stationId", "occurredAt");

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
