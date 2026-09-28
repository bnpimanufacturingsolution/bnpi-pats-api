-- User-approved retirement of app-unused Demand, PMRS placeholder, and MaterialRequirement data.
-- This migration is destructive: take a coordinated PATS backup and record source row counts
-- before applying it to any persistent environment.
ALTER TABLE "InventoryTransaction"
  DROP CONSTRAINT "InventoryTransaction_materialRequirementId_fkey";

ALTER TABLE "InventoryTransaction"
  DROP COLUMN "materialRequirementId";

ALTER TABLE "ProjectModelAllocation"
  DROP COLUMN "marketRegion",
  DROP COLUMN "demandPurpose";

DROP TABLE "PlanDemandAllocation";
DROP TABLE "Pmrs";
DROP TABLE "MaterialRequirement";

DROP TYPE "MaterialRequirementStatus";
