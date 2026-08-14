import { CommandProblem } from "./command-support";

export const NOT_ALLOWED_STAGE_PROBLEM = "urn:bandai:pats:problem:not-allowed-stage";

export function operationalWorkspaceId(): string {
	return process.env.PATS_OPERATIONAL_CONTEXT_KEY ?? "PATS";
}

export type QualityStageScopeStore = {
	qualityStageAssignment: {
		findMany: (args: {
			where: { subjectId: string; workspaceId: string; status: "ACTIVE" };
			select: { stageId: true };
		}) => Promise<Array<{ stageId: string }>>;
	};
};

export async function listAllowedQualityStageIds(
	database: QualityStageScopeStore,
	subjectId: string,
	workspaceId = operationalWorkspaceId(),
): Promise<string[]> {
	const rows = await database.qualityStageAssignment.findMany({
		where: { subjectId, workspaceId, status: "ACTIVE" },
		select: { stageId: true },
	});
	return rows.map((row) => row.stageId);
}

export async function assertQualityStageAllowed(
	database: QualityStageScopeStore,
	subjectId: string,
	stageId: string,
	workspaceId = operationalWorkspaceId(),
): Promise<void> {
	const allowed = await listAllowedQualityStageIds(database, subjectId, workspaceId);
	if (allowed.includes(stageId)) return;
	throw new CommandProblem(
		403,
		NOT_ALLOWED_STAGE_PROBLEM,
		"Forbidden",
		"The gate stage is not in this subject's allowedStages.",
	);
}
