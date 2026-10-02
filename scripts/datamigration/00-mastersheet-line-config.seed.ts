/**
 * 00 — Mastersheet line-config seed (DRY-RUN by default, never auto-executes).
 *
 * Source: docs/REPORTS/MANUFACTURING DOCUMENTS/BNPI (PATS) Mastersheet.xlsx
 * Sheet: Sheet1 (B1:H25). 73 cells, 0 formulas. See sibling .seed.md for grid.
 *
 * Seeds factory vocabulary ONLY (Stage/SubStage/Station/WorkProcess/eligibility).
 * Creates NO Subjects (Leader/Operator cells are placeholders), NO Booths (no booth
 * rows in source), NO deletes. Idempotent upserts; safe to re-run.
 *
 * Usage:
 *   tsx scripts/datamigration/00-mastersheet-line-config.seed.ts            # plan only
 *   SEED_MODE=demo tsx scripts/datamigration/00-mastersheet-line-config.seed.ts --write
 */
import { assertCanWrite, code, isMainModule, logPlan, resolveOptions, stableId, type SeedRunOptions } from "./helpers.js";

export const SEED_NAME = "00-mastersheet-line-config";
export const SOURCE_PATH =
  "docs/REPORTS/MANUFACTURING DOCUMENTS/BNPI (PATS) Mastersheet.xlsx";

// Verbatim sample (Sheet1 R2/R8/R15 + one detail row each) — review evidence.
export const SAMPLE_ROWS = [
  { section: "Injection", supervisor: "Sheila?", lines: "Total (3)", leaders: "", process: "Total (5)" },
  { section: "", supervisor: "", lines: "Line 1", leaders: "Leader 1", process: "Machine Operator" },
  { section: "Decoration", supervisor: "Melroshelle", lines: "Total (17)", leaders: "Total (17)", process: "" },
  { section: "Assembly", supervisor: "", lines: "Total (10)", leaders: "", process: "" },
] as const;

// Structured extraction — every row of Sheet1 below the header, no invented lines.
const STAGES = [
  {
    key: "injection",
    name: "Injection",
    stations: [
      { key: "inj-01", name: "Injection · Line 1", codeSuffix: "INJ-01", order: 1 },
      { key: "inj-02", name: "Injection · Line 2", codeSuffix: "INJ-02", order: 2 },
      { key: "inj-03", name: "Injection · Line 3", codeSuffix: "INJ-03", order: 3 },
    ],
    subStages: [{ key: "molding", name: "Molding", order: 1 }],
    processes: [
      { key: "machine-operator", name: "Machine Operator", subStage: "molding", order: 1 },
      { key: "gate-cutting", name: "Gate Cutting", subStage: "molding", order: 2 },
      { key: "offline-operator", name: "Offline Operator", subStage: "molding", order: 3 },
      // IQC + MH are headcount rows, not routable processes — recorded as disabled
      // work processes so the vocabulary is complete without polluting routing.
      { key: "iqc", name: "IQC (Injection QC)", subStage: "molding", order: 4, enabled: false },
      { key: "material-handler", name: "MH (Material Handler)", subStage: "molding", order: 5, enabled: false },
    ],
  },
  {
    key: "decoration",
    name: "Decoration",
    stations: [
      { key: "dec-fullspray", name: "Decoration · Full Spray", codeSuffix: "DEC-FS", order: 2 },
      { key: "dec-mask", name: "Decoration · Mask Spray", codeSuffix: "DEC-MS", order: 3 },
      { key: "dec-tampo", name: "Decoration · Tampo", codeSuffix: "DEC-TP", order: 4 },
      { key: "dec-mimaki", name: "Decoration · Mimaki", codeSuffix: "DEC-MM", order: 5 },
    ],
    subStages: [
      { key: "full-spray", name: "Full Spray", order: 1 },
      { key: "mask-spray", name: "Mask Spray", order: 2 },
      { key: "tampo", name: "Tampo", order: 3 },
    ],
    processes: [
      { key: "full-spray-manual-drum", name: "Full Spray (Manual, Drum)", subStage: "full-spray", order: 1 },
      { key: "line-spray-mask", name: "Line Spray (Mask)", subStage: "mask-spray", order: 2 },
      { key: "tampo", name: "Tampo", subStage: "tampo", order: 3 },
      { key: "mimaki", name: "Mimaki", subStage: "tampo", order: 4 },
    ],
  },
  {
    key: "assembly",
    name: "Assembly",
    // 10 identical assembly lines; names stay generic because the source gives
    // no per-line process (R16 "processes may vary").
    stations: Array.from({ length: 10 }, (_, i) => ({
      key: `asm-${String(i + 1).padStart(2, "0")}`,
      name: `Assembly · Line ${i + 1}`,
      codeSuffix: `ASM-${String(i + 1).padStart(2, "0")}`,
      order: 5 + i,
    })),
    subStages: [
      { key: "sub-assembly", name: "Sub-Assembly", order: 1 },
      { key: "assortment", name: "Assortment", order: 3 },
      { key: "main-packing", name: "Main Packing", order: 1 },
    ],
    processes: [
      { key: "sub-assembly", name: "Sub-Assembly", subStage: "sub-assembly", order: 1 },
      { key: "assortment", name: "Assortment", subStage: "assortment", order: 2 },
      { key: "main-packing", name: "Main Packing", subStage: "main-packing", order: 1 },
    ],
  },
  {
    key: "warehouse",
    name: "Warehouse",
    stations: [{ key: "wh-packing", name: "Warehouse · Main Packing", codeSuffix: "WH-PK", order: 8 }],
    subStages: [],
    processes: [],
  },
] as const;

export function plan(options: SeedRunOptions = {}) {
  const { profile } = resolveOptions(options);
  const stationCount = STAGES.reduce((n, s) => n + s.stations.length, 0);
  const processCount = STAGES.reduce((n, s) => n + s.processes.length, 0);
  const summary = {
    profile,
    stages: STAGES.length,
    stations: stationCount,
    processes: processCount,
    subjectsToCreate: 0,
    boothsToCreate: 0,
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
    const workflowId = stableId(ns, profile, "workflow-main-production");
    await tx.workflowGroup.upsert({
      where: { id: workflowId },
      update: { name: "Main Production", linkageMode: "LINKED", displayOrder: 1, lifecycleStatus: "PUBLISHED", isSystemSeed: true },
      create: { id: workflowId, projectId: null, name: "Main Production", linkageMode: "LINKED", displayOrder: 1, lifecycleStatus: "PUBLISHED", isSystemSeed: true },
    });

    const stageIds: Record<string, string> = {};
    const subStageIds: Record<string, string> = {};
    for (const [index, stage] of STAGES.entries()) {
      const stageId = stableId(ns, profile, `stage-${stage.key}`);
      stageIds[stage.key] = stageId;
      await tx.stage.upsert({
        where: { id: stageId },
        update: { workflowGroupId: workflowId, name: stage.name, displayOrder: index + 1, isSystemSeed: true },
        create: { id: stageId, workflowGroupId: workflowId, name: stage.name, displayOrder: index + 1, isSystemSeed: true },
      });
      for (const sub of stage.subStages) {
        const subId = stableId(ns, profile, `substage-${sub.key}`);
        subStageIds[sub.key] = subId;
        await tx.subStage.upsert({
          where: { id: subId },
          update: { name: sub.name, displayOrder: sub.order, isSystemSeed: true, isConfigurable: true },
          create: { id: subId, name: sub.name, displayOrder: sub.order, isSystemSeed: true, isConfigurable: true },
        });
        await tx.subStageEligibility.upsert({
          where: { stageId_subStageId: { stageId, subStageId: subId } },
          update: {},
          create: { stageId, subStageId: subId },
        });
      }
      for (const station of stage.stations) {
        const id = stableId(ns, profile, `station-${station.key}`);
        await tx.station.upsert({
          where: { id },
          update: { workspaceId: "PATS", name: station.name, stationCode: code(profile, station.codeSuffix), operationalContextKey: "PATS", stageId, displayOrder: station.order, isEnabled: true },
          create: { id, workspaceId: "PATS", name: station.name, stationCode: code(profile, station.codeSuffix), operationalContextKey: "PATS", stageId, displayOrder: station.order, isEnabled: true },
        });
      }
      for (const proc of stage.processes) {
        const subId = subStageIds[(proc as { subStage: string }).subStage];
        if (!subId) continue;
        const id = stableId(ns, profile, `process-${proc.key}`);
        await tx.workProcess.upsert({
          where: { id },
          update: { subStageId: subId, name: proc.name, displayOrder: proc.order, isEnabled: (proc as { enabled?: boolean }).enabled !== false, isSystemSeed: true, labelledCycleTimeSec: null },
          create: { id, subStageId: subId, name: proc.name, displayOrder: proc.order, isEnabled: (proc as { enabled?: boolean }).enabled !== false, isSystemSeed: true, labelledCycleTimeSec: null },
        });
      }
    }
  });

  return plan(resolved);
}

if (isMainModule("00-mastersheet-line-config.seed.ts")) {
  const write = process.argv.includes("--write");
  if (write) {
    // eslint-disable-next-line no-console
    console.log(`[${SEED_NAME}] --write requires SEED_MODE + PATS_DATABASE_URL; wiring is left to the approved migration run.`);
  } else {
    plan({});
  }
}
