import { PrismaClient } from "../../generated/prisma";

export async function seedWorkspaceMember(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting workspace member seeding...");

	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	// Primary admin user - set as OWNER on all workspaces
	const PRIMARY_USER_ID = "697845e6479eaa6d2f796b89";

	// Additional sample members
	const sampleMembers = [
		{
			userId: "697845e6479eaa6d2f796b90",
			role: "ADMIN" as const,
			displayName: "Admin User",
			email: "admin@example.com",
		},
		{
			userId: "697845e6479eaa6d2f796b91",
			role: "MEMBER" as const,
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

	try {
		console.log("🗑️  Clearing existing workspace members...");
		await prisma.workspaceMember.deleteMany({});
		console.log("   ✓ Workspace members deleted");

		console.log("📝 Creating workspace member records...");

		const allMembers: any[] = [];

		for (const workspaceId of orgIds) {
			// Add primary user as OWNER for every workspace
			allMembers.push({
				workspaceId,
				userId: PRIMARY_USER_ID,
				role: "OWNER",
				displayName: "Renz (Owner)",
				email: "renz@example.com",
				isDeleted: false,
			});

			// Add sample members to each workspace
			for (const member of sampleMembers) {
				allMembers.push({
					workspaceId,
					userId: member.userId,
					role: member.role,
					displayName: member.displayName,
					email: member.email,
					isDeleted: false,
				});
			}
		}

		await prisma.workspaceMember.createMany({ data: allMembers });

		console.log(`✅ Successfully created ${allMembers.length} workspace member records`);

		console.log("\n📊 Workspace Member Summary:");
		console.log(`   👑 OWNER: ${orgIds.length} (user ${PRIMARY_USER_ID} on all workspaces)`);
		console.log(`   🔧 ADMIN: ${orgIds.length}`);
		console.log(`   👤 MEMBER: ${orgIds.length}`);
		console.log(`   👁️  VIEWER: ${orgIds.length}`);
		console.log(`\n   📈 Total: ${allMembers.length}`);

		console.log("\n🎉 Workspace member seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during workspace member seeding:", error);
		throw error;
	}
}
