-- D-045 QC verdict-only redesign (2026-10-01, pre-production destructive):
-- QualityDecision drops reason/failure columns (QC tags verdicts only);
-- production owns defect analysis in the new DefectAnalysis table.
ALTER TABLE "QualityDecision" DROP COLUMN "failureDisposition";
ALTER TABLE "QualityDecision" DROP COLUMN "reasonCode";
ALTER TABLE "QualityDecision" DROP COLUMN "reasonNote";

DROP TYPE "QualityFailureDisposition";

-- CreateEnum
CREATE TYPE "DefectDisposition" AS ENUM ('REWORK', 'SCRAP', 'WAIVE');

-- CreateTable
CREATE TABLE "DefectAnalysis" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonNote" TEXT,
    "disposition" "DefectDisposition" NOT NULL,
    "decidedBySubjectId" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefectAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DefectAnalysis_inspectionId_key" ON "DefectAnalysis"("inspectionId");

CREATE INDEX "DefectAnalysis_batchId_decidedAt_idx" ON "DefectAnalysis"("batchId", "decidedAt");

ALTER TABLE "DefectAnalysis" ADD CONSTRAINT "DefectAnalysis_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "QualityInspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DefectAnalysis" ADD CONSTRAINT "DefectAnalysis_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DefectAnalysis" ADD CONSTRAINT "DefectAnalysis_decidedBySubjectId_fkey" FOREIGN KEY ("decidedBySubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
