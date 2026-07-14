import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(repositoryRoot, "prisma", "pats", "schema.prisma");
const packagePath = path.join(repositoryRoot, "package.json");
const migrationsPath = path.join(repositoryRoot, "prisma", "pats", "migrations");

function readSchema(): string {
  return fs.readFileSync(schemaPath, "utf8");
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
      "model ProjectModelAllocation {",
      "model Project {",
      "model ProductSpecification {",
      "model PartsList {",
      "model RoutingStep {",
      "model Part {",
      "model Lot {",
      "model Batch {",
      "model BatchPartLine {",
      "model Station {",
      "model StationStep {",
    ];

    for (const model of requiredModels) {
      expect(schema, `missing ${model}`).to.contain(model);
    }

    expect(schema).to.match(/productId\s+String\?/);
    expect(schema).to.match(/modelAllocations\s+ProjectModelAllocation\[\]/);
    expect(schema).to.match(/projectModelAllocationId\s+String\?/);
    expect(schema).to.match(/batchCode\s+String\s+@unique/);
    expect(schema).to.match(/plannedQuantity\s+Int/);
    expect(schema).to.match(/labelPackSize\s+Int/);
    expect(schema).to.match(/enum BatchStatus[\s\S]*?\bPLANNED\b/);
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
