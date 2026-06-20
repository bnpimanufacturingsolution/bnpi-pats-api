import { PrismaClient } from "../../generated/prisma";

export async function seedProjectMember(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting project member seeding...");

	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		console.log("🗑️  Clearing existing project members...");
		await prisma.projectMember.deleteMany({});
		console.log("   ✓ Project members deleted");

		// Get all projects grouped by workspace
		const projects = await prisma.project.findMany({
			where: {
				workspaceId: { in: orgIds },
				isDeleted: false,
			},
			select: { id: true, workspaceId: true, name: true },
		});

		if (projects.length === 0) {
			console.log("⚠️  No projects found, skipping project member seeding");
			return;
		}

		// Sample member/viewer users (NOT the OWNER/ADMIN who get auto-access)
		const projectUsers = [
			{
				userId: "697845e6479eaa6d2f796b91",
				role: "EDITOR" as const,
				displayName: "Regular Member",
				email: "member@example.com",
			},
			{
				userId: "697845e6479eaa6d2f796b92",
				role: "VIEWER" as const,
				displayName: "Viewer User",
				email: "viewer@example.com",
			},
		];

		console.log("📝 Creating project member records...");

		const allProjectMembers: any[] = [];

		for (const project of projects) {
			for (const user of projectUsers) {
				allProjectMembers.push({
					projectId: project.id,
					workspaceId: project.workspaceId,
					userId: user.userId,
					role: user.role,
					displayName: user.displayName,
					email: user.email,
					isDeleted: false,
				});
			}
		}

		if (allProjectMembers.length > 0) {
			await prisma.projectMember.createMany({ data: allProjectMembers });
		}

		console.log(`✅ Successfully created ${allProjectMembers.length} project member records`);

		console.log("\n📊 Project Member Summary:");
		console.log(`   📁 Projects with members: ${projects.length}`);
		console.log(`   ✏️  EDITOR: ${projects.length}`);
		console.log(`   👁️  VIEWER: ${projects.length}`);
		console.log(`   ℹ️  OWNER/ADMIN users get auto-access (no explicit records needed)`);
		console.log(`\n   📈 Total: ${allProjectMembers.length}`);

		console.log("\n🎉 Project member seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during project member seeding:", error);
		throw error;
	}
}
