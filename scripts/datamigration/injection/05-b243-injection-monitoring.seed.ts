/**
 * 05 — B243 injection-monitoring seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/MANUFACTURING DOCUMENTS/Injection/B243 Sanrio Characters Fruits Mejirushi Accessory.xlsx
 * 6 sheets. Full per-part transfer table below is verbatim from 2843315-01 R12-R33.
 * Duplicate-mold sheet uses raw prefix B224- (preserved + flagged, never rewritten).
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, stableId, type SeedRunOptions } from "../helpers.js";

export const SEED_NAME = "05-b243-injection-monitoring";
export const SOURCE_PATH =
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Injection/B243 Sanrio Characters Fruits Mejirushi Accessory.xlsx";

export const PRODUCT = { code: "B243", name: "Sanrio Characters Fruits Mejirushi Accessory" } as const;

export const MODELS = [
  { number: "01", name: "Hello Kitty Apple" },
  { number: "02", name: "Keroppi Avocado" },
  { number: "03", name: "My Melody Peach" },
  { number: "04", name: "Kuromi Black Cherry" },
  { number: "05", name: "Pompompurin Pineapple" },
] as const;

// code, name, model, transfer, balance (R12-R33 verbatim; order qty 145335, output 108506 throughout).
export const PARTS_MOLD_01 = [
  { code: "B243-01-01", name: "Hello Kitty Head", model: "01", transfer: 108000, balance: 37335 },
  { code: "B243-01-02", name: "Hello Kitty Stem", model: "01", transfer: 127000, balance: 18335 },
  { code: "B243-01-03", name: "Hello Kitty Ribbon", model: "01", transfer: 121200, balance: 24135 },
  { code: "B243-01-04", name: "Hello Kitty Body", model: "01", transfer: 125400, balance: 19935 },
  { code: "B243-01-05", name: "Hello Kitty Feet'", model: "01", transfer: 125800, balance: 19535 },
  { code: "B243-01-06", name: "Keroppi Head", model: "02", transfer: 106000, balance: 39335 },
  { code: "B243-01-07", name: "Keroppi Stem", model: "02", transfer: 125000, balance: 20335 },
  { code: "B243-01-08", name: "Kerropi Body", model: "02", transfer: 125000, balance: 20335 },
  { code: "B243-01-09", name: "Keroppi Feet", model: "02", transfer: 123400, balance: 21935 },
  { code: "B243-01-10", name: "My Melody Head", model: "03", transfer: 118400, balance: 26935 },
  { code: "B243-01-11", name: "My MelodyRibbomn", model: "03", transfer: 125200, balance: 20135 },
  { code: "B243-01-12", name: "My Melody Body", model: "03", transfer: 125800, balance: 19535 },
  { code: "B243-01-13", name: "My Melody Feet", model: "03", transfer: 123440, balance: 21895 },
  { code: "B243-01-14", name: "Korumi Head", model: "04", transfer: 111600, balance: 33735 },
  { code: "B243-01-15", name: "Korumi Stem", model: "04", transfer: 128000, balance: 17335 },
  { code: "B243-01-16", name: "Kuromi Body", model: "04", transfer: 125800, balance: 19535 },
  { code: "B243-01-17", name: "Kuromi Feet", model: "04", transfer: 123800, balance: 21535 },
  { code: "B243-01-18", name: "Pompompurin Head", model: "05", transfer: 118400, balance: 26935 },
  { code: "B243-01-19", name: "Pompompurin Face", model: "05", transfer: 123400, balance: 21935 },
  { code: "B243-01-20", name: "Pompompurin Stem", model: "05", transfer: 125400, balance: 19935 },
  { code: "B243-01-21", name: "Pompompurin Body", model: "05", transfer: 122400, balance: 22935 },
  { code: "B243-01-22", name: "Pompompurin Feet", model: "05", transfer: 124400, balance: 20935 },
] as const;

// Duplicate-mold raw codes verbatim (R12 B243-01-01A, R13+ B224-01-0xA).
export const PARTS_MOLD_01A_RAW = [
  "B243-01-01A", "B224-01-02A", "B224-01-03A", "B224-01-04A", "B224-01-05A",
  "B224-01-06A", "B224-01-07A", "B224-01-08A", "B224-01-09A", "B224-01-10A",
  "B224-01-11A", "B224-01-12A", "B224-01-13A", "B224-01-14A", "B224-01-15A",
  "B224-01-16A", "B224-01-17A", "B224-01-18A", "B224-01-19A", "B224-01-20A",
  "B224-01-21A", "B224-01-22A",
] as const;

export const CAPSULES = [
  { code: "C002-01-42", mold: "PH02-01/02", plan: 1367470, transfer: 420900 },
  { code: "C002-01-43", mold: "PH02-01/03", plan: null, transfer: 232100 },
] as const;

export function canonicalOf(raw: string): string {
  return raw.replace(/^B224-/i, "B243-").toUpperCase();
}

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    product: PRODUCT.code,
    models: MODELS.length,
    mold01Parts: PARTS_MOLD_01.length,
    duplicateMoldVariants: PARTS_MOLD_01A_RAW.length,
    prefixAnomalies: PARTS_MOLD_01A_RAW.filter((c) => c.startsWith("B224")).length,
    capsules: CAPSULES.length,
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
  const pfx = profile.toUpperCase();

  await prisma.$transaction(async (tx: any) => {
    const productId = stableId(ns, profile, "product-b243");
    await tx.product.upsert({
      where: { id: productId },
      update: { productName: PRODUCT.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", rowVersion: 1 },
      create: { id: productId, productCode: `${pfx}-${PRODUCT.code}`, productName: PRODUCT.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
    });
    const modelIds: Record<string, string> = {};
    for (const model of MODELS) {
      const id = stableId(ns, profile, `model-b243-${model.number}`);
      modelIds[model.number] = id;
      await tx.model.upsert({
        where: { id },
        update: { productId, modelNumber: model.number, modelName: model.name, sourceStatus: "SOURCE_ALIGNED", lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", sourceReference: { origin: "injection-monitoring", mold: "2843315-01" } },
        create: { id, productId, modelNumber: model.number, modelName: model.name, sourceStatus: "SOURCE_ALIGNED", lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", sourceReference: { origin: "injection-monitoring", mold: "2843315-01" } },
      });
    }
    for (const part of PARTS_MOLD_01) {
      const modelId = modelIds[part.model];
      await tx.modelPart.upsert({
        where: { modelId_partCode: { modelId, partCode: part.code } },
        update: { partName: part.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", routingSteps: [] },
        create: { id: stableId(ns, profile, `part-${part.code}`), modelId, partCode: part.code, partName: part.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", routingSteps: [] },
      });
    }
    // Duplicate-mold variants: canonical code seeded, raw preserved + flagged.
    for (const raw of PARTS_MOLD_01A_RAW) {
      const canonical = canonicalOf(raw);
      const base = PARTS_MOLD_01.find((p) => `${p.code}A` === canonical);
      const modelId = modelIds[base?.model ?? "01"];
      await tx.modelPart.upsert({
        where: { modelId_partCode: { modelId, partCode: canonical } },
        update: { partName: `${base?.name ?? canonical} (duplicate mold)`, lifecycleStatus: "PUBLISHED", evidenceStatus: "NEEDS_CONFIRMATION", routingSteps: [] },
        create: {
          id: stableId(ns, profile, `part-dup-${canonical}`),
          modelId,
          partCode: canonical,
          partName: `${base?.name ?? canonical} (duplicate mold)`,
          lifecycleStatus: "PUBLISHED",
          evidenceStatus: "NEEDS_CONFIRMATION",
          routingSteps: [],
        },
      });
    }
    for (const cap of CAPSULES) {
      for (const model of MODELS) {
        const modelId = modelIds[model.number];
        await tx.modelPart.upsert({
          where: { modelId_partCode: { modelId, partCode: cap.code } },
          update: { partName: `O 48 mm Transparent Capsule (${cap.mold})`, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", routingSteps: [] },
          create: { id: stableId(ns, profile, `cap-${model.number}-${cap.code}`), modelId, partCode: cap.code, partName: `O 48 mm Transparent Capsule (${cap.mold})`, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", routingSteps: [] },
        });
      }
    }
  });

  return plan(resolved);
}

if (isMainModule("05-b243-injection-monitoring.seed.ts")) plan({});
