/**
 * 06 — B308 injection-monitoring seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/MANUFACTURING DOCUMENTS/Injection/B308 Mobile Suit Gundam Narabundesu Narikiri Haro.xlsx
 * 4 sheets. Per-part tables verbatim from 2867508-01 R12-R21 and 2867508-02 R12-R32.
 * Supersedes any hand-written B308 fixture (see pats-seed.mjs note).
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, stableId, type SeedRunOptions } from "../helpers.js";

export const SEED_NAME = "06-b308-injection-monitoring";
export const SOURCE_PATH =
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Injection/B308 Mobile Suit Gundam Narabundesu Narikiri Haro.xlsx";

export const PRODUCT = { code: "B308", name: "Mobile Suit Gundam Narabundesu Narikiri Haro" } as const;

export const MODELS = [
  { number: "01", name: "Gundam" },
  { number: "02", name: "Zaku II" },
  { number: "03", name: "Char Zaku II" },
  { number: "04", name: "V Gundam" },
  { number: "05", name: "Sazabi" },
] as const;

export const PARTS_MOLD_01 = [
  { code: "B308-01-01", name: "Gundam Upper Body", model: "01", transfer: 33640, balance: 13754 },
  { code: "B308-01-02", name: "Gundam Lower Body", model: "01", transfer: 33215, balance: 14179 },
  { code: "B308-01-03", name: "Zaku Upper Body", model: "02", transfer: 33585, balance: 13809 },
  { code: "B308-01-04", name: "Zaku Lower Body", model: "02", transfer: 33600, balance: 13794 },
  { code: "B308-01-05", name: "Char Zaku II Upper Body", model: "03", transfer: 31200, balance: 16194 },
  { code: "B308-01-06", name: "Char Zaku II Lower Body", model: "03", transfer: 33200, balance: 14194 },
  { code: "B308-01-07", name: "V Gundam Upper Body", model: "04", transfer: 32020, balance: 15374 },
  { code: "B308-01-08", name: "V Gundam Lower Body", model: "04", transfer: 31625, balance: 15769 },
  { code: "B308-01-09", name: "Sazabi Upper Body", model: "05", transfer: 33355, balance: 14039 },
  { code: "B308-01-10", name: "Sazabi Lower Body", model: "05", transfer: 33265, balance: 14129 },
] as const;

export const PARTS_MOLD_02 = [
  { code: "B308-02-01", name: "Gundam Horn", model: "01", transfer: 21600, balance: 25794 },
  { code: "B308-02-02", name: "Gundam Backpack", model: "01", transfer: 22200, balance: 25194 },
  { code: "B308-02-03", name: "Gundam Stand", model: "01", transfer: 20800, balance: 26594 },
  { code: "B308-02-04", name: "Zaku II Backpack", model: "02", transfer: 21400, balance: 25994 },
  { code: "B308-02-05", name: "Zaku II Stand", model: "02", transfer: 20800, balance: 26594 },
  { code: "B308-02-06", name: "Zaku II Pillar Left", model: "02", transfer: 21600, balance: 25794 },
  { code: "B308-02-07", name: "Zaku II Pillar Right", model: "02", transfer: 21600, balance: 25794 },
  { code: "B308-02-08", name: "Charzaku II Horn", model: "03", transfer: 21200, balance: 26194 },
  { code: "B308-02-09", name: "Charzaku II Backpack", model: "03", transfer: 22200, balance: 25194 },
  { code: "B308-02-10", name: "Char Zaku II Stand", model: "03", transfer: 20800, balance: 26594 },
  { code: "B308-02-11", name: "Char Zaku II Pilar Left", model: "03", transfer: 22200, balance: 25194 },
  { code: "B308-02-12", name: "Char Zaku II Pillar Right", model: "03", transfer: 22200, balance: 25194 },
  { code: "B308-02-13", name: "V Gundam Horn", model: "04", transfer: 22400, balance: 24994 },
  { code: "B308-02-14", name: "V Gundam Weapon on Backpack", model: "04", transfer: 21400, balance: 25994 },
  { code: "B308-02-15", name: "V Gundam Backpack", model: "04", transfer: 14400, balance: 32994 },
  { code: "B308-02-16", name: "V Gundam Stand", model: "04", transfer: 20800, balance: 26594 },
  { code: "B308-02-17", name: "Sazabi Horn", model: "05", transfer: 21600, balance: 25794 },
  { code: "B308-02-18", name: "Sazabi Backpack", model: "05", transfer: 21800, balance: 25594 },
  { code: "B308-02-19", name: "Sazabi Pillar Left", model: "05", transfer: 22600, balance: 24794 },
  { code: "B308-02-20", name: "Sazabi Pillar Right", model: "05", transfer: 22600, balance: 24794 },
  { code: "B308-02-21", name: "Sazabi Stand", model: "05", transfer: 20800, balance: 26594 },
] as const;

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    product: PRODUCT.code,
    models: MODELS.length,
    mold01Parts: PARTS_MOLD_01.length,
    mold02Parts: PARTS_MOLD_02.length,
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
    const productId = stableId(ns, profile, "product-b308");
    await tx.product.upsert({
      where: { id: productId },
      update: { productName: PRODUCT.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", rowVersion: 1 },
      create: { id: productId, productCode: `${pfx}-${PRODUCT.code}`, productName: PRODUCT.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL" },
    });
    const modelIds: Record<string, string> = {};
    for (const model of MODELS) {
      const id = stableId(ns, profile, `model-b308-${model.number}`);
      modelIds[model.number] = id;
      await tx.model.upsert({
        where: { id },
        update: { productId, modelNumber: model.number, modelName: model.name, sourceStatus: "SOURCE_ALIGNED", lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", sourceReference: { origin: "injection-monitoring", productCode: PRODUCT.code } },
        create: { id, productId, modelNumber: model.number, modelName: model.name, sourceStatus: "SOURCE_ALIGNED", lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", sourceReference: { origin: "injection-monitoring", productCode: PRODUCT.code } },
      });
    }
    for (const part of [...PARTS_MOLD_01, ...PARTS_MOLD_02]) {
      const modelId = modelIds[part.model];
      const mold = part.code.startsWith("B308-01") ? "2867508-01" : "2867508-02";
      await tx.modelPart.upsert({
        where: { modelId_partCode: { modelId, partCode: part.code } },
        update: { partName: part.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", routingSteps: [] },
        create: { id: stableId(ns, profile, `part-${part.code}`), modelId, partCode: part.code, partName: part.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", routingSteps: [] },
      });
      void mold;
    }
  });

  return plan(resolved);
}

if (isMainModule("06-b308-injection-monitoring.seed.ts")) plan({});
