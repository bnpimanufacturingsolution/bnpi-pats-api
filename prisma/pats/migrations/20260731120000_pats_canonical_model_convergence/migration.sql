-- Canonical model convergence for full app-API integration.
-- Additive-first: legacy workspace, singular-lot-part, current-position, actor-string, and
-- integer quantity columns remain as compatibility evidence until a later audited retirement.

CREATE TYPE "PlanLifecycleStatus" AS ENUM ('DRAFT', 'READY', 'RELEASED', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AllocationLifecycleStatus" AS ENUM ('DRAFT', 'COMMITTED', 'SUPERSEDED');
CREATE TYPE "RouteVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');
CREATE TYPE "LotStatus" AS ENUM ('PLANNED', 'ACTIVE', 'HELD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "LotPartAllocationStatus" AS ENUM ('PLANNED', 'COMMITTED', 'CLOSED');
CREATE TYPE "MaterialRequirementStatus" AS ENUM ('DRAFT', 'APPROVED', 'ORDERED', 'PARTIALLY_ISSUED', 'FULFILLED', 'CANCELLED');
CREATE TYPE "StageEventStatus" AS ENUM ('RECORDED', 'ACCEPTED', 'BLOCKED', 'CORRECTED');
CREATE TYPE "InventoryTransactionStatus" AS ENUM ('RECORDED', 'ACCEPTED', 'CORRECTED');
CREATE TYPE "RoutingViolationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'WAIVED');
CREATE TYPE "QualityInspectionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "QualityDecisionType" AS ENUM ('PASSED', 'FAILED', 'HOLD');
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');
CREATE TYPE "OutboxMessageStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED', 'DEAD_LETTERED');
CREATE TYPE "IdempotencyRecordStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

ALTER TABLE "Batch"
  ADD COLUMN "createdBySubjectId" TEXT,
  ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "BatchPartLine"
  ADD COLUMN "lotPartAllocationId" TEXT,
  ADD COLUMN "quantityMagnitude" DECIMAL(18,6),
  ADD COLUMN "quantityUom" TEXT;

ALTER TABLE "InventoryTransaction"
  ADD COLUMN "actualQuantityMagnitude" DECIMAL(18,6),
  ADD COLUMN "expectedQuantityMagnitude" DECIMAL(18,6),
  ADD COLUMN "materialRequirementId" TEXT,
  ADD COLUMN "quantityUom" TEXT,
  ADD COLUMN "recordedBySubjectId" TEXT,
  ADD COLUMN "sourceRepresentation" TEXT,
  ADD COLUMN "status" "InventoryTransactionStatus" NOT NULL DEFAULT 'RECORDED',
  ADD COLUMN "usageBasis" TEXT;

ALTER TABLE "Lot"
  ADD COLUMN "quantityMagnitude" DECIMAL(18,6),
  ADD COLUMN "quantityUom" TEXT,
  ADD COLUMN "status" "LotStatus" NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN "usageBasis" TEXT;

ALTER TABLE "Part"
  ADD COLUMN "lifecycleStatus" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "PartsList"
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sourceRevisionRef" TEXT,
  ADD COLUMN "status" "RouteVersionStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "Pmrs"
  ADD COLUMN "externalControlNumber" TEXT,
  ADD COLUMN "revisionLabel" TEXT,
  ADD COLUMN "sourceReference" JSONB,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'attached';

ALTER TABLE "ProcessChangeLog"
  ADD COLUMN "actorSubjectId" TEXT;

ALTER TABLE "ProcessRouteStage"
  ADD COLUMN "stageId" TEXT,
  ADD COLUMN "subStageId" TEXT;

ALTER TABLE "ProductSpecification"
  ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sourceRevisionRef" TEXT;

ALTER TABLE "Project"
  ADD COLUMN "releasedAt" TIMESTAMP(3),
  ADD COLUMN "releasedBySubjectId" TEXT,
  ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "status" "PlanLifecycleStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "ProjectModelAllocation"
  ADD COLUMN "demandPurpose" TEXT,
  ADD COLUMN "lifecycleStatus" "AllocationLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "marketRegion" TEXT,
  ADD COLUMN "quantityMagnitude" DECIMAL(18,6),
  ADD COLUMN "quantityUom" TEXT,
  ADD COLUMN "rowVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sourceRevisionRef" TEXT,
  ADD COLUMN "usageBasis" TEXT;

ALTER TABLE "RoutingViolation"
  ADD COLUMN "resolvedBySubjectId" TEXT,
  ADD COLUMN "status" "RoutingViolationStatus" NOT NULL DEFAULT 'OPEN';

ALTER TABLE "StageEvent"
  ADD COLUMN "actorSubjectId" TEXT,
  ADD COLUMN "quantityMagnitude" DECIMAL(18,6),
  ADD COLUMN "quantityUom" TEXT,
  ADD COLUMN "routeStepId" TEXT,
  ADD COLUMN "sourceRepresentation" TEXT,
  ADD COLUMN "status" "StageEventStatus" NOT NULL DEFAULT 'RECORDED',
  ADD COLUMN "usageBasis" TEXT;

ALTER TABLE "Station"
  ADD COLUMN "operationalContextKey" TEXT NOT NULL DEFAULT 'PATS',
  ADD COLUMN "stationCode" TEXT;

ALTER TABLE "WorkInstruction"
  ADD COLUMN "sourceRevisionRef" TEXT,
  ADD COLUMN "status" "RouteVersionStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "WorkflowGroup"
  DROP CONSTRAINT "WorkflowGroup_projectId_fkey";

ALTER TABLE "WorkflowGroup"
  ADD COLUMN "lifecycleStatus" "CatalogLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ALTER COLUMN "projectId" DROP NOT NULL;

CREATE TABLE "PlanDemandAllocation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "marketRegion" TEXT NOT NULL,
  "demandPurpose" TEXT NOT NULL,
  "quantityMagnitude" DECIMAL(18,6) NOT NULL,
  "quantityUom" TEXT NOT NULL,
  "usageBasis" TEXT,
  "sourceRevisionRef" TEXT,
  "lifecycleStatus" "AllocationLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanDemandAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialRequirement" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "partId" TEXT,
  "externalReference" TEXT,
  "quantityMagnitude" DECIMAL(18,6) NOT NULL,
  "quantityUom" TEXT NOT NULL,
  "usageBasis" TEXT,
  "sourceRevisionRef" TEXT,
  "status" "MaterialRequirementStatus" NOT NULL DEFAULT 'DRAFT',
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaterialRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LotPartAllocation" (
  "id" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "quantityMagnitude" DECIMAL(18,6) NOT NULL,
  "quantityUom" TEXT NOT NULL,
  "usageBasis" TEXT,
  "status" "LotPartAllocationStatus" NOT NULL DEFAULT 'PLANNED',
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LotPartAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BatchPositionProjection" (
  "batchId" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "subStageId" TEXT,
  "routeStepId" TEXT,
  "lastEventId" TEXT,
  "positionStatus" "StageEventStatus" NOT NULL DEFAULT 'ACCEPTED',
  "quantityMagnitude" DECIMAL(18,6),
  "quantityUom" TEXT,
  "projectionVersion" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BatchPositionProjection_pkey" PRIMARY KEY ("batchId")
);

CREATE TABLE "QualityInspection" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "subStageId" TEXT,
  "stationId" TEXT,
  "inspectedQuantity" DECIMAL(18,6),
  "quantityUom" TEXT,
  "status" "QualityInspectionStatus" NOT NULL DEFAULT 'OPEN',
  "inspectedBySubjectId" TEXT,
  "evidence" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QualityInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QualityDecision" (
  "id" TEXT NOT NULL,
  "inspectionId" TEXT NOT NULL,
  "decision" "QualityDecisionType" NOT NULL,
  "reasonCode" TEXT,
  "reasonNote" TEXT,
  "decidedBySubjectId" TEXT,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditRecord" (
  "id" TEXT NOT NULL,
  "actorSubjectId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "outcome" "AuditOutcome" NOT NULL,
  "reason" TEXT,
  "correlationId" TEXT,
  "detail" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboxMessage" (
  "id" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "status" "OutboxMessageStatus" NOT NULL DEFAULT 'PENDING',
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" "IdempotencyRecordStatus" NOT NULL DEFAULT 'PENDING',
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanDemandAllocation_projectId_lifecycleStatus_idx" ON "PlanDemandAllocation"("projectId", "lifecycleStatus");
CREATE INDEX "PlanDemandAllocation_modelId_marketRegion_demandPurpose_idx" ON "PlanDemandAllocation"("modelId", "marketRegion", "demandPurpose");
CREATE INDEX "MaterialRequirement_projectId_status_idx" ON "MaterialRequirement"("projectId", "status");
CREATE INDEX "MaterialRequirement_partId_idx" ON "MaterialRequirement"("partId");
CREATE UNIQUE INDEX "LotPartAllocation_lotId_partId_key" ON "LotPartAllocation"("lotId", "partId");
CREATE INDEX "LotPartAllocation_partId_idx" ON "LotPartAllocation"("partId");
CREATE UNIQUE INDEX "BatchPositionProjection_lastEventId_key" ON "BatchPositionProjection"("lastEventId");
CREATE INDEX "BatchPositionProjection_stageId_subStageId_idx" ON "BatchPositionProjection"("stageId", "subStageId");
CREATE INDEX "QualityInspection_batchId_createdAt_idx" ON "QualityInspection"("batchId", "createdAt");
CREATE INDEX "QualityInspection_status_createdAt_idx" ON "QualityInspection"("status", "createdAt");
CREATE INDEX "QualityDecision_inspectionId_decidedAt_idx" ON "QualityDecision"("inspectionId", "decidedAt");
CREATE INDEX "AuditRecord_resourceType_resourceId_occurredAt_idx" ON "AuditRecord"("resourceType", "resourceId", "occurredAt");
CREATE INDEX "AuditRecord_actorSubjectId_occurredAt_idx" ON "AuditRecord"("actorSubjectId", "occurredAt");
CREATE INDEX "AuditRecord_correlationId_idx" ON "AuditRecord"("correlationId");
CREATE INDEX "OutboxMessage_status_availableAt_idx" ON "OutboxMessage"("status", "availableAt");
CREATE INDEX "OutboxMessage_aggregateType_aggregateId_createdAt_idx" ON "OutboxMessage"("aggregateType", "aggregateId", "createdAt");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
CREATE UNIQUE INDEX "IdempotencyRecord_subjectId_operation_idempotencyKey_key" ON "IdempotencyRecord"("subjectId", "operation", "idempotencyKey");
CREATE UNIQUE INDEX "Station_stationCode_key" ON "Station"("stationCode");

ALTER TABLE "WorkflowGroup"
  ADD CONSTRAINT "WorkflowGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Recreate the pre-existing foreign keys with the canonical Prisma referential-action shape.
-- These are metadata-only changes; no rows are removed.
ALTER TABLE "BomDefinition" DROP CONSTRAINT "BomDefinition_modelId_fkey";
ALTER TABLE "BomLine" DROP CONSTRAINT "BomLine_bomDefinitionId_fkey";
ALTER TABLE "CanonicalCrosswalk" DROP CONSTRAINT "CanonicalCrosswalk_sourceEvidenceId_fkey";
ALTER TABLE "CanonicalEvidenceLink" DROP CONSTRAINT "CanonicalEvidenceLink_sourceEvidenceId_fkey";
ALTER TABLE "ProcessRoute" DROP CONSTRAINT "ProcessRoute_modelId_fkey";
ALTER TABLE "ProcessRouteStage" DROP CONSTRAINT "ProcessRouteStage_processRouteId_fkey";
ALTER TABLE "SourceArtifact" DROP CONSTRAINT "SourceArtifact_sourceRunId_fkey";
ALTER TABLE "SourceEvidence" DROP CONSTRAINT "SourceEvidence_sourceArtifactId_fkey";
ALTER TABLE "SourceIssue" DROP CONSTRAINT "SourceIssue_sourceArtifactId_fkey";

ALTER TABLE "BomDefinition"
  ADD CONSTRAINT "BomDefinition_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BomLine"
  ADD CONSTRAINT "BomLine_bomDefinitionId_fkey" FOREIGN KEY ("bomDefinitionId") REFERENCES "BomDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessRoute"
  ADD CONSTRAINT "ProcessRoute_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessRouteStage"
  ADD CONSTRAINT "ProcessRouteStage_processRouteId_fkey" FOREIGN KEY ("processRouteId") REFERENCES "ProcessRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceArtifact"
  ADD CONSTRAINT "SourceArtifact_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "SourceRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceIssue"
  ADD CONSTRAINT "SourceIssue_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "SourceArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SourceEvidence"
  ADD CONSTRAINT "SourceEvidence_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "SourceArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CanonicalEvidenceLink"
  ADD CONSTRAINT "CanonicalEvidenceLink_sourceEvidenceId_fkey" FOREIGN KEY ("sourceEvidenceId") REFERENCES "SourceEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CanonicalCrosswalk"
  ADD CONSTRAINT "CanonicalCrosswalk_sourceEvidenceId_fkey" FOREIGN KEY ("sourceEvidenceId") REFERENCES "SourceEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_releasedBySubjectId_fkey" FOREIGN KEY ("releasedBySubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Batch"
  ADD CONSTRAINT "Batch_createdBySubjectId_fkey" FOREIGN KEY ("createdBySubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BatchPartLine"
  ADD CONSTRAINT "BatchPartLine_lotPartAllocationId_fkey" FOREIGN KEY ("lotPartAllocationId") REFERENCES "LotPartAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcessRouteStage"
  ADD CONSTRAINT "ProcessRouteStage_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProcessRouteStage_subStageId_fkey" FOREIGN KEY ("subStageId") REFERENCES "SubStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StageEvent"
  ADD CONSTRAINT "StageEvent_routeStepId_fkey" FOREIGN KEY ("routeStepId") REFERENCES "RoutingStep"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "StageEvent_actorSubjectId_fkey" FOREIGN KEY ("actorSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryTransaction_recordedBySubjectId_fkey" FOREIGN KEY ("recordedBySubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryTransaction_materialRequirementId_fkey" FOREIGN KEY ("materialRequirementId") REFERENCES "MaterialRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutingViolation"
  ADD CONSTRAINT "RoutingViolation_resolvedBySubjectId_fkey" FOREIGN KEY ("resolvedBySubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcessChangeLog"
  ADD CONSTRAINT "ProcessChangeLog_actorSubjectId_fkey" FOREIGN KEY ("actorSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StationStep"
  ADD CONSTRAINT "StationStep_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StationStep_subStageId_fkey" FOREIGN KEY ("subStageId") REFERENCES "SubStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanDemandAllocation"
  ADD CONSTRAINT "PlanDemandAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PlanDemandAllocation_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialRequirement"
  ADD CONSTRAINT "MaterialRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialRequirement_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LotPartAllocation"
  ADD CONSTRAINT "LotPartAllocation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "LotPartAllocation_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchPositionProjection"
  ADD CONSTRAINT "BatchPositionProjection_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QualityInspection"
  ADD CONSTRAINT "QualityInspection_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "QualityInspection_inspectedBySubjectId_fkey" FOREIGN KEY ("inspectedBySubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QualityDecision"
  ADD CONSTRAINT "QualityDecision_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "QualityInspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "QualityDecision_decidedBySubjectId_fkey" FOREIGN KEY ("decidedBySubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditRecord"
  ADD CONSTRAINT "AuditRecord_actorSubjectId_fkey" FOREIGN KEY ("actorSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IdempotencyRecord"
  ADD CONSTRAINT "IdempotencyRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER INDEX "CanonicalEvidenceLink_sourceEvidenceId_subjectType_subjectId_relation_key"
  RENAME TO "CanonicalEvidenceLink_sourceEvidenceId_subjectType_subjectI_key";
