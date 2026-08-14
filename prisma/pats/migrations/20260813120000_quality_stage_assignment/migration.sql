-- Journey D stage allow-list (v1 stage grain). Fail closed without ACTIVE rows.
CREATE TYPE "QualityStageAssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

CREATE TABLE "QualityStageAssignment" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" "QualityStageAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityStageAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QualityStageAssignment_subjectId_workspaceId_stageId_key"
  ON "QualityStageAssignment"("subjectId", "workspaceId", "stageId");
CREATE INDEX "QualityStageAssignment_subjectId_workspaceId_status_idx"
  ON "QualityStageAssignment"("subjectId", "workspaceId", "status");
CREATE INDEX "QualityStageAssignment_stageId_idx" ON "QualityStageAssignment"("stageId");

ALTER TABLE "QualityStageAssignment" ADD CONSTRAINT "QualityStageAssignment_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QualityStageAssignment" ADD CONSTRAINT "QualityStageAssignment_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
