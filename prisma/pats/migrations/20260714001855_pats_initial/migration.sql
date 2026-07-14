-- CreateEnum
CREATE TYPE "LinkageMode" AS ENUM ('LINKED', 'STANDALONE');

-- CreateEnum
CREATE TYPE "ProductSourceStatus" AS ENUM ('source-aligned', 'needs-confirmation', 'MANUAL');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PLANNED', 'ACTIVE', 'HELD', 'CLOSED', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "StageEventType" AS ENUM ('STAGE_SCAN_RECORDED', 'ROUTE_VALIDATED', 'ROUTING_VIOLATION_DETECTED', 'STAGE_COMPLETED', 'VARIANCE_FLAG_RAISED');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('RECEIVING', 'ISSUANCE');

-- CreateEnum
CREATE TYPE "ScreenType" AS ENUM ('COMPUTER', 'TABLET');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('EN', 'JA', 'FIL');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "modelNumber" TEXT NOT NULL,
    "modelName" TEXT,
    "sourceStatus" "ProductSourceStatus" NOT NULL,
    "sourceReference" JSONB,
    "skuCode" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPart" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "partCode" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "routingSteps" JSONB NOT NULL,

    CONSTRAINT "ModelPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowGroup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "linkageMode" "LinkageMode" NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isSystemSeed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorkflowGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "workflowGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLocalized" JSONB,
    "displayOrder" INTEGER NOT NULL,
    "isSystemSeed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLocalized" JSONB,
    "displayOrder" INTEGER NOT NULL,
    "isSystemSeed" BOOLEAN NOT NULL DEFAULT false,
    "isConfigurable" BOOLEAN NOT NULL DEFAULT true,
    "isBuffer" BOOLEAN NOT NULL DEFAULT false,
    "hasQualityCheckpoint" BOOLEAN NOT NULL DEFAULT false,
    "isMandatoryCheckpoint" BOOLEAN NOT NULL DEFAULT false,
    "alwaysAlertOnRoutingViolation" BOOLEAN NOT NULL DEFAULT true,
    "subProcessGroup" TEXT,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SubStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubStageEligibility" (
    "stageId" TEXT NOT NULL,
    "subStageId" TEXT NOT NULL,

    CONSTRAINT "SubStageEligibility_pkey" PRIMARY KEY ("stageId","subStageId")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiredProductionQuantity" INTEGER NOT NULL,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectModelAllocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectModelAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSpecification" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "trayQuantityStandard" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pmrs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partsListId" TEXT,

    CONSTRAINT "Pmrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartsList" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartsList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingStep" (
    "id" TEXT NOT NULL,
    "partsListId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "subStageId" TEXT,
    "stepOrder" INTEGER NOT NULL,

    CONSTRAINT "RoutingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partCode" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "sourceModelId" TEXT,
    "sourceModelPartId" TEXT,
    "variancePercentThreshold" DOUBLE PRECISION,
    "varianceAbsoluteFloor" INTEGER,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lotCode" TEXT NOT NULL,
    "lotName" TEXT NOT NULL,
    "partsListId" TEXT NOT NULL,
    "partsListVersion" INTEGER NOT NULL,
    "partId" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "requiredProductionQuantity" INTEGER NOT NULL,
    "labelPackSize" INTEGER NOT NULL,
    "createdAtStage" TEXT NOT NULL DEFAULT 'Planning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "barcodeValue" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "labelPackSize" INTEGER NOT NULL,
    "projectModelAllocationId" TEXT,
    "currentStageId" TEXT NOT NULL,
    "currentSubStageId" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchPartLine" (
    "batchId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "BatchPartLine_pkey" PRIMARY KEY ("batchId","partId")
);

-- CreateTable
CREATE TABLE "StageEvent" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "subStageId" TEXT,
    "eventType" "StageEventType" NOT NULL,
    "batchId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "partId" TEXT,
    "quantity" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actor" TEXT NOT NULL,
    "isRoutingViolation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "transactionType" "InventoryTransactionType" NOT NULL,
    "batchId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "fromSubStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "toSubStageId" TEXT,
    "expectedQuantity" INTEGER NOT NULL,
    "actualQuantity" INTEGER NOT NULL,
    "withdrawalFormRef" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingViolation" (
    "id" TEXT NOT NULL,
    "stageEventId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "attemptedStageId" TEXT NOT NULL,
    "attemptedSubStageId" TEXT,
    "expectedSteps" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,

    CONSTRAINT "RoutingViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessChangeLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "batchId" TEXT,
    "partId" TEXT NOT NULL,
    "previousStageId" TEXT NOT NULL,
    "previousSubStageId" TEXT,
    "newStageId" TEXT NOT NULL,
    "newSubStageId" TEXT,
    "actor" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "screenType" "ScreenType" NOT NULL DEFAULT 'COMPUTER',
    "scannerAttached" BOOLEAN NOT NULL DEFAULT true,
    "printerAttached" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationStep" (
    "stationId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "subStageId" TEXT,
    "id" TEXT NOT NULL,

    CONSTRAINT "StationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkInstruction" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "subStageId" TEXT,
    "steps" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "completedTours" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_productCode_key" ON "Product"("productCode");

-- CreateIndex
CREATE INDEX "Model_productId_idx" ON "Model"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Model_productId_modelNumber_key" ON "Model"("productId", "modelNumber");

-- CreateIndex
CREATE INDEX "ModelPart_modelId_idx" ON "ModelPart"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPart_modelId_partCode_key" ON "ModelPart"("modelId", "partCode");

-- CreateIndex
CREATE INDEX "WorkflowGroup_projectId_idx" ON "WorkflowGroup"("projectId");

-- CreateIndex
CREATE INDEX "Stage_workflowGroupId_idx" ON "Stage"("workflowGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectCode_key" ON "Project"("projectCode");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Project_productId_idx" ON "Project"("productId");

-- CreateIndex
CREATE INDEX "ProjectModelAllocation_projectId_idx" ON "ProjectModelAllocation"("projectId");

-- CreateIndex
CREATE INDEX "ProjectModelAllocation_modelId_idx" ON "ProjectModelAllocation"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectModelAllocation_projectId_modelId_key" ON "ProjectModelAllocation"("projectId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpecification_projectId_key" ON "ProductSpecification"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Pmrs_projectId_key" ON "Pmrs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PartsList_projectId_version_key" ON "PartsList"("projectId", "version");

-- CreateIndex
CREATE INDEX "RoutingStep_partId_idx" ON "RoutingStep"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingStep_partsListId_partId_stepOrder_key" ON "RoutingStep"("partsListId", "partId", "stepOrder");

-- CreateIndex
CREATE INDEX "Part_sourceModelId_idx" ON "Part"("sourceModelId");

-- CreateIndex
CREATE INDEX "Part_sourceModelPartId_idx" ON "Part"("sourceModelPartId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_projectId_partCode_key" ON "Part"("projectId", "partCode");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_lotCode_key" ON "Lot"("lotCode");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_batchCode_key" ON "Batch"("batchCode");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_barcodeValue_key" ON "Batch"("barcodeValue");

-- CreateIndex
CREATE INDEX "Batch_lotId_idx" ON "Batch"("lotId");

-- CreateIndex
CREATE INDEX "Batch_projectModelAllocationId_idx" ON "Batch"("projectModelAllocationId");

-- CreateIndex
CREATE INDEX "Batch_currentStageId_idx" ON "Batch"("currentStageId");

-- CreateIndex
CREATE INDEX "StageEvent_batchId_occurredAt_idx" ON "StageEvent"("batchId", "occurredAt");

-- CreateIndex
CREATE INDEX "StageEvent_stageId_idx" ON "StageEvent"("stageId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_batchId_recordedAt_idx" ON "InventoryTransaction"("batchId", "recordedAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_lotId_idx" ON "InventoryTransaction"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingViolation_stageEventId_key" ON "RoutingViolation"("stageEventId");

-- CreateIndex
CREATE INDEX "RoutingViolation_batchId_idx" ON "RoutingViolation"("batchId");

-- CreateIndex
CREATE INDEX "RoutingViolation_resolved_idx" ON "RoutingViolation"("resolved");

-- CreateIndex
CREATE INDEX "ProcessChangeLog_projectId_changedAt_idx" ON "ProcessChangeLog"("projectId", "changedAt");

-- CreateIndex
CREATE INDEX "Station_workspaceId_idx" ON "Station"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "StationStep_stationId_stageId_subStageId_key" ON "StationStep"("stationId", "stageId", "subStageId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkInstruction_stageId_subStageId_version_key" ON "WorkInstruction"("stageId", "subStageId", "version");

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelPart" ADD CONSTRAINT "ModelPart_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowGroup" ADD CONSTRAINT "WorkflowGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_workflowGroupId_fkey" FOREIGN KEY ("workflowGroupId") REFERENCES "WorkflowGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubStageEligibility" ADD CONSTRAINT "SubStageEligibility_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubStageEligibility" ADD CONSTRAINT "SubStageEligibility_subStageId_fkey" FOREIGN KEY ("subStageId") REFERENCES "SubStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectModelAllocation" ADD CONSTRAINT "ProjectModelAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectModelAllocation" ADD CONSTRAINT "ProjectModelAllocation_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecification" ADD CONSTRAINT "ProductSpecification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pmrs" ADD CONSTRAINT "Pmrs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsList" ADD CONSTRAINT "PartsList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_partsListId_fkey" FOREIGN KEY ("partsListId") REFERENCES "PartsList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_sourceModelId_fkey" FOREIGN KEY ("sourceModelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_sourceModelPartId_fkey" FOREIGN KEY ("sourceModelPartId") REFERENCES "ModelPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_projectModelAllocationId_fkey" FOREIGN KEY ("projectModelAllocationId") REFERENCES "ProjectModelAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchPartLine" ADD CONSTRAINT "BatchPartLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchPartLine" ADD CONSTRAINT "BatchPartLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingViolation" ADD CONSTRAINT "RoutingViolation_stageEventId_fkey" FOREIGN KEY ("stageEventId") REFERENCES "StageEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessChangeLog" ADD CONSTRAINT "ProcessChangeLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationStep" ADD CONSTRAINT "StationStep_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
