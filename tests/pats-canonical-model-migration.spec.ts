import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(repositoryRoot, "prisma", "pats", "schema.prisma");
const migrationPath = path.join(
  repositoryRoot,
  "prisma",
  "pats",
  "migrations",
  "20260731120000_pats_canonical_model_convergence",
  "migration.sql",
);

describe("PATS canonical model convergence migration", () => {
  it("declares the normalized planning, execution, quality, and platform records", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");

    for (const model of [
      "model PlanDemandAllocation {",
      "model MaterialRequirement {",
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
  });
});
