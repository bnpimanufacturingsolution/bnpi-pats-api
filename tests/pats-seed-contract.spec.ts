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
      // B251 capsule/deco/paint BOM lines — not the (dropped) B308 family.
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

    // The fabricated B308 "Street Food Friends" family was dropped (not client
    // publication). The import and its family string must not survive.
    expect(script).not.to.contain("CLIENT_B308");
    expect(script).not.to.contain("Street Food Friends");
    expect(script).not.to.contain("B308-01-01");
  });

  it("keeps writes additive by default and gates the destructive fresh-reset path", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");
    expect(script).to.contain('["operator"]');
    expect(script).to.contain('["admin"]');
    expect(script).to.contain("IN_PROGRESS");

    // Default remains additive: no SQL truncation is ever emitted, and
    // deleteMany may only live inside the guarded wipe function, never in the
    // additive upsert region that precedes it.
    expect(script).to.not.match(/TRUNCATE|DROP TABLE/i);
    const additiveRegion = script.split("async function wipeSeededTables")[0];
    expect(additiveRegion).to.not.match(/\.deleteMany\s*\(/);
    const wipeRegion = script.slice(
      script.indexOf("async function wipeSeededTables"),
      script.indexOf("async function seedProfile"),
    );
    expect(wipeRegion).to.match(/\.deleteMany\s*\(/);
    for (const table of ["outboxMessage", "auditRecord", "stageEvent", "batch", "qualityInspection", "qualityStageAssignment", "subjectAssignment", "subject"]) {
      expect(wipeRegion, `wipe is missing table ${table}`).to.contain(`"${table}"`);
    }

    // Fresh-reset safety contract: explicit env opt-in, off by default, and
    // refused for production ENVs.
    expect(script).to.contain("process.env.PATS_SEED_FRESH");
    expect(script).to.contain("PATS_SEED_FRESH refuses to run in production");
    expect(script).not.to.match(/const freshReset\s*=\s*(true|1);?/);
  });

  it("seeds demo.planner as a pure planner and demo.quality as QC-primary QI", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");

    expect(script).to.contain("Pure planner: planning + read-only monitoring + catalog read. Not a QC account.");
    expect(script).to.contain('["planner"]');
    expect(script).to.contain('["qi"]');
    expect(script).to.contain("[quality.id, [decorationStageId, injectionStageId]]");
    expect(script).to.contain("[admin.id, allCatalogStageIds]");
    expect(script).to.contain('status: "REVOKED"');
    expect(script).not.to.contain("[planner.id, allCatalogStageIds]");
    expect(script).not.to.contain("Demo shell convenience: planner can walk planning + floor + QC");
    expect(script).not.to.contain("planner/admin all stages = fat-shell convenience");
  });

  it("documents the RBAC fixture subjects and the negative-path QI without scope", () => {
    const script = fs.readFileSync(path.join(repositoryRoot, "scripts", "pats-seed.mjs"), "utf8");

    // Positive fixtures documented by intent.
    expect(script).to.contain("RBAC fixture subjects (Playwright ABAC/RBAC ground)");
    expect(script).to.contain(`"subject-lineleader"`);
    expect(script).to.contain("daily-metrics.encode");
    // Negative fixture: QI bundle with no quality-stage rows; Journey D must
    // fail closed. The subject is created but never added to qualityScopeBySubject.
    expect(script).to.contain('"subject-quality-noscope"');
    expect(script, "noscope subject must be created from the profile prefix").to.match(/`\$\{profile\}\.quality_noscope`/);
    expect(script).to.match(/fail closed/i);
    expect(script, "noscope subject must not be granted Decoration/Injection scope").not.to.match(
      /qualityNoScope\.id, \[decorationStageId, injectionStageId\]/,
    );
  });
});