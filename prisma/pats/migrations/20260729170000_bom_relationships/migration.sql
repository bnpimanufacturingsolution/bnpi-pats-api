-- Additive normalized BOM/model-part relationships.
-- This migration is prepared for isolated validation only; it is not applied by this pass.

ALTER TYPE "CanonicalEvidenceSubjectType" ADD VALUE IF NOT EXISTS 'BOM_DEFINITION';
ALTER TYPE "CanonicalEvidenceSubjectType" ADD VALUE IF NOT EXISTS 'BOM_LINE';
CREATE TYPE "BomRelationshipKind" AS ENUM (
    'COMPONENT',
    'ASSEMBLY_COMPONENT',
    'DECORATION_INPUT',
    'PACKAGING_COMPONENT',
    'OTHER'
);

CREATE TABLE "BomDefinition" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "lifecycleStatus" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "evidenceStatus" "CanonicalEvidenceStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL,
    "bomDefinitionId" TEXT NOT NULL,
    "modelPartId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "relationshipKind" "BomRelationshipKind" NOT NULL,
    "quantityMagnitude" DOUBLE PRECISION,
    "quantityUom" TEXT,
    "usageBasis" TEXT,
    "sourceRepresentation" TEXT,
    "lifecycleStatus" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "evidenceStatus" "CanonicalEvidenceStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BomLine_lineNumber_check" CHECK ("lineNumber" > 0),
    CONSTRAINT "BomLine_quantityMagnitude_check" CHECK ("quantityMagnitude" IS NULL OR "quantityMagnitude" > 0)
);

CREATE UNIQUE INDEX "BomDefinition_modelId_revision_key" ON "BomDefinition"("modelId", "revision");
CREATE INDEX "BomDefinition_modelId_idx" ON "BomDefinition"("modelId");
CREATE UNIQUE INDEX "BomLine_bomDefinitionId_lineNumber_key" ON "BomLine"("bomDefinitionId", "lineNumber");
CREATE INDEX "BomLine_bomDefinitionId_idx" ON "BomLine"("bomDefinitionId");
CREATE INDEX "BomLine_modelPartId_idx" ON "BomLine"("modelPartId");

ALTER TABLE "BomDefinition"
    ADD CONSTRAINT "BomDefinition_modelId_fkey"
    FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BomLine"
    ADD CONSTRAINT "BomLine_bomDefinitionId_fkey"
    FOREIGN KEY ("bomDefinitionId") REFERENCES "BomDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "BomLine_modelPartId_fkey"
    FOREIGN KEY ("modelPartId") REFERENCES "ModelPart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
