/**
 * 04 — B250 deco-monitoring seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/MANUFACTURING DOCUMENTS/Decoration/B250 SHIMAJIROU MEJIRUSHI ACCESSORY.xlsx
 * Sheet: SUMMARY (A1:AO1000). 7 part rows (R6-R12); rest is empty template.
 * See sibling .seed.md. Formula-error cells seed as null (never 0).
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, stableId, type SeedRunOptions } from "../helpers.js";

export const SEED_NAME = "04-b250-deco-monitoring";
export const SOURCE_PATH =
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Decoration/B250 SHIMAJIROU MEJIRUSHI ACCESSORY.xlsx";

export const PRODUCT = { code: "B250", name: "Shimajirou Mejirushi Accessory" } as const;

export const MODELS = [
  { number: "01", name: "SHIMAJIRO" },
  { number: "02", name: "MIMI-LYNNE" },
  { number: "03", name: "FLAPPIE" },
  { number: "04", name: "NIKKI" },
  { number: "05", name: "HANNAH" },
] as const;

// Verbatim R6-R12 (spaces stripped for canonical codes; raw kept in sourceReference).
export const PARTS = [
  { raw: "B250 - 01 - 01", code: "B250-01-01", name: "BODY", model: "01", japan: 62421, asia: 860, china: 496, assyRq: 956.655, total: 64733.655 },
  { raw: "B250 - 01 - 02", code: "B250-01-02", name: "FEET", model: "01", japan: 62421, asia: 860, china: 496, assyRq: 956.655, total: 64733.655 },
  { raw: "B250 - 01 - 03", code: "B250-01-03", name: "BODY", model: "02", japan: 62421, asia: 860, china: 496, assyRq: 956.655, total: 64733.655 },
  { raw: "B250 - 01 - 04", code: "B250-01-04", name: "BODY", model: "03", japan: 62421, asia: 860, china: 496, assyRq: 956.655, total: 64733.655 },
  { raw: "B250 - 01 - 05", code: "B250-01-05", name: "FEET", model: "03", japan: 62421, asia: 860, china: 496, assyRq: 956.655, total: 64733.655 },
  { raw: "B250 - 01 - 06", code: "B250-01-06", name: "BODY", model: "04", japan: 62421, asia: 860, china: 496, assyRq: 956.655, total: 64733.655 },
  { raw: "B250 - 01 - 07", code: "B250-01-07", name: "BODY", model: "05", japan: 62421, asia: 860, china: 496, assyRq: 956.655, total: 64733.655 },
] as const;

export const PLAN = { perDay: 3300, withdrawalPlan: 65690.31 } as const;

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    product: PRODUCT.code,
    models: MODELS.length,
    parts: PARTS.length,
    planPerDay: PLAN.perDay,
    formulaErrorCells: "seeded as null (UNAVAILABLE_DEPENDENCY)",
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
    const productId = stableId(ns, profile, "product-b250");
    await tx.product.upsert({
      where: { id: productId },
      update: { productName: PRODUCT.name, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", rowVersion: 1 },
      create: {
        id: productId,
        productCode: `${pfx}-${PRODUCT.code}`,
        productName: PRODUCT.name,
        lifecycleStatus: "PUBLISHED",
        evidenceStatus: "PROVISIONAL",
      },
    });
    const modelIds: Record<string, string> = {};
    for (const model of MODELS) {
      const id = stableId(ns, profile, `model-b250-${model.number}`);
      modelIds[model.number] = id;
      await tx.model.upsert({
        where: { id },
        update: { productId, modelNumber: model.number, modelName: model.name, sourceStatus: "SOURCE_ALIGNED", lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", sourceReference: { origin: "deco-summary", productCode: PRODUCT.code } },
        create: { id, productId, modelNumber: model.number, modelName: model.name, sourceStatus: "SOURCE_ALIGNED", lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", sourceReference: { origin: "deco-summary", productCode: PRODUCT.code } },
      });
    }
    for (const part of PARTS) {
      const modelId = modelIds[part.model];
      await tx.modelPart.upsert({
        where: { modelId_partCode: { modelId, partCode: part.code } },
        update: { partName: `${part.name} (${part.code})`, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", routingSteps: [] },
        create: {
          id: stableId(ns, profile, `part-${part.code}`),
          modelId,
          partCode: part.code,
          partName: `${part.name} (${part.code})`,
          lifecycleStatus: "PUBLISHED",
          evidenceStatus: "PROVISIONAL",
          routingSteps: [],
        },
      });
    }
  });

  return plan(resolved);
}

if (isMainModule("04-b250-deco-monitoring.seed.ts")) plan({});
