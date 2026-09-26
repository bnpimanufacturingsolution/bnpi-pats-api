-- User-approved scoped v1.2.1 §7 exception (2026-09-25): immediate removal of the
-- 2027-sunset-gated BOM and ProcessRoute surfaces. No production deployment exists and the
-- sibling callsite audit verified zero active app API callers.
-- Dev preflight 2026-09-25: BomDefinition 1 row, BomLine 15 rows, ProcessRoute 1 row,
-- ProcessRouteStage 4 rows (disposable seed rows); 0 CanonicalEvidenceLink and
-- 0 CanonicalCrosswalk rows reference the retired subject types. This migration is
-- destructive to those rows; dev reseeds afterwards. Historical migrations untouched.

-- Guard: remove any polymorphic evidence rows pointing at the retired subjects.
DELETE FROM "CanonicalEvidenceLink"
WHERE "subjectType" IN ('BOM_DEFINITION', 'BOM_LINE', 'PROCESS_ROUTE', 'ROUTE_STAGE');

DELETE FROM "CanonicalCrosswalk"
WHERE "subjectType" IN ('BOM_DEFINITION', 'BOM_LINE', 'PROCESS_ROUTE', 'ROUTE_STAGE');

-- Drop child tables before parents (all FKs are outgoing from the dropped tables).
DROP TABLE "BomLine";
DROP TABLE "BomDefinition";
DROP TABLE "ProcessRouteStage";
DROP TABLE "ProcessRoute";

DROP TYPE "BomRelationshipKind";

-- Shrink the evidence subject enum (Postgres cannot DROP VALUE inside a migration
-- transaction, so recreate without the retired values).
CREATE TYPE "CanonicalEvidenceSubjectType_new" AS ENUM ('PRODUCT', 'MODEL', 'MODEL_PART');

ALTER TABLE "CanonicalEvidenceLink"
  ALTER COLUMN "subjectType" TYPE "CanonicalEvidenceSubjectType_new"
  USING "subjectType"::text::"CanonicalEvidenceSubjectType_new";

ALTER TABLE "CanonicalCrosswalk"
  ALTER COLUMN "subjectType" TYPE "CanonicalEvidenceSubjectType_new"
  USING "subjectType"::text::"CanonicalEvidenceSubjectType_new";

ALTER TYPE "CanonicalEvidenceSubjectType" RENAME TO "CanonicalEvidenceSubjectType_old";
ALTER TYPE "CanonicalEvidenceSubjectType_new" RENAME TO "CanonicalEvidenceSubjectType";
DROP TYPE "CanonicalEvidenceSubjectType_old";
