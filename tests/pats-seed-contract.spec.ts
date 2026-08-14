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
    const clientFragment = fs.readFileSync(
      path.join(repositoryRoot, "scripts", "pats-seed-client-b251.mjs"),
      "utf8",
    );

    for (const required of [
      "planDemandAllocation",
      "materialRequirement",
      "lotPartAllocation",
      "stageEvent",
      "inventoryTransaction",
      "routingViolation",
      "qualityInspection",
      "qualityDecision",
      "qualityStageAssignment",
      "[quality.id, [decorationStageId, injectionStageId]]",
      "batchPositionProjection",
      "auditRecord",
      "outboxMessage",
      'evidenceStatus: "PROVISIONAL"',
      "client-parts-list",
      "CLIENT_B251",
      "subject-admin",
      "product-b251",
      "stage-warehouse",
      "BNI-2607-001",
      "Machibouke Hamburger Shop 3",
      "Street Food Friends",
      "CLIENT_B308",
      "PACKAGING_COMPONENT",
      "DECORATION_INPUT",
      "sharedCapsule",
      "decoPartsByModel",
      "paintNumbers",
    ]) {
      expect(script, `seed is missing ${required}`).to.contain(required);
    }

    expect(clientFragment).to.contain('productCode: "B251"');
    expect(clientFragment).to.contain("B251-01-01");
    expect(clientFragment).to.contain("Avocado Burger");
    expect(clientFragment).to.contain("NEEDS_CONFIRMATION");
    expect(clientFragment).to.contain("C002-01-42");
    expect(clientFragment).to.contain("B251-01-01ST");
    expect(clientFragment).to.contain("PN-B251-");
    expect(clientFragment).to.contain("decoPartsByModel");
    expect(clientFragment).to.contain("paintNumbers");
    expect(clientFragment).to.contain("sharedCapsule");

    const varietyFragment = fs.readFileSync(
      path.join(repositoryRoot, "scripts", "pats-seed-client-b308.mjs"),
      "utf8",
    );
    expect(varietyFragment).to.contain('productCode: "B308"');
    expect(varietyFragment).to.contain("Street Food Friends");
    expect(varietyFragment).to.contain("Takoyaki");
    expect(varietyFragment).to.contain("B308-01-01");
  });

  it("keeps seed writes additive and role subjects for demo shell coverage", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");
    expect(script).to.contain("production-operator");
    expect(script).to.contain("operations-admin");
    expect(script).to.contain("IN_PROGRESS");
    expect(script).to.not.match(/TRUNCATE|DROP TABLE|deleteMany/i);
  });
});
