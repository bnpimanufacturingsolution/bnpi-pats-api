import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "..");
const schemaDirectory = path.join(repositoryRoot, "prisma", "pats");
const packagePath = path.join(repositoryRoot, "package.json");
const migrationsPath = path.join(repositoryRoot, "prisma", "pats", "migrations");

function readSchema(): string {
  return fs.readdirSync(schemaDirectory)
    .filter((fileName) => fileName.endsWith(".prisma"))
    .sort()
    .map((fileName) => fs.readFileSync(path.join(schemaDirectory, fileName), "utf8"))
    .join("\n");
}

function readPackage(): { scripts?: Record<string, string> } {
  return JSON.parse(fs.readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
}

describe("PATS Prisma boundary", () => {
  it("uses a separate PostgreSQL schema and generated client output", () => {
    const schema = readSchema();

    expect(schema).to.contain('provider = "prisma-client-js"');
    expect(schema).to.contain('output   = "../../generated/pats-client"');
    expect(schema).to.contain('provider = "postgresql"');
    expect(schema).to.contain('url      = env("PATS_DATABASE_URL")');
  });

  it("contains the canonical catalog, planning, and execution models", () => {
    const schema = readSchema();
    const requiredModels = [
      "model Product {",
      "model Model {",
      "model ModelPart {",
      "model ProjectModelRequirement {",
      "model Project {",
      "model ProductSpecification {",
      "model PartsList {",
      "model RoutingStep {",
      "model Part {",
      "model Lot {",
      "model Batch {",
      "model ProductionLine {",
      "model Section {",
      "model StationStep {",
      "model SourceRun {",
      "model SourceArtifact {",
      "model SourceIssue {",
    ];

    for (const model of requiredModels) {
      expect(schema, `missing ${model}`).to.contain(model);
    }

    expect(schema).to.match(/productId\s+String\?/);
    expect(schema).to.match(/modelRequirements\s+ProjectModelRequirement\[\]/);
    expect(schema).to.match(/projectModelRequirementId\s+String\?/);
    expect(schema).to.match(/batchCode\s+String\s+@unique/);
    expect(schema).to.match(/plannedQuantity\s+Int/);
    expect(schema).to.match(/labelPackSize\s+Int/);
    expect(schema).to.match(/enum BatchStatus[\s\S]*?\bPLANNED\b/);
    expect(schema).to.match(/model Batch \{[\s\S]*?lineId\s+String\?/);
    expect(schema).to.match(/model Batch \{[\s\S]*?line\s+Line\?/);
    expect(schema).to.match(/model Batch \{[\s\S]*?partId\s+String/);
    expect(schema).to.match(/model Batch \{[\s\S]*?part\s+Part/);
    expect(schema).not.to.contain("model BatchPartLine {");
    expect(schema).not.to.match(/model Lot \{[\s\S]*?partId\s+String/);
    // The production quantity belongs to Lot, and Lot is where the API reads and
    // writes it (domain-read sources it from `project.lot`; every create/patch
    // writes `transaction.lot`). Project must not be a second source of truth.
    expect(schema).to.match(/model Lot \{[\s\S]*?requiredProductionQuantity\s+Int/);
    // `Project.requiredProductionQuantity` is a LEGACY column, not a second source
    // of truth. It is never read and never written by the API, but it exists in the
    // live database as `integer NOT NULL DEFAULT 0`, so deleting it from the schema
    // would make `pats-prisma-postgres-push.mjs` emit a DROP COLUMN - and that
    // script passes no `--accept-data-loss`, so the push would fail closed and
    // block every future additive change (including plannedStartDate/
    // plannedEndDate).
    //
    // So the column is asserted PRESENT and flagged as legacy rather than asserted
    // absent. It should be dropped in a dedicated, acknowledged migration with an
    // explicit data-loss decision - not smuggled in via a schema edit.
    expect(schema).to.match(/model Project \{[^}]*requiredProductionQuantity/);
    expect(schema).to.match(/enum SourceRunStatus[\s\S]*?\bPARTIAL\b/);
    expect(schema).to.match(/enum SourceArtifactType[\s\S]*?\bPDF\b/);
    expect(schema).to.match(/enum SourceExtractionStatus[\s\S]*?\bFAILED\b/);
  });

  it("keeps ProductSpecification distinct from catalog Product", () => {
    const schema = readSchema();

    expect(schema).to.contain("model ProductSpecification {");
    expect(schema).to.match(/model Product \{[\s\S]*?\n\}/);
    expect(schema).to.match(/model ProductSpecification \{[\s\S]*?\n\}/);
    expect(schema).to.contain("productSpecification       ProductSpecification?");
  });

  it("exposes explicit PATS-only Prisma commands and migration storage", () => {
    const scripts = readPackage().scripts ?? {};
    const expectedScripts = [
      "prisma:pats:format",
      "prisma:pats:validate",
      "prisma:pats:generate",
      "prisma:pats:migrate:dev",
      "prisma:pats:migrate:deploy",
    ];

    for (const scriptName of expectedScripts) {
      expect(scripts, `missing ${scriptName}`).to.have.property(scriptName);
      expect(scripts[scriptName]).to.contain("pats-prisma-");
    }

    expect(fs.existsSync(migrationsPath), "PATS migration directory is missing").to.equal(true);
    expect(fs.readdirSync(migrationsPath).some((entry) => entry !== "migration_lock.toml")).to.equal(true);
  });
});
