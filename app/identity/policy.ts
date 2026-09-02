import type { SubjectAssignmentRecord } from "./types";

/**
 * Role-bundle → capability expansion (ABAC-lite).
 *
 * Four roles (2026-08 design):
 * - admin   — full access (absorbs former catalog-manager + inventory-controller)
 * - planner — planning + read monitoring + catalog read
 * - qi      — quality inspector (IQC + QC): quality + reconciliation resolve
 * - operator— floor staff: execution, inventory, station encode
 *
 * Line Leader is NOT a role — operator + daily-metrics.encode via LineLeaderAssignment.
 *
 * Quality staging (Journey D): stage scope is QualityStageAssignment (fail-closed),
 * not this map.
 */
export const ROLE_BUNDLE_CAPABILITIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
	planner: [
		"planning.read",
		"planning.manage",
		"material-requirement.manage",
		// Planner may enter Manufacturing for read monitoring; encode stays off by default.
		"monitoring.read",
		"catalog.read",
		// Production summary read (dashboard / line report) — planner is a read-mostly
		// planning + monitoring role that views the production picture, not the full
		// floor-directory execution.read surface.
		"dashboard.read",
	],
	admin: [
		// Catalog (former catalog-manager)
		"catalog.read",
		"catalog.manage",
		"source-revision.approve",
		// Planning
		"planning.read",
		"planning.manage",
		"material-requirement.manage",
		// Execution
		"execution.read",
		"execution.write",
		// Inventory (former inventory-controller)
		"inventory.read",
		"inventory.receive",
		"inventory.issue",
		"reconciliation.read",
		// Monitoring
		"monitoring.read",
		"monitoring.station.encode",
		"daily-metrics.encode",
		// Production summary read
		"dashboard.read",
		// Quality
		"quality.read",
		"quality.resolve",
		"reconciliation.resolve",
		// Identity / operations
		"identity.read",
		"capabilities.read",
		"operations.manage",
	],
	qi: [
		"quality.read",
		"quality.resolve",
		"reconciliation.resolve",
		"monitoring.read",
	],
	operator: [
		"execution.read",
		"execution.write",
		"inventory.read",
		"inventory.issue",
		"monitoring.read",
		// Journey A: floor operators may encode station boards by default.
		"monitoring.station.encode",
		"dashboard.read",
	],
});

/** Standalone capabilities assignable as CAPABILITY kind (must be listed to pass KNOWN filter). */
const STANDALONE_CAPABILITIES = [
	"monitoring.read",
	"monitoring.station.encode",
	"daily-metrics.encode",
] as const;

const KNOWN_CAPABILITIES = new Set([
	...Object.values(ROLE_BUNDLE_CAPABILITIES).flat(),
	...STANDALONE_CAPABILITIES,
]);

/** Encode rights imply monitoring.read for list/GET so Line Leader can open sheets without a second grant. */
const ENCODE_IMPLIES_READ: Readonly<Record<string, readonly string[]>> = Object.freeze({
	"daily-metrics.encode": ["monitoring.read"],
	"monitoring.station.encode": ["monitoring.read"],
});

export function effectiveCapabilities(assignments: readonly SubjectAssignmentRecord[]): string[] {
	const capabilities = new Set<string>();

	for (const assignment of assignments) {
		if (assignment.status !== "ACTIVE") continue;

		if (assignment.kind === "CAPABILITY") {
			if (KNOWN_CAPABILITIES.has(assignment.key)) capabilities.add(assignment.key);
			continue;
		}

		for (const capability of ROLE_BUNDLE_CAPABILITIES[assignment.key] ?? []) {
			capabilities.add(capability);
		}
	}

	for (const capability of [...capabilities]) {
		for (const implied of ENCODE_IMPLIES_READ[capability] ?? []) {
			capabilities.add(implied);
		}
	}

	return [...capabilities].sort();
}

export function hasCapability(assignments: readonly SubjectAssignmentRecord[], capability: string): boolean {
	return effectiveCapabilities(assignments).includes(capability);
}

export function hasAnyCapability(
	assignments: readonly SubjectAssignmentRecord[],
	capabilities: readonly string[],
): boolean {
	const effective = new Set(effectiveCapabilities(assignments));
	return capabilities.some((capability) => effective.has(capability));
}
