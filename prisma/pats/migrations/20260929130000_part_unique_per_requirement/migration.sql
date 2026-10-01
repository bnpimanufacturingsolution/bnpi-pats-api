-- Shared catalog parts (e.g. a common capsule used by every model) repeat once
-- per model requirement so each model mints its own Series. Widen the Project
-- Part identity from (project, partCode) to (project, requirement, partCode).
-- No data migration: pre-existing rows carry distinct partCodes per project.
DROP INDEX IF EXISTS "Part_projectId_partCode_key";
CREATE UNIQUE INDEX "Part_projectId_projectModelRequirementId_partCode_key" ON "Part"("projectId", "projectModelRequirementId", "partCode");
