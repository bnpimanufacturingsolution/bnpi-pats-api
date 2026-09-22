-- AlterTable
ALTER TABLE "WorkProcess" ADD COLUMN     "parentProcessId" TEXT;
ALTER TABLE "WorkProcess" ADD COLUMN     "sectionId" TEXT;

-- CreateIndex
CREATE INDEX "WorkProcess_sectionId_idx" ON "WorkProcess"("sectionId");

-- CreateIndex
CREATE INDEX "WorkProcess_parentProcessId_idx" ON "WorkProcess"("parentProcessId");

-- AddForeignKey
ALTER TABLE "WorkProcess" ADD CONSTRAINT "WorkProcess_parentProcessId_fkey" FOREIGN KEY ("parentProcessId") REFERENCES "WorkProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
