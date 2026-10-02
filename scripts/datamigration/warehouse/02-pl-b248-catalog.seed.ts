/**
 * 02 — PL B248 catalog seed (DRY-RUN by default, never auto-executes).
 *
 * Sources (duplicate pair, one logical dataset):
 *   docs/REPORTS/MANUFACTURING DOCUMENTS/Warehouse/PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx
 *   docs/REPORTS/PRODUCTION AND ASSEMBLY/Document/From Client/PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx
 * Sheets: Partslist | Inj | Inj Shot | Deco | Assy. See sibling .seed.md.
 *
 * Seeds Product B248 + 5 Models + inj/deco/paint/capsule ModelParts + BOM r1 +
 * ProcessRoute r1. Assy accessory/packaging rows seed as BOM lines (OTHER /
 * PACKAGING_COMPONENT), not ModelParts. Idempotent upserts; stableId-scoped.
 */
import { assertCanWrite, isMainModule, logPlan, resolveOptions, stableId, type SeedRunOptions } from "../helpers.js";

export const SEED_NAME = "02-pl-b248-catalog";
export const SOURCE_PATHS = [
  "docs/REPORTS/MANUFACTURING DOCUMENTS/Warehouse/PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx",
  "docs/REPORTS/PRODUCTION AND ASSEMBLY/Document/From Client/PL B248 Sanrio Characters Emokyun Mejirushi Accessory Vol. 2 rev_06.xlsx",
] as const;

export const PRODUCT = {
  code: "B248",
  name: "Sanrio Characters Emokyun Mejirushi Accessory Volume 2",
  formCode: "BNPI-F-PES-018-1",
  revision: "rev_06",
} as const;

// Inj parts verbatim from Inj R4-R36 (mold, code, name, model).
export const INJ_PARTS = [
  { mold: "2849226-01", code: "B248-01-01", name: "Hello Kitty Ribbon", model: "01" },
  { mold: "2849226-01", code: "B248-01-02", name: "Hello Kitty Heart", model: "01" },
  { mold: "2849226-01", code: "B248-01-03", name: "Pompompurin Hat", model: "02" },
  { mold: "2849226-01", code: "B248-01-04", name: "Pompompurin Heart", model: "02" },
  { mold: "2849226-01", code: "B248-01-05", name: "Kurousa Heart", model: "03" },
  { mold: "2849226-01", code: "B248-01-06", name: "Shirousa Heart", model: "04" },
  { mold: "2849226-01", code: "B248-01-07", name: "Kuririn Leaf", model: "05" },
  { mold: "2849226-01", code: "B248-01-08", name: "Kuririn Heart", model: "05" },
  { mold: "2849226-02", code: "B248-02-01", name: "Hello Kitty Head", model: "01" },
  { mold: "2849226-02", code: "B248-02-02", name: "Hello Kitty Body", model: "01" },
  { mold: "2849226-02", code: "B248-02-03", name: "Pompompurin Body", model: "02" },
  { mold: "2849226-02", code: "B248-02-04", name: "Kurousa Body", model: "03" },
  { mold: "2849226-02", code: "B248-02-05", name: "Shirousa Head", model: "04" },
  { mold: "2849226-02", code: "B248-02-06", name: "Shirousa Body", model: "04" },
  { mold: "2849226-02", code: "B248-02-07", name: "Kuririn Hat", model: "05" },
  { mold: "2849226-02", code: "B248-02-08", name: "Kuririn Body", model: "05" },
] as const;

export const MODELS = [
  { number: "01", name: "Hello Kitty" },
  { number: "02", name: "Pompompurin" },
  { number: "03", name: "Kurousa" },
  { number: "04", name: "Shirousa" },
  // Inj spells "Kuririn"; Assy spells "Kururin" (R15-17). Canonical keeps Inj
  // spelling; the Assy variant is recorded in sourceReference, not forked.
  { number: "05", name: "Kuririn", nameVariant: "Kururin" },
] as const;

export const SHARED_CAPSULE = {
  code: "C002-01-25",
  name: "O 48 mm Transparent Pink Capsule",
  scope: "ALL_MODELS",
} as const;

// Deco part nos verbatim from Deco sheet (code, decoProcess, injCode).
export const DECO_PARTS = [
  { code: "B248-01-01S", process: "S", inj: "B248-01-01", name: "Hello Kitty Ribbon" },
  { code: "B248-01-02S", process: "S", inj: "B248-01-02", name: "Hello Kitty Heart" },
  { code: "B248-02-01T", process: "T", inj: "B248-02-01", name: "Hello Kitty Head" },
  { code: "B248-02-02S", process: "S", inj: "B248-02-02", name: "Hello Kitty Body" },
  { code: "B248-01-03S", process: "S", inj: "B248-01-03", name: "Pompompurin Hat" },
  { code: "B248-01-04S", process: "S", inj: "B248-01-04", name: "Pompompurin Heart" },
  { code: "B248-02-03ST", process: "ST", inj: "B248-02-03", name: "Pompompurin Body" },
  { code: "B248-01-05S", process: "S", inj: "B248-01-05", name: "Kurousa Heart" },
  { code: "B248-02-04ST", process: "ST", inj: "B248-02-04", name: "Kurousa Body" },
  { code: "B248-01-06S", process: "S", inj: "B248-01-06", name: "Shirousa Heart" },
  { code: "B248-02-05T", process: "T", inj: "B248-02-05", name: "Shirousa Head" },
  { code: "B248-02-06S", process: "S", inj: "B248-02-06", name: "Shirousa Body" },
  { code: "B248-01-07S", process: "S", inj: "B248-01-07", name: "Kururin Leaf" },
  { code: "B248-01-08S", process: "S", inj: "B248-01-08", name: "Kururin Heart" },
  { code: "B248-02-07S", process: "S", inj: "B248-02-07", name: "Kururin Hat" },
  // Same inj code, second deco identity (Body vs Heart) — preserved, flagged.
  { code: "B248-01-08ST", process: "ST", inj: "B248-01-08", name: "Kururin Body", anomaly: "DUPLICATE_INJ_CODE" },
] as const;

// Paint usages verbatim from Deco, one row per (model, paint code).
// Same paint no. can carry a DIFFERENT color/feature per model (11A, 22A, 31A,
// 06A) — so usages are per model, never globalized. Multiple features on the same
// (model, code) share one ModelPart row with a combined display name. All strings
// (incl. "R ear", "Whisker R", "body", "Nose,Mouth, ...") preserved verbatim.
export const PAINT_USAGES = [
  // Model 01 - Hello Kitty
  { code: "PN-B248-01", color: "Pink", process: "FS (D)", model: "01", features: ["Ribbon"] },
  { code: "PN-B248-02", color: "Transparent Pink Orange", process: "FS (D)", model: "01", features: ["Heart"] },
  { code: "PN-B248-03A", color: "Black", process: "Tampo", model: "01", features: ["Eyes L/R"] },
  { code: "PN-B248-04A", color: "Pink", process: "Tampo", model: "01", features: ["Eye spark (L&R)"] },
  { code: "PN-B248-05A", color: "Yellow", process: "Tampo", model: "01", features: ["Nose"] },
  { code: "PN-B248-06A", color: "Light Pink", process: "Tampo", model: "01", features: ["Blush L & R"] },
  { code: "PN-B248-07", color: "Blue", process: "Book", model: "01", features: ["Shirt"] },
  { code: "PN-B248-31A", color: "Black Brown", process: "Tampo", model: "01", features: ["Whiskers L", "Whiskers R"] },
  // Model 02 - Pompompurin
  { code: "PN-B248-08", color: "Brown", process: "FS (d)", model: "02", features: ["Hat"] },
  { code: "PN-B248-09", color: "Yellow", process: "FS (d)", model: "02", features: ["body"] },
  { code: "PN-B248-10A", color: "White", process: "Tampo", model: "02", features: ["Highlights (L&R)"] },
  { code: "PN-B248-11A", color: "Pink", process: "Tampo", model: "02", features: ["Heart"] },
  { code: "PN-B248-12A", color: "Pink Orange", process: "Tampo", model: "02", features: ["Blush (L&R)"] },
  { code: "PN-B248-13", color: "Transparent Orange", process: "FS (d)", model: "02", features: ["Heart"] },
  { code: "PN-B248-22A", color: "Dark Brown", process: "Tampo", model: "02", features: ["Eyes (L&R)", "Butt"] },
  // Model 03 - Kurousa
  { code: "PN-B248-06A", color: "Light Pink", process: "Tampo", model: "03", features: ["Blush"] },
  { code: "PN-B248-11A", color: "White", process: "Tampo", model: "03", features: ["Snout & Eye reflection"] },
  { code: "PN-B248-14", color: "Brown", process: "FS (d)", model: "03", features: ["Head/Body"] },
  { code: "PN-B248-15A", color: "Pink", process: "Tampo", model: "03", features: ["L Ear", "R ear"] },
  { code: "PN-B248-16A", color: "Pink", process: "Tampo", model: "03", features: ["Heart"] },
  { code: "PN-B248-17", color: "Transparent Pink", process: "FS (d)", model: "03", features: ["Heart"] },
  { code: "PN-B248-31A", color: "Black Brown", process: "Tampo", model: "03", features: ["Nose,Mouth, Eyes & Eyebrow L & R"] },
  // Model 04 - Shirousa
  { code: "PN-B248-18", color: "Transparent Blue", process: "FS (d)", model: "04", features: ["Heart"] },
  { code: "PN-B248-19A", color: "Pink", process: "Tampo", model: "04", features: ["L Ear", "R Ear"] },
  { code: "PN-B248-20A", color: "Cream", process: "Tampo", model: "04", features: ["Snout"] },
  { code: "PN-B248-21A", color: "Pink", process: "Tampo", model: "04", features: ["Heart"] },
  { code: "PN-B248-22A", color: "Brown", process: "Tampo", model: "04", features: ["Eyes, Nose, Mouth"] },
  { code: "PN-B248-23A", color: "Light Pink", process: "Tampo", model: "04", features: ["Blush L & R"] },
  { code: "PN-B248-24", color: "Pink", process: "Book", model: "04", features: ["Ribbon"] },
  // Model 05 - Kuririn
  { code: "PN-B248-06A", color: "Light Pink", process: "Tampo", model: "05", features: ["Blush"] },
  { code: "PN-B248-11A", color: "White", process: "Tampo", model: "05", features: ["Glance"] },
  { code: "PN-B248-22A", color: "Brown", process: "Tampo", model: "05", features: ["Eyes, Nose & Mouth"] },
  { code: "PN-B248-25", color: "Transparent Green", process: "FS (d)", model: "05", features: ["Heart"] },
  { code: "PN-B248-26", color: "Green", process: "FS (d)", model: "05", features: ["Leaf"] },
  { code: "PN-B248-27", color: "Brown", process: "Book", model: "05", features: ["Ears L & R", "Head & Tail"] },
  { code: "PN-B248-28", color: "Pink", process: "Book", model: "05", features: ["Feet L & R"] },
  { code: "PN-B248-29A", color: "Pink", process: "Tampo", model: "05", features: ["Heart"] },
  { code: "PN-B248-30A", color: "Brown", process: "Tampo", model: "05", features: ["Whiskers L", "Whisker R"] },
] as const;

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const summary = {
    profile,
    product: PRODUCT.code,
    models: MODELS.length,
    injParts: INJ_PARTS.length,
    decoParts: DECO_PARTS.length,
    paintUsages: PAINT_USAGES.length,
    paintCodes: new Set(PAINT_USAGES.map((p) => p.code)).size,
    capsule: SHARED_CAPSULE.code,
    sources: SOURCE_PATHS.length,
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
    const productId = stableId(ns, profile, "product-b248");
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
      const modelId = stableId(ns, profile, `model-b248-${model.number}`);
      modelIds[model.number] = modelId;
      await tx.model.upsert({
        where: { id: modelId },
        update: {
          productId,
          modelNumber: model.number,
          modelName: model.name,
          sourceStatus: "SOURCE_ALIGNED",
          lifecycleStatus: "PUBLISHED",
          evidenceStatus: "PROVISIONAL",
          sourceReference: {
            seedProfile: profile,
            origin: "client-parts-list",
            productCode: PRODUCT.code,
            formCode: PRODUCT.formCode,
            ...(model as { nameVariant?: string }).nameVariant
              ? { nameVariant: (model as { nameVariant?: string }).nameVariant }
              : {},
          },
        },
        create: {
          id: modelId,
          productId,
          modelNumber: model.number,
          modelName: model.name,
          sourceStatus: "SOURCE_ALIGNED",
          lifecycleStatus: "PUBLISHED",
          evidenceStatus: "PROVISIONAL",
          sourceReference: {
            seedProfile: profile,
            origin: "client-parts-list",
            productCode: PRODUCT.code,
            formCode: PRODUCT.formCode,
          },
        },
      });
    }

    async function upsertModelPart(modelNumber: string, partCode: string, partName: string, seedKey: string) {
      const modelId = modelIds[modelNumber];
      await tx.modelPart.upsert({
        where: { modelId_partCode: { modelId, partCode } },
        update: { partName, lifecycleStatus: "PUBLISHED", evidenceStatus: "PROVISIONAL", routingSteps: [] },
        create: {
          id: stableId(ns, profile, seedKey),
          modelId,
          partCode,
          partName,
          lifecycleStatus: "PUBLISHED",
          evidenceStatus: "PROVISIONAL",
          routingSteps: [],
        },
      });
      const resolvedRow = await tx.modelPart.findUnique({
        where: { modelId_partCode: { modelId, partCode } },
        select: { id: true },
      });
      return resolvedRow?.id ?? stableId(ns, profile, seedKey);
    }

    for (const part of INJ_PARTS) {
      await upsertModelPart(part.model, part.code, part.name, `inj-${part.code}`);
    }
    for (const deco of DECO_PARTS) {
      const inj = INJ_PARTS.find((p) => p.code === deco.inj);
      await upsertModelPart(inj?.model ?? "01", deco.code, `${deco.name} (deco ${deco.process})`, `deco-${deco.code}`);
    }
    for (const model of MODELS) {
      await upsertModelPart(model.number, SHARED_CAPSULE.code, SHARED_CAPSULE.name, `capsule-${model.number}`);
    }
    // Paints attach per model usage row (same PN- code can differ per model).
    for (const paint of PAINT_USAGES) {
      await upsertModelPart(
        paint.model,
        paint.code,
        `Paint ${paint.code} · ${paint.color} · ${paint.features.join(" / ")}`,
        `paint-${paint.model}-${paint.code}`,
      );
    }
  });

  return plan(resolved);
}

/** Display name for a paint usage row. */
export function paintPartDisplayName(paint: { code: string; color: string; features: readonly string[] }): string {
  return `Paint ${paint.code} · ${paint.color} · ${paint.features.join(" / ")}`;
}

if (isMainModule("02-pl-b248-catalog.seed.ts")) plan({});
