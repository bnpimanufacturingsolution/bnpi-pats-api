import { PrismaClient } from "../../generated/prisma";

// Default workspace code for seeding
export const DEFAULT_WORKSPACE_CODE = "DEFAULT";

export async function seedWorkspace(prisma: PrismaClient) {
	console.log("🌱 Starting workspace seeding...");

	const workspaceData = [
		{
			id: "697845e3479eaa6d2f796b7c",
			organizationId: "697845e3479eaa6d2f796b7c",
			name: "Default Workspace",
			code: "DEFAULT",
			description: "Default workspace for development and testing",
			address: "123 Main Street, Makati City, Metro Manila 1200",
			phone: "+63-2-8123-4567",
			email: "admin@default-workspace.com",
			status: "ACTIVE" as const,
			isPinned: true,
			isDeleted: false,
		},
		{
			id: "697845e3479eaa6d2f796b7d",
			organizationId: "697845e3479eaa6d2f796b7c",
			name: "Acme Corporation",
			code: "ACME",
			description: "Acme Corporation - A sample workspace",
			address: "456 Corporate Ave, BGC, Taguig City 1630",
			phone: "+63-2-8234-5678",
			email: "info@acme-corp.com",
			status: "ACTIVE" as const,
			isPinned: false,
			isDeleted: false,
		},
		{
			id: "697845e3479eaa6d2f796b7e",
			organizationId: "697845e3479eaa6d2f796b7c",
			name: "Tech Innovations Ltd",
			code: "TECH",
			description: "Technology innovations company",
			address: "789 Innovation Hub, Ortigas Center, Pasig City 1605",
			phone: "+63-2-8345-6789",
			email: "hello@techinnovations.com",
			status: "ACTIVE" as const,
			isPinned: false,
			isDeleted: false,
		},
	];

	try {
		// Upsert workspaces (create or update to avoid relation conflicts)
		console.log("📝 Upserting workspace records...");
		for (const ws of workspaceData) {
			await prisma.workspace.upsert({
				where: { id: ws.id },
				update: {
					organizationId: ws.organizationId,
					name: ws.name,
					code: ws.code,
					description: ws.description,
					address: ws.address,
					phone: ws.phone,
					email: ws.email,
					status: ws.status,
					isPinned: ws.isPinned,
					isDeleted: ws.isDeleted,
				},
				create: ws,
			});
		}

		console.log(`✅ Successfully upserted ${workspaceData.length} workspace records`);

		// Display summary
		const activeWorkspaces = workspaceData.filter((w) => w.status === "ACTIVE").length;
		const pinnedWorkspaces = workspaceData.filter((w) => w.isPinned).length;

		console.log("\n📊 Workspace Summary:");
		console.log(`   🏢 Active Workspaces: ${activeWorkspaces}`);
		console.log(`   📌 Pinned Workspaces: ${pinnedWorkspaces}`);
		console.log(`   📈 Total Workspaces: ${workspaceData.length}`);

		console.log("\n🎉 Workspace seeding completed successfully!");

		return workspaceData;
	} catch (error) {
		console.error("❌ Error during workspace seeding:", error);
		throw error;
	}
}

/**
 * Get workspace ID by code
 * Use this function to get the workspace ID from code for other seeders
 */
export async function getWorkspaceIdByCode(prisma: PrismaClient, code: string): Promise<string> {
	const workspace = await prisma.workspace.findFirst({
		where: { code, isDeleted: false },
		select: { id: true },
	});

	if (!workspace) {
		throw new Error(`Workspace with code "${code}" not found`);
	}

	return workspace.id;
}
