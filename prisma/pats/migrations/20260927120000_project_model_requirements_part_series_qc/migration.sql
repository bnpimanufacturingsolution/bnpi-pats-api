-- D-041 Project model-quantity/series/QC direction (2026-09-27).
-- Preflight 2026-09-27 (disposable dev DB): Project 17 (DRAFT 8, READY 1, RELEASED 5,
-- PAUSED 1, COMPLETED 2), ProjectModelAllocation 39, Part 248, Lot 10, Batch 28.
-- Backup: backups/pats-pre-model-series-qc-20260927.dump. Historical migrations untouched.
--
-- Scope: rename ProjectModelAllocation to ProjectModelRequirement (data migrated, not
-- dropped); shrink ProjectLifecycleStatus to DRAFT/RELEASED/COMPLETED; add Project
-- completion columns, Part/Batch requirement lineage, Batch series identity, and QC
-- failure disposition. READY/PAUSED rows predate the D-041 direction and reseed as DRAFT.

-- Remap pre-direction statuses before narrowing the enum.
UPDATE "Project" SET "status" = 'DRAFT' WHERE "status" IN ('READY', 'PAUSED');

-- Narrow the lifecycle enum.
CREATE TYPE "ProjectLifecycleStatus_new" AS ENUM ('DRAFT', 'RELEASED', 'COMPLETED');
ALTER TABLE "Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "status" TYPE "ProjectLifecycleStatus_new" USING ("status"::text::"ProjectLifecycleStatus_new");
ALTER TYPE "ProjectLifecycleStatus" RENAME TO "ProjectLifecycleStatus_old";
ALTER TYPE "ProjectLifecycleStatus_new" RENAME TO "ProjectLifecycleStatus";
DROP TYPE "ProjectLifecycleStatus_old";
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Project completion evidence + derived-total default.
ALTER TABLE "Project" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "completedBySubjectId" TEXT;
ALTER TABLE "Project" ALTER COLUMN "requiredProductionQuantity" SET DEFAULT 0;

-- Requirement table replaces the allocation table; preserve existing rows.
CREATE TABLE "ProjectModelRequirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "requiredQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectModelRequirement_pkey" PRIMARY KEY ("id")
);
INSERT INTO "ProjectModelRequirement" ("id", "projectId", "modelId", "requiredQuantity", "createdAt")
    SELECT "id", "projectId", "modelId", "plannedQuantity", "createdAt" FROM "ProjectModelAllocation";
CREATE UNIQUE INDEX "ProjectModelRequirement_projectId_modelId_key" ON "ProjectModelRequirement"("projectId", "modelId");
CREATE INDEX "ProjectModelRequirement_projectId_idx" ON "ProjectModelRequirement"("projectId");
CREATE INDEX "ProjectModelRequirement_modelId_idx" ON "ProjectModelRequirement"("modelId");
ALTER TABLE "ProjectModelRequirement" ADD CONSTRAINT "ProjectModelRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectModelRequirement" ADD CONSTRAINT "ProjectModelRequirement_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Re-point Batch lineage, then drop the allocation table.
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_projectModelAllocationId_fkey";
ALTER TABLE "Batch" RENAME COLUMN "projectModelAllocationId" TO "projectModelRequirementId";
ALTER TABLE "Batch" ADD COLUMN "seriesNumber" INTEGER;
ALTER TABLE "Batch" ADD COLUMN "seriesCount" INTEGER;
CREATE INDEX "Batch_projectModelRequirementId_idx" ON "Batch"("projectModelRequirementId");
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_projectModelRequirementId_fkey" FOREIGN KEY ("projectModelRequirementId") REFERENCES "ProjectModelRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectModelAllocation" DROP CONSTRAINT "ProjectModelAllocation_modelId_fkey";
ALTER TABLE "ProjectModelAllocation" DROP CONSTRAINT "ProjectModelAllocation_projectId_fkey";
DROP TABLE "ProjectModelAllocation";
DROP TYPE "AllocationLifecycleStatus";

-- Part lineage to its model requirement.
ALTER TABLE "Part" ADD COLUMN "projectModelRequirementId" TEXT;
CREATE INDEX "Part_projectModelRequirementId_idx" ON "Part"("projectModelRequirementId");
ALTER TABLE "Part" ADD CONSTRAINT "Part_projectModelRequirementId_fkey" FOREIGN KEY ("projectModelRequirementId") REFERENCES "ProjectModelRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- QC failure disposition.
CREATE TYPE "QualityFailureDisposition" AS ENUM ('REWORK', 'TRUE_NG');
ALTER TABLE "QualityDecision" ADD COLUMN "failureDisposition" "QualityFailureDisposition";

-- Project completion actor.
ALTER TABLE "Project" ADD CONSTRAINT "Project_completedBySubjectId_fkey" FOREIGN KEY ("completedBySubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
