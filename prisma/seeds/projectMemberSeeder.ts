import { PrismaClient } from "../../generated/prisma";

export async function seedProjectMember(prisma: PrismaClient, _workspaceIds: string | string[]) {
	console.log("🌱 Starting project member seeding...");

	try {
		console.log("🗑️  Clearing existing project members...");
		await prisma.projectMember.deleteMany({});
		console.log("   ✓ Project members deleted");

		// The legacy PMS project module that used to source demo membership
		// records has been retired, so there is no project data left to derive
		// ProjectMember rows from. This module remains BLOCKED_REVIEW pending
		// a tenancy/authorization review, so the table is cleared but left
		// otherwise unseeded rather than removed.
		console.log("⚠️  No project source data available, skipping project member seeding");
	} catch (error) {
		console.error("❌ Error during project member seeding:", error);
		throw error;
	}
}
