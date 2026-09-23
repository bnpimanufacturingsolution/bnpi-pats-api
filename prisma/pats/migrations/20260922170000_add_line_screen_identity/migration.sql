-- Line = station-screen line instance (1 line = 1 screen), leaf-owned under WorkProcess
CREATE TABLE "Line" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "lineCode" TEXT NOT NULL,
    "label" TEXT,
    "assignedLeaderId" TEXT NOT NULL,
    "activeLeaderId" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Line_lineCode_key" ON "Line"("lineCode");
CREATE INDEX "Line_sectionId_idx" ON "Line"("sectionId");
CREATE INDEX "Line_processId_idx" ON "Line"("processId");
CREATE INDEX "Line_activeLeaderId_idx" ON "Line"("activeLeaderId");

ALTER TABLE "Line" ADD CONSTRAINT "Line_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Line" ADD CONSTRAINT "Line_processId_fkey"
  FOREIGN KEY ("processId") REFERENCES "WorkProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Line" ADD CONSTRAINT "Line_assignedLeaderId_fkey"
  FOREIGN KEY ("assignedLeaderId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Line" ADD CONSTRAINT "Line_activeLeaderId_fkey"
  FOREIGN KEY ("activeLeaderId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Operator-on-line assignment (single-line invariant; ENDED rows are evidence)
CREATE TYPE "LineOperatorAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TABLE "LineOperatorAssignment" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "LineOperatorAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "actorSubjectId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LineOperatorAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LineOperatorAssignment_subjectId_status_idx" ON "LineOperatorAssignment"("subjectId", "status");
CREATE INDEX "LineOperatorAssignment_lineId_status_idx" ON "LineOperatorAssignment"("lineId", "status");

ALTER TABLE "LineOperatorAssignment" ADD CONSTRAINT "LineOperatorAssignment_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LineOperatorAssignment" ADD CONSTRAINT "LineOperatorAssignment_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
