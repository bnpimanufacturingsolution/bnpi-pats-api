import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Shared helpers for scripts/datamigration seed modules.
 *
 * Every seed in this folder is DRY-RUN BY DEFAULT and never writes unless the
 * caller explicitly opts in. Nothing here executes on import.
 *
 * Conventions (aligned with scripts/pats-seed.mjs):
 * - deterministic stableId() per seed namespace (sha256 -> UUIDv5-shaped)
 * - business codes are prefixed per profile (DEMO-/UAT-) via code()
 * - all writes are upserts so re-runs are idempotent
 * - large scan-log workbooks are parsed at runtime from SOURCE_PATH so the
 *   seed file stays small; a SAMPLE_ROWS constant preserves review evidence
 */

export type SeedProfile = "demo" | "uat";

export function seedPrefix(profile: SeedProfile): string {
  return profile.toUpperCase();
}

export function code(profile: SeedProfile, value: string): string {
  return `${seedPrefix(profile)}-${value}`;
}

/** Deterministic UUIDv5-shaped id scoped to a seed namespace + profile. */
export function stableId(namespace: string, profile: SeedProfile, key: string): string {
  const hex = createHash("sha256")
    .update(`pats-datamigration:${namespace}:${profile}:${key}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex
    .slice(12, 16)
    .join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

export interface SeedRunOptions {
  profile?: SeedProfile;
  /** Default true. Pass { dryRun: false } to actually write. */
  dryRun?: boolean;
  prisma?: {
    // Minimal structural surface used by seeds (real PrismaClient satisfies this).
    $transaction: (fn: (tx: any) => Promise<unknown>) => Promise<unknown>;
  };
}

export function resolveOptions(options: SeedRunOptions = {}): Required<Omit<SeedRunOptions, "prisma">> & {
  prisma: SeedRunOptions["prisma"];
} {
  return {
    profile: options.profile ?? "demo",
    dryRun: options.dryRun ?? true,
    prisma: options.prisma,
  };
}

/** Guard used at the top of every executable seed entrypoint. */
export function assertCanWrite(dryRun: boolean): void {
  if (dryRun) return;
  const mode = (process.env.SEED_MODE ?? "none").trim().toLowerCase();
  if (mode !== "demo" && mode !== "uat") {
    throw new Error(
      "Refusing to write: set SEED_MODE=demo|uat AND pass { dryRun: false }. " +
        `Current SEED_MODE=${JSON.stringify(process.env.SEED_MODE ?? "none")}.`,
    );
  }
  if (!process.env.PATS_DATABASE_URL) {
    throw new Error("PATS_DATABASE_URL is required for datamigration writes.");
  }
}

export function logPlan(seedName: string, planned: Record<string, unknown>): void {
  console.log(`[datamigration:${seedName}] DRY-RUN plan (no writes):`);
  for (const [k, v] of Object.entries(planned)) console.log(`  ${k}: ${v}`);
}

export function normalizePartCode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/**
 * ESM-safe "run as script" check (works under tsx/ts-node in ESM or CJS).
 * Never true on import — argv[1] is the entrypoint, not the imported file.
 */
export function isMainModule(suffix: string): boolean {
  const entry = (process.argv[1] ?? "").replace(/\\/g, "/");
  return entry.endsWith(suffix);
}

/**
 * Resolve a repo-root-relative SOURCE_PATH to an absolute path.
 * Works whether the command runs from the repo root (HRIS-BANDAI/) or from
 * bnpi-pats-api/. Throws with both candidates when neither exists.
 */
export function resolveSourcePath(repoRootRelative: string): string {
  const candidates = [
    path.resolve(process.cwd(), repoRootRelative),
    path.resolve(process.cwd(), "..", repoRootRelative),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Source workbook not found. Tried:\n  ${candidates.join("\n  ")}\nRun from HRIS-BANDAI/ or bnpi-pats-api/.`,
  );
}
