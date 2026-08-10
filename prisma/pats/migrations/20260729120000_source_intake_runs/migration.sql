-- Source-backed intake runs and derived reports.
-- Raw workbook/PDF bytes remain in Drive or object storage; PostgreSQL stores
-- provenance, extracted analysis, report text, and issues.

CREATE TYPE "SourceRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

CREATE TYPE "SourceArtifactType" AS ENUM ('WORKBOOK', 'PDF', 'OTHER');

CREATE TYPE "SourceExtractionStatus" AS ENUM ('COMPLETED', 'PARTIAL', 'FAILED');

CREATE TABLE "SourceRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "status" "SourceRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SourceRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceArtifact" (
    "id" TEXT NOT NULL,
    "sourceRunId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "artifactType" "SourceArtifactType" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "productCode" TEXT,
    "extractionStatus" "SourceExtractionStatus" NOT NULL,
    "analysis" JSONB NOT NULL,
    "reportMarkdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceIssue" (
    "id" TEXT NOT NULL,
    "sourceArtifactId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sheet" TEXT,
    "address" TEXT,
    "value" JSONB,
    "canonicalValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourceRun_workspaceId_startedAt_idx" ON "SourceRun"("workspaceId", "startedAt");
CREATE UNIQUE INDEX "SourceArtifact_sourceRunId_fileName_key" ON "SourceArtifact"("sourceRunId", "fileName");
CREATE INDEX "SourceArtifact_sourceRunId_idx" ON "SourceArtifact"("sourceRunId");
CREATE INDEX "SourceArtifact_sha256_idx" ON "SourceArtifact"("sha256");
CREATE INDEX "SourceIssue_sourceArtifactId_idx" ON "SourceIssue"("sourceArtifactId");
CREATE INDEX "SourceIssue_code_status_idx" ON "SourceIssue"("code", "status");

ALTER TABLE "SourceArtifact"
    ADD CONSTRAINT "SourceArtifact_sourceRunId_fkey"
    FOREIGN KEY ("sourceRunId") REFERENCES "SourceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SourceIssue"
    ADD CONSTRAINT "SourceIssue_sourceArtifactId_fkey"
    FOREIGN KEY ("sourceArtifactId") REFERENCES "SourceArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
