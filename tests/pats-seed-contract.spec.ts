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

  it("seeds WorkProcess leaves under SubStages, not SubStage-clone names", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");

    for (const leaf of [
      "Full Spray · Body · Red",
      "Full Spray · Head · Red",
      "Full Spray · Leaf · Green",
      "Full Spray · Body · White",
      "Mask Spray · Side Body",
      "Mask Spray · Face · Clear",
      "Tampo · Face · White",
      "Tampo · Eye",
      "Main Packing · Capsule",
    ]) {
      expect(script, `seed is missing process leaf ${leaf}`).to.contain(leaf);
    }

    expect(script).to.contain('stableId("work-process-full-spray")');
    expect(script).to.contain('stableId("work-process-fs-head-red")');
    expect(script).to.contain('stableId("work-process-mask-spray")');
    expect(script).to.contain('stableId("work-process-tampo-eye")');

    expect(script, "must not keep SubStage-clone Full Spray process").to.not.contain(
      '[processFullSprayId, subFullSprayId, "Full Spray", 1, 12]',
    );
    expect(script, "must not keep SubStage-clone Mask Spray process").to.not.contain(
      '[processMaskSprayId, subMaskSprayId, "Mask Spray", 2, 10]',
    );
    expect(script, "must not keep SubStage-clone Tampo process").to.not.contain(
      '[processTampoId, subTampoId, "Tampo", 3, 6]',
    );
    expect(script, "must not keep SubStage-clone Main Packing process").to.not.contain(
      '[processMainPackingId, subMainPackingId, "Main Packing", 1, null]',
    );
    expect(script).to.not.contain("Quality Check · Final Lot");
  });

  it("seeds Warehouse as a standalone group and disables the barcode station", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");
    expect(script).to.contain('stableId("workflow-warehouse")');
    expect(script).to.contain('linkageMode: "STANDALONE"');
    expect(script).to.contain('name: "Warehouse"');
    expect(script).to.contain('"Capsulation"');
    expect(script).to.contain('"Sealing"');
    expect(script).to.contain('"Palletizing"');
    expect(script).to.contain(
      '[warehouseStationId, "Warehouse · Main Packing", "ST-WH-PK", warehouseStageId, 8, false]',
    );
  });

  it("seeds Injection origin as Issuance, not Receiving", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");
    expect(script).to.not.contain('["inv-2", "RECEIVING"');
    expect(script).to.not.contain('["inv-4", "RECEIVING"');
    expect(script).to.contain('["inv-2", "ISSUANCE", "batch-av-inj"');
    expect(script).to.contain('["inv-4", "ISSUANCE", "batch-tc-inj"');
  });

  it("keeps seed writes additive and role subjects for demo shell coverage", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");
    expect(script).to.contain("production-operator");
    expect(script).to.contain("operations-admin");
    expect(script).to.contain("IN_PROGRESS");
    expect(script).to.not.match(/TRUNCATE|DROP TABLE|deleteMany/i);
  });

  it("seeds ProductionLine Line 01 and Warehouse, and StationProcess assignments", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");
    expect(script).to.contain("productionLine.upsert");
    expect(script).to.contain('kind: "MANUFACTURING"');
    expect(script).to.contain('kind: "WAREHOUSE"');
    expect(script).to.contain("stationProcess.upsert");
    expect(script).to.contain("productionLineId");
  });

  it("seeds Line Leader assignments (not a fourth role) for Full Spray and Mask Spray", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");
    expect(script).to.contain("lineLeaderAssignment.upsert");
    expect(script).to.contain('lla-lineleader-deco-fs');
    expect(script).to.contain('lla-lineleader-deco-ms');
    expect(script).to.contain('daily-metrics.encode');
    expect(script).to.contain("not a fourth business role");
  });
});
