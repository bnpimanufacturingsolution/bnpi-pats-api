import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "..");

describe("PATS seed contract", () => {
  it("keeps the canonical seed separate from the legacy root seed", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");

    expect(packageJson.scripts?.["prisma:pats:seed"]).to.equal("node scripts/pats-seed.mjs");
    expect(script).to.contain('mode === "none"');
    expect(script).to.contain('mode !== "demo" && mode !== "uat"');
    expect(script).to.contain("createHash(\"sha256\")");
    expect(script).to.not.match(/\.delete(?:Many)?\s*\(/);
    expect(script).to.not.match(/\.createMany\s*\(/);
  });

  it("seeds explicit operational evidence and marks it provisional", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");

    for (const required of [
      "planDemandAllocation",
      "materialRequirement",
      "lotPartAllocation",
      "stageEvent",
      "inventoryTransaction",
      "routingViolation",
      "qualityInspection",
      "qualityDecision",
      "batchPositionProjection",
      "auditRecord",
      "outboxMessage",
      'evidenceStatus: "PROVISIONAL"',
      "prototype-fixture-repurpose",
      "subject-admin",
      "product-b251",
      "stage-warehouse",
      "BATCH-B251-001",
    ]) {
      expect(script, `seed is missing ${required}`).to.contain(required);
    }
  });

  it("keeps seed writes additive and role subjects for demo shell coverage", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");
    expect(script).to.contain("production-operator");
    expect(script).to.contain("operations-admin");
    expect(script).to.contain("IN_PROGRESS");
    expect(script).to.not.match(/TRUNCATE|DROP TABLE|deleteMany/i);
  });
});
