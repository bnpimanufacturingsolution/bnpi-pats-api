import { PrismaClient, ItemTypeStatus } from "../../generated/prisma";

export async function seedItemType(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting itemType seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	const itemTypeData = [
		// Financial/Budget Types (for breakdown)
		{
			id: "608f1f77bcf86cd799450001",
			name: "CAPEX",
			description: "Capital Expenditure - Long-term investments and assets",
			icon: "capex",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450002",
			name: "OPEX",
			description: "Operating Expenditure - Day-to-day operational costs",
			icon: "opex",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450003",
			name: "MISC",
			description: "Miscellaneous - Other expenses not categorized as CAPEX or OPEX",
			icon: "misc",
			status: ItemTypeStatus.ACTIVE,
		},
		// Work Item Types
		{
			id: "608f1f77bcf86cd799450004",
			name: "Task",
			description: "Standard task item for project activities",
			icon: "task",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450005",
			name: "Bug",
			description: "Bug or issue tracking item",
			icon: "bug",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450006",
			name: "Feature",
			description: "New feature development item",
			icon: "feature",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450007",
			name: "Epic",
			description: "Large body of work that can be broken down into smaller tasks",
			icon: "epic",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450008",
			name: "Story",
			description: "User story item for agile development",
			icon: "story",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450009",
			name: "Sub-task",
			description: "Sub-task or child task item",
			icon: "subtask",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450010",
			name: "Milestone",
			description: "Project milestone or checkpoint",
			icon: "milestone",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450011",
			name: "Incident",
			description: "Incident or critical issue requiring immediate attention",
			icon: "incident",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450012",
			name: "Change Request",
			description: "Request for change in project scope or requirements",
			icon: "change",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450013",
			name: "Risk",
			description: "Risk assessment and tracking item",
			icon: "risk",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450014",
			name: "Deliverable",
			description: "Project deliverable item",
			icon: "deliverable",
			status: ItemTypeStatus.ACTIVE,
		},
		{
			id: "608f1f77bcf86cd799450015",
			name: "Test Case",
			description: "Test case or quality assurance item",
			icon: "test",
			status: ItemTypeStatus.INACTIVE,
		},
	];

	try {
		// Clear existing itemTypes
		console.log("🗑️  Clearing existing itemTypes...");
		await prisma.itemType.deleteMany({});
		console.log("   ✓ ItemTypes deleted");

		// Create itemTypes using createMany for better performance
		console.log("📝 Creating itemType records...");
		await prisma.itemType.createMany({
			data: itemTypeData.map((i, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...i, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${itemTypeData.length} itemType records`);

		// Display summary
		const activeItemTypes = itemTypeData.filter(
			(it) => it.status === ItemTypeStatus.ACTIVE,
		).length;
		const inactiveItemTypes = itemTypeData.filter(
			(it) => it.status === ItemTypeStatus.INACTIVE,
		).length;

		console.log("\n📊 ItemType Summary:");
		console.log(`   🟢 Active ItemTypes: ${activeItemTypes}`);
		console.log(`   🔴 Inactive ItemTypes: ${inactiveItemTypes}`);
		console.log(`\n   📈 Total ItemTypes: ${itemTypeData.length}`);

		console.log("\n🎉 ItemType seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during itemType seeding:", error);
		throw error;
	}
}
