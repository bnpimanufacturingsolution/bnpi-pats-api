import { PrismaClient } from "../generated/prisma";
import * as argon2 from "argon2";
import { seedWorkspace } from "./seeds/workspaceSeeder";
import { seedProduct } from "./seeds/productSeeder";
import { seedEmployee } from "./seeds/employeeSeeder";
import { seedWorkspaceMember } from "./seeds/workspaceMemberSeeder";
import { seedProjectMember } from "./seeds/projectMemberSeeder";

/**
 * Legacy compatibility/demo seed orchestrator.
 *
 * These values support local presentation and compatibility testing for the
 * inherited Mongo runtime. They are not a canonical PATS seed or a source of
 * requirements for the provisional manufacturing model.
 */
const prisma = new PrismaClient();

async function main() {
	console.log(`\n🏢 Seeding data distributed across ALL workspaces\n`);

	// Seed workspaces first
	await seedWorkspace(prisma);

	// Get ALL workspace IDs
	const workspaces = await prisma.workspace.findMany({
		where: { isDeleted: false },
		select: { id: true, name: true },
	});
	const workspaceIds = workspaces.map((ws) => ws.id);

	console.log(`\n📍 Found ${workspaceIds.length} workspaces:`);
	workspaces.forEach((ws) => console.log(`   - ${ws.name} (${ws.id})`));
	console.log(`\n📦 Data will be distributed across all workspaces\n`);

	// Seed data in order (respecting dependencies)
	// Pass all workspace IDs - seeders will distribute data across them
	await seedEmployee(prisma, workspaceIds);
	await seedWorkspaceMember(prisma, workspaceIds);
	await seedProjectMember(prisma, workspaceIds);
	await seedProduct(prisma, workspaceIds);

	console.log("Seeding completed successfully!");
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error("Error during seeding:", e);
		await prisma.$disconnect();
		process.exit(1);
	});
