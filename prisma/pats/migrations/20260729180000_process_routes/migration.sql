-- Additive normalized ProcessRoute/ProcessRouteStage relationships.
-- This migration is prepared for isolated validation only; it is not applied by this pass.

ALTER TYPE "CanonicalEvidenceSubjectType" ADD VALUE IF NOT EXISTS 'PROCESS_ROUTE';
ALTER TYPE "CanonicalEvidenceSubjectType" ADD VALUE IF NOT EXISTS 'ROUTE_STAGE';

CREATE TABLE "ProcessRoute" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "lifecycleStatus" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "evidenceStatus" "CanonicalEvidenceStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessRouteStage" (
    "id" TEXT NOT NULL,
    "processRouteId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stageKey" TEXT,
    "stageName" TEXT,
    "stageDefinitionId" TEXT,
    "subStageKey" TEXT,
    "subStageName" TEXT,
    "operationCode" TEXT,
    "operationName" TEXT,
    "sourceRepresentation" TEXT,
    "lifecycleStatus" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "evidenceStatus" "CanonicalEvidenceStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessRouteStage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProcessRouteStage_sequence_check" CHECK ("sequence" > 0),
    CONSTRAINT "ProcessRouteStage_identity_check" CHECK (
        "stageKey" IS NOT NULL OR "stageName" IS NOT NULL OR "stageDefinitionId" IS NOT NULL
    )
);

CREATE UNIQUE INDEX "ProcessRoute_modelId_revision_key" ON "ProcessRoute"("modelId", "revision");
CREATE INDEX "ProcessRoute_modelId_idx" ON "ProcessRoute"("modelId");
CREATE UNIQUE INDEX "ProcessRouteStage_processRouteId_sequence_key"
    ON "ProcessRouteStage"("processRouteId", "sequence");
CREATE INDEX "ProcessRouteStage_processRouteId_idx" ON "ProcessRouteStage"("processRouteId");

ALTER TABLE "ProcessRoute"
    ADD CONSTRAINT "ProcessRoute_modelId_fkey"
    FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcessRouteStage"
    ADD CONSTRAINT "ProcessRouteStage_processRouteId_fkey"
    FOREIGN KEY ("processRouteId") REFERENCES "ProcessRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
