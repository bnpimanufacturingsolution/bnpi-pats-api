import { expect } from "chai";
import {
	assertQualityStageAllowed,
	listAllowedQualityStageIds,
	NOT_ALLOWED_STAGE_PROBLEM,
} from "../app/pats/quality-stage-scope";
import { CommandProblem } from "../app/pats/command-support";

function store(stageIds: string[]) {
	return {
		qualityStageAssignment: {
			findMany: async () => stageIds.map((stageId) => ({ stageId })),
		},
	};
}

describe("quality stage allow-list", () => {
	it("returns active stage ids for the subject", async () => {
		const allowed = await listAllowedQualityStageIds(store(["stage-decoration", "stage-injection"]), "subject-quality");
		expect(allowed).to.deep.equal(["stage-decoration", "stage-injection"]);
	});

	it("allows a stage in the subject's allow-list", async () => {
		await assertQualityStageAllowed(store(["stage-decoration"]), "subject-quality", "stage-decoration");
	});

	it("denies a stage outside the allow-list", async () => {
		try {
			await assertQualityStageAllowed(store(["stage-decoration"]), "subject-quality", "stage-assembly");
			expect.fail("expected CommandProblem");
		} catch (error) {
			expect(error).to.be.instanceOf(CommandProblem);
			expect((error as CommandProblem).status).to.equal(403);
			expect((error as CommandProblem).type).to.equal(NOT_ALLOWED_STAGE_PROBLEM);
		}
	});

	it("fail-closes when the subject has no stage rows", async () => {
		try {
			await assertQualityStageAllowed(store([]), "subject-quality", "stage-decoration");
			expect.fail("expected CommandProblem");
		} catch (error) {
			expect(error).to.be.instanceOf(CommandProblem);
			expect((error as CommandProblem).status).to.equal(403);
		}
	});
});
