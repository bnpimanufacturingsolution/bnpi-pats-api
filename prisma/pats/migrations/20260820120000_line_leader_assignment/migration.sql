-- Journey B encode scope. Not a fourth business role.
CREATE TYPE "LineLeaderAssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

CREATE TABLE "LineLeaderAssignment" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "subStageId" TEXT,
    "workProcessId" TEXT,
    "status" "LineLeaderAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LineLeaderAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LineLeaderAssignment_active_scope_key"
  ON "LineLeaderAssignment" ("subjectId", "workspaceId", "stageId", COALESCE("subStageId", ''), COALESCE("workProcessId", ''))
  WHERE "status" = 'ACTIVE';

CREATE INDEX "LineLeaderAssignment_subjectId_workspaceId_status_idx"
  ON "LineLeaderAssignment"("subjectId", "workspaceId", "status");
CREATE INDEX "LineLeaderAssignment_stageId_subStageId_idx"
  ON "LineLeaderAssignment"("stageId", "subStageId");

ALTER TABLE "LineLeaderAssignment" ADD CONSTRAINT "LineLeaderAssignment_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LineLeaderAssignment" ADD CONSTRAINT "LineLeaderAssignment_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LineLeaderAssignment" ADD CONSTRAINT "LineLeaderAssignment_subStageId_fkey"
  FOREIGN KEY ("subStageId") REFERENCES "SubStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LineLeaderAssignment" ADD CONSTRAINT "LineLeaderAssignment_workProcessId_fkey"
  FOREIGN KEY ("workProcessId") REFERENCES "WorkProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MonitoringDailySheet" ADD COLUMN "stageId" TEXT;
ALTER TABLE "MonitoringDailySheet" ADD COLUMN "subStageId" TEXT;
ALTER TABLE "MonitoringDailySheet" ADD COLUMN "encodedBySubjectId" TEXT;

CREATE INDEX "MonitoringDailySheet_encodedBySubjectId_idx" ON "MonitoringDailySheet"("encodedBySubjectId");

ALTER TABLE "MonitoringDailySheet" ADD CONSTRAINT "MonitoringDailySheet_encodedBySubjectId_fkey"
  FOREIGN KEY ("encodedBySubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
