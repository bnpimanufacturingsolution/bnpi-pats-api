import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "..");
const schemaDirectory = path.join(repositoryRoot, "prisma", "pats");
const migrationPath = path.join(
  repositoryRoot,
  "prisma",
  "pats",
  "migrations",
  "20260731120000_pats_canonical_model_convergence",
  "migration.sql",
);
const idempotencyHeadersMigrationPath = path.join(
  repositoryRoot,
  "prisma",
  "pats",
  "migrations",
  "20260731170000_pats_idempotency_response_headers",
  "migration.sql",
);
const appScopeRetirementMigrationPath = path.join(
  repositoryRoot,
  "prisma",
  "pats",
  "migrations",
  "20260925160000_retire_unused_demand_pmrs",
  "migration.sql",
);

describe("PATS canonical model convergence migration", () => {
  it("declares the normalized planning, execution, quality, and platform records", () => {
    const schema = fs.readdirSync(schemaDirectory)
      .filter((fileName) => fileName.endsWith(".prisma"))
      .sort()
      .map((fileName) => fs.readFileSync(path.join(schemaDirectory, fileName), "utf8"))
      .join("\n");

    for (const model of [
      "model LotPartAllocation {",
      "model BatchPositionProjection {",
      "model QualityInspection {",
      "model QualityDecision {",
      "model AuditRecord {",
      "model OutboxMessage {",
      "model IdempotencyRecord {",
    ]) {
      expect(schema, `missing ${model}`).to.contain(model);
    }

    expect(schema).to.match(/quantityMagnitude\s+Decimal.*@db\.Decimal\(18, 6\)/);
    expect(schema).to.match(/actorSubject\s+Subject\?\s+@relation\("StageEventActor"/);
    expect(schema).to.match(/releasedBySubject\s+Subject\?/);
    expect(schema).to.contain("model LotPartAllocation {");
    expect(schema).to.match(/responseHeaders\s+Json\?/);
    expect(schema).not.to.contain("model PlanDemandAllocation {");
    expect(schema).not.to.contain("model Pmrs {");
    expect(schema).not.to.contain("model MaterialRequirement {");
  });

  it("keeps the migration additive-first and free of destructive table/column drops", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).to.not.match(/DROP\s+TABLE/i);
    expect(migration).to.not.match(/DROP\s+COLUMN/i);
    for (const table of [
      'CREATE TABLE "PlanDemandAllocation"',
      'CREATE TABLE "MaterialRequirement"',
      'CREATE TABLE "LotPartAllocation"',
      'CREATE TABLE "BatchPositionProjection"',
      'CREATE TABLE "QualityInspection"',
      'CREATE TABLE "QualityDecision"',
      'CREATE TABLE "AuditRecord"',
      'CREATE TABLE "OutboxMessage"',
      'CREATE TABLE "IdempotencyRecord"',
    ]) {
      expect(migration, `missing ${table}`).to.contain(table);
    }

    const idempotencyHeadersMigration = fs.readFileSync(idempotencyHeadersMigrationPath, "utf8");
    expect(idempotencyHeadersMigration).to.contain('ALTER TABLE "IdempotencyRecord"');
    expect(idempotencyHeadersMigration).to.contain('ADD COLUMN "responseHeaders" JSONB');
  });

  it("retires app-unused Demand and PMRS persistence in a new explicit migration", () => {
    const migration = fs.readFileSync(appScopeRetirementMigrationPath, "utf8");

    expect(migration).to.contain('DROP TABLE "PlanDemandAllocation"');
    expect(migration).to.contain('DROP TABLE "Pmrs"');
    expect(migration).to.contain('DROP TABLE "MaterialRequirement"');
    expect(migration).to.contain('DROP COLUMN "materialRequirementId"');
    expect(migration).to.contain('DROP COLUMN "marketRegion"');
    expect(migration).to.contain('DROP COLUMN "demandPurpose"');
  });
});
