import { PrismaClient, CategoryType } from "../../generated/prisma";

export async function seedCategory(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting category seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	// Get all existing projects to assign categories to them
	const projects = await prisma.project.findMany({
		select: { id: true },
	});

	if (projects.length === 0) {
		console.warn(
			"⚠️  No projects found. Categories will be created without project assignments.",
		);
	}

	const projectIds = projects.map((p) => p.id);

	const categoryData = [
		{
			id: "607f1f77bcf86cd799430001",
			name: "Human Resource",
			description: "Personnel, staffing, contractors, and HR-related costs",
			color: "#3B82F6", // Blue
			type: CategoryType.OPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430002",
			name: "Hardware",
			description: "Physical equipment, devices, servers, and infrastructure",
			color: "#10B981", // Green
			type: CategoryType.CAPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430003",
			name: "Software",
			description: "Software licenses, subscriptions, and digital tools",
			color: "#6366F1", // Indigo
			type: CategoryType.OPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430004",
			name: "Infrastructure",
			description: "Cloud hosting, data centers, and IT infrastructure",
			color: "#F59E0B", // Amber
			type: CategoryType.CAPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430005",
			name: "Consulting",
			description: "Professional services, consulting, and advisory costs",
			color: "#EC4899", // Pink
			type: CategoryType.OPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430006",
			name: "Training",
			description: "Employee training, courses, certifications, and workshops",
			color: "#8B5CF6", // Purple
			type: CategoryType.OPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430007",
			name: "Networking",
			description: "Network equipment, routers, switches, and connectivity",
			color: "#14B8A6", // Teal
			type: CategoryType.CAPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430008",
			name: "Security",
			description: "Cybersecurity tools, firewalls, and security services",
			color: "#EF4444", // Red
			type: CategoryType.OPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430009",
			name: "Office Supplies",
			description: "Furniture, stationery, and general office equipment",
			color: "#F97316", // Orange
			type: CategoryType.CAPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430010",
			name: "Telecommunications",
			description: "Phone systems, mobile devices, and communication tools",
			color: "#06B6D4", // Cyan
			type: CategoryType.OPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430011",
			name: "Maintenance",
			description: "Equipment maintenance, repairs, and support contracts",
			color: "#84CC16", // Lime
			type: CategoryType.OPEX,
			isActive: true,
			isDeleted: false,
		},
		{
			id: "607f1f77bcf86cd799430012",
			name: "Miscellaneous",
			description: "Other uncategorized operational expenses",
			color: "#6B7280", // Gray
			type: CategoryType.OPEX,
			isActive: true,
			isDeleted: false,
		},
	];

	try {
		// Clear existing categories
		console.log("🗑️  Clearing existing categories...");
		await prisma.category.deleteMany({});
		console.log("   ✓ Categories deleted");

		// Create categories and assign them to all projects
		console.log("📝 Creating category records...");
		await prisma.category.createMany({
			data: categoryData.map((category, index) => {
				const orgId = orgIds[index % orgIds.length];
				return {
					...category,
					workspaceId: orgId,
					organizationId: orgId,
					projectIds: projectIds, // Assign to all projects
				};
			}),
		});

		console.log(`✅ Successfully created ${categoryData.length} category records`);

		// Update projects with categoryIds
		if (projectIds.length > 0) {
			console.log("\n📝 Updating projects with category references...");
			const allCategoryIds = categoryData.map((c) => c.id);

			await prisma.project.updateMany({
				where: {
					id: { in: projectIds },
				},
				data: {
					categoryIds: allCategoryIds,
				},
			});

			console.log(
				`✅ Updated ${projectIds.length} projects with ${allCategoryIds.length} categories`,
			);
		}

		// Display summary
		const activeCategories = categoryData.filter((c) => c.isActive).length;
		const withDescription = categoryData.filter((c) => c.description).length;
		const withColor = categoryData.filter((c) => c.color).length;

		console.log("\n📊 Category Summary:");
		console.log(`   ✅ Active Categories: ${activeCategories}`);
		console.log(`   📝 With Description: ${withDescription}`);
		console.log(`   🎨 With Color: ${withColor}`);
		console.log(`   🔗 Assigned to Projects: ${projectIds.length}`);
		console.log(`\n   📈 Total Categories: ${categoryData.length}`);

		console.log("\n🎉 Category seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during category seeding:", error);
		throw error;
	}
}
