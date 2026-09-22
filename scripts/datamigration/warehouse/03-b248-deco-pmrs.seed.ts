/**
 * 03 — B248 DECO PMRS seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/MANUFACTURING DOCUMENTS/Warehouse/B248_DECO_PMRS.xlsx (21 sheets)
 * See sibling .seed.md for the control-no. table. Requires 02-pl-b248-catalog first
 * (needs Product B248 + Model ids). Cross-product sheets (A402/A301/A267) seed as
 * Product stubs only.
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, stableId, type SeedRunOptions } from "../helpers.js";

export const SEED_NAME = "03-b248-deco-pmrs";
export const SOURCE_PATH =
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Warehouse/B248_DECO_PMRS.xlsx";

// Verbatim control-sheet headers (control no., date, lot qty, per-part qty).
export const PMRS_CONTROLS = [
  { sheet: "B248-002J-00", control: "260923-DECO-002J/00", date: "2026-04-24", lotQty: 601820, perPart: 120364, issued: 0, revision: "Rev.00", region: "JP" },
  { sheet: "B248-002J-01", control: "260923-DECO-002J/01", date: "2026-05-08", lotQty: 1410675, perPart: 282135, issued: 120364, revision: "Rev.01", region: "JP" },
  { sheet: "B248-002A-00", control: "260864-DECO-002A/00", date: "2026-05-08", lotQty: 77060, perPart: 15412, issued: 0, revision: "Rev.00", region: "ASIA" },
  { sheet: "B248-002A-01", control: "260864-DECO-002A/01", date: "2026-06-22", lotQty: 77060, perPart: 15572, issued: 15412, revision: "Rev.01", region: "ASIA" },
  { sheet: "B248-002U-00", control: "260865-DECO-002U/00", date: "2026-05-08", lotQty: 10300, perPart: 2060, issued: 0, revision: "Rev.00", region: "USA" },
  { sheet: "B248-002C-00", control: "260866-DECO-002C/00", date: "2026-05-08", lotQty: 6955, perPart: 1391, issued: 0, revision: "Rev.00", region: "CHINA" },
  { sheet: "B248-003J-00", control: "550532-DECO-003J/00", date: "2026-05-30", lotQty: 1410675, perPart: 8464, issued: 0, revision: "Rev.00", region: "JP" },
  { sheet: "B248-003J-01", control: "550533-DECO-003J/01", date: "2026-05-30", lotQty: 1410675, perPart: 9030, issued: 8464, revision: "Rev.01", region: "JP" },
] as const;

// The 16 parts repeated on every control sheet (order of appearance).
export const PMRS_PARTS = [
  "B248-01-01", "B248-02-01", "B248-01-02", "B248-02-02",
  "B248-01-03", "B248-02-03", "B248-01-04", "B248-02-04",
  "B248-01-05", "B248-02-05", "B248-01-06", "B248-02-06",
  "B248-01-07", "B248-02-07", "B248-01-08", "B248-02-08",
] as const;

export const MODEL_SPLIT = ["01", "02", "03", "04", "05"] as const;

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    pmrsControls: PMRS_CONTROLS.length,
    materialRequirements: PMRS_CONTROLS.length * PMRS_PARTS.length,
    demandAllocations: PMRS_CONTROLS.length * MODEL_SPLIT.length,
    crossProductStubs: ["A402", "A301", "A267"],
    source: SOURCE_PATH,
  };
  logPlan(SEED_NAME, summary);
  return summary;
}

export async function run(options: SeedRunOptions = {}) {
  const resolved = resolveOptions(options);
  if (resolved.dryRun) return plan(resolved);
  assertCanWrite(resolved.dryRun);
  const { prisma, profile } = resolved;
  if (!prisma) throw new Error("Prisma client is required for writes.");
  const ns = SEED_NAME;

  await prisma.$transaction(async (tx: any) => {
    // Cross-product stubs (evidence only; full catalog deferred).
    for (const stub of ["A402", "A301", "A267"]) {
      const id = stableId(ns, profile, `product-stub-${stub}`);
      await tx.product.upsert({
        where: { id },
        update: { productName: `${stub} (from B248_DECO_PMRS cross-sheet)`, evidenceStatus: "NEEDS_CONFIRMATION" },
        create: {
          id,
          productCode: `${profile.toUpperCase()}-${stub}`,
          productName: `${stub} (from B248_DECO_PMRS cross-sheet)`,
          lifecycleStatus: "DRAFT",
          evidenceStatus: "NEEDS_CONFIRMATION",
        },
      });
    }

    // B248 PMRS controls + per-part requirements. Project/Part resolution is by
    // profile-scoped business code so this seed composes with 02-catalog output.
    for (const ctrl of PMRS_CONTROLS) {
      const pmrsId = stableId(ns, profile, `pmrs-${ctrl.sheet}`);
      // NOTE: projectId must be the 02-catalog B248 project. Resolution by code
      // keeps this seed runnable without importing 02 internals; the approved
      // migration run executes 02 first (see run-all.ts order).
      const project = await tx.project.findFirst({
        where: { projectCode: `${profile.toUpperCase()}-PLAN-B248` },
        select: { id: true },
      });
      if (!project) {
        throw new Error(
          `[${SEED_NAME}] B248 project not found — run 02-pl-b248-catalog first (or create PLAN-B248).`,
        );
      }
      const partsList = await tx.partsList.findFirst({
        where: { projectId: project.id },
        orderBy: { version: "desc" },
        select: { id: true },
      });
      await tx.pmrs.upsert({
        where: { projectId: project.id },
        update: {
          partsListId: partsList?.id ?? null,
          externalControlNumber: ctrl.control,
          revisionLabel: ctrl.revision,
          status: "attached",
          sourceReference: {
            origin: "deco-pmrs",
            sheet: ctrl.sheet,
            region: ctrl.region,
            lotQty: ctrl.lotQty,
            date: ctrl.date,
            preparedBy: "Aubrey Yasmin Ayop",
            checkedBy: "Mark Joseph De Jesus",
            approvedBy: "Marilyn Duatin",
          },
        },
        create: {
          id: pmrsId,
          projectId: project.id,
          partsListId: partsList?.id ?? null,
          externalControlNumber: ctrl.control,
          revisionLabel: ctrl.revision,
          status: "attached",
          sourceReference: { origin: "deco-pmrs", sheet: ctrl.sheet, region: ctrl.region, lotQty: ctrl.lotQty, date: ctrl.date },
        },
      });

      for (const partCode of PMRS_PARTS) {
        const part = await tx.part.findFirst({
          where: { projectId: project.id, partCode },
          select: { id: true },
        });
        if (!part) continue; // catalog gap stays a gap — never fabricate a Part here
        const mrId = stableId(ns, profile, `mr-${ctrl.sheet}-${partCode}`);
        await tx.materialRequirement.upsert({
          where: { id: mrId },
          update: {
            projectId: project.id,
            partId: part.id,
            externalReference: `${ctrl.control}`,
            quantityMagnitude: `${ctrl.perPart}.000000`,
            quantityUom: "piece",
            usageBasis: "1 per product",
            sourceRevisionRef: ctrl.revision,
            status: "APPROVED",
          },
          create: {
            id: mrId,
            projectId: project.id,
            partId: part.id,
            externalReference: `${ctrl.control}`,
            quantityMagnitude: `${ctrl.perPart}.000000`,
            quantityUom: "piece",
            usageBasis: "1 per product",
            sourceRevisionRef: ctrl.revision,
            status: "APPROVED",
          },
        });
      }
    }
  });

  return plan(resolved);
}

if (isMainModule("03-b248-deco-pmrs.seed.ts")) plan({});
