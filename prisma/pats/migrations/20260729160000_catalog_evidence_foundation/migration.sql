-- Additive Product/Model/ModelPart evidence foundation.
-- This migration is prepared for isolated validation only; it is not applied by this pass.

CREATE TYPE "CatalogLifecycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "CanonicalEvidenceStatus" AS ENUM (
    'CONFIRMED',
    'INFERRED',
    'PROVISIONAL',
    'SOURCE_ANOMALY',
    'UNAVAILABLE_DEPENDENCY',
    'NEEDS_CONFIRMATION',
    'CONFLICTING',
    'STALE'
);
CREATE TYPE "SourceEvidenceLocatorType" AS ENUM ('WORKBOOK_CELL', 'WORKBOOK_RANGE', 'PDF_PAGE', 'PDF_TEXT', 'OTHER');
CREATE TYPE "CanonicalEvidenceSubjectType" AS ENUM ('PRODUCT', 'MODEL', 'MODEL_PART');

ALTER TABLE "Product"
    ADD COLUMN "lifecycleStatus" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "evidenceStatus" "CanonicalEvidenceStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Model"
    ALTER COLUMN "skuCode" DROP NOT NULL,
    ADD COLUMN "lifecycleStatus" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "evidenceStatus" "CanonicalEvidenceStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ModelPart"
    ADD COLUMN "lifecycleStatus" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "evidenceStatus" "CanonicalEvidenceStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "SourceEvidence" (
    "id" TEXT NOT NULL,
    "sourceArtifactId" TEXT NOT NULL,
    "sourceIssueId" TEXT,
    "locatorType" "SourceEvidenceLocatorType" NOT NULL,
    "sheet" TEXT,
    "address" TEXT,
    "page" INTEGER,
    "rawValue" JSONB,
    "formulaText" TEXT,
    "cachedValue" JSONB,
    "normalizedValue" JSONB,
    "quantityBasis" TEXT,
    "dependencyState" TEXT,
    "evidenceStatus" "CanonicalEvidenceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CanonicalEvidenceLink" (
    "id" TEXT NOT NULL,
    "sourceEvidenceId" TEXT NOT NULL,
    "subjectType" "CanonicalEvidenceSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalEvidenceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CanonicalCrosswalk" (
    "id" TEXT NOT NULL,
    "sourceEvidenceId" TEXT NOT NULL,
    "subjectType" "CanonicalEvidenceSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "rawValue" TEXT NOT NULL,
    "canonicalValue" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "rationale" TEXT,
    "status" "CanonicalEvidenceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalCrosswalk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourceEvidence_sourceArtifactId_idx" ON "SourceEvidence"("sourceArtifactId");
CREATE INDEX "SourceEvidence_sourceIssueId_idx" ON "SourceEvidence"("sourceIssueId");
CREATE INDEX "SourceEvidence_evidenceStatus_idx" ON "SourceEvidence"("evidenceStatus");
CREATE UNIQUE INDEX "CanonicalEvidenceLink_sourceEvidenceId_subjectType_subjectId_relation_key"
    ON "CanonicalEvidenceLink"("sourceEvidenceId", "subjectType", "subjectId", "relation");
CREATE INDEX "CanonicalEvidenceLink_subjectType_subjectId_idx"
    ON "CanonicalEvidenceLink"("subjectType", "subjectId");
CREATE INDEX "CanonicalCrosswalk_subjectType_subjectId_idx"
    ON "CanonicalCrosswalk"("subjectType", "subjectId");
CREATE INDEX "CanonicalCrosswalk_rawValue_idx" ON "CanonicalCrosswalk"("rawValue");

ALTER TABLE "SourceEvidence"
    ADD CONSTRAINT "SourceEvidence_sourceArtifactId_fkey"
    FOREIGN KEY ("sourceArtifactId") REFERENCES "SourceArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SourceEvidence"
    ADD CONSTRAINT "SourceEvidence_sourceIssueId_fkey"
    FOREIGN KEY ("sourceIssueId") REFERENCES "SourceIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CanonicalEvidenceLink"
    ADD CONSTRAINT "CanonicalEvidenceLink_sourceEvidenceId_fkey"
    FOREIGN KEY ("sourceEvidenceId") REFERENCES "SourceEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanonicalCrosswalk"
    ADD CONSTRAINT "CanonicalCrosswalk_sourceEvidenceId_fkey"
    FOREIGN KEY ("sourceEvidenceId") REFERENCES "SourceEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
