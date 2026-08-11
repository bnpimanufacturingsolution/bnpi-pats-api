import type { SubjectAssignmentRecord } from "./types";

/**
 * Role-bundle → capability expansion (ABAC-lite).
 *
 * Monitoring (2026-08-11 working defaults):
 * - monitoring.read — Matrix wall + Management GETs
 * - monitoring.station.encode — Station board PUT (Journey A)
 * - daily-metrics.encode — Line Leader day-sheet PUT (Journey B); not a fourth business role
 *
 * Demo seed may still assign fat multi-bundles; do not treat seed as product RBAC truth.
 */
export const ROLE_BUNDLE_CAPABILITIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
	"catalog-manager": ["catalog.read", "catalog.manage", "source-revision.approve"],
	planner: [
		"planning.read",
		"planning.manage",
		"material-requirement.manage",
		// Planner may enter Manufacturing for read monitoring; encode stays off by default.
		"monitoring.read",
	],
	"production-operator": [
		"execution.read",
		"execution.write",
		"inventory.issue",
		"monitoring.read",
		// Journey A: floor operators may encode station boards by default.
		"monitoring.station.encode",
	],
	"inventory-controller": ["inventory.read", "inventory.receive", "inventory.issue", "reconciliation.read"],
	"quality-reviewer": ["quality.read", "quality.resolve", "reconciliation.resolve"],
	"operations-admin": [
		"identity.read",
		"capabilities.read",
		"operations.manage",
		"monitoring.read",
		"monitoring.station.encode",
		// Admin optional encode — granted for operations bootstrap / support.
		"daily-metrics.encode",
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
