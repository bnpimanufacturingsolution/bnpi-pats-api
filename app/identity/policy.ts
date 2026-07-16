import type { SubjectAssignmentRecord } from "./types";

export const ROLE_BUNDLE_CAPABILITIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
	"catalog-manager": ["catalog.read", "catalog.manage", "source-revision.approve"],
	planner: ["planning.read", "planning.manage", "material-requirement.manage"],
	"production-operator": ["execution.read", "execution.write", "inventory.issue"],
	"inventory-controller": ["inventory.read", "inventory.receive", "inventory.issue", "reconciliation.read"],
	"quality-reviewer": ["quality.read", "quality.resolve", "reconciliation.resolve"],
	"operations-admin": ["identity.read", "capabilities.read", "operations.manage"],
});

const KNOWN_CAPABILITIES = new Set(Object.values(ROLE_BUNDLE_CAPABILITIES).flat());

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

	return [...capabilities].sort();
}

export function hasCapability(assignments: readonly SubjectAssignmentRecord[], capability: string): boolean {
	return effectiveCapabilities(assignments).includes(capability);
}
