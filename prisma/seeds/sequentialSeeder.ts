import { PrismaClient } from "../../generated/prisma";

export async function seedSequential(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting sequential seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	const sequentialData = [
		{
			id: "680f1f77bcf86cd799439001",
			name: "Invoice Number",
			code: "INV",
			pattern: "INV-{YYYY}-{0000}",
			module: "transaction",
			current: 0,
			isDeleted: false,
		},
		{
			id: "680f1f77bcf86cd799439002",
			name: "Purchase Order Number",
			code: "PO",
			pattern: "PO-{YYYY}-{0000}",
			module: "order",
			current: 0,
			isDeleted: false,
		},
		{
			id: "680f1f77bcf86cd799439003",
			name: "Project Code",
			code: "PRJ",
			pattern: "PRJ-{NAME3}-{YYYY}-{000}",
			module: "project",
			current: 0,
			isDeleted: false,
		},
		{
			id: "680f1f77bcf86cd799439004",
			name: "Estimation Number",
			code: "EST",
			pattern: "EST-{YYYY}-{0000}",
			module: "estimation",
			current: 0,
			isDeleted: false,
		},
		{
			id: "680f1f77bcf86cd799439005",
			name: "Vendor ID",
			code: "VEN",
			pattern: "V{0000}",
			module: "vendor",
			current: 0,
			isDeleted: false,
		},
		{
			id: "680f1f77bcf86cd799439006",
			name: "Order Number",
			code: "ORD",
			pattern: "ORD-{YYYY}{MM}-{0000}",
			module: "order",
			current: 0,
			isDeleted: false,
		},
		{
			id: "680f1f77bcf86cd799439007",
			name: "Receipt Number",
			code: "REC",
			pattern: "REC-{YYYY}-{00000}",
			module: "transaction",
			current: 0,
			isDeleted: false,
		},
		{
			id: "680f1f77bcf86cd799439008",
			name: "Payslip Number",
			code: "PAY",
			pattern: "PAY-{YYYY}{MM}-{0000}",
			module: "payslip",
			current: 0,
			isDeleted: false,
		},
		{
			id: "680f1f77bcf86cd799439009",
			name: "Quotation Number",
			code: "QUO",
			pattern: "QUO-{YYYY}-{0000}",
			module: "quotation",
			current: 0,
			isDeleted: false,
		},
		{
			id: "680f1f77bcf86cd799439010",
			name: "Customer ID",
			code: "CUS",
			pattern: "CUS-{00000}",
			module: "customer",
			current: 0,
			isDeleted: false,
		},
	];

	try {
		// Clear existing sequentials
		console.log("🗑️  Clearing existing sequentials...");
		await prisma.sequential.deleteMany({});
		console.log("   ✓ Sequentials deleted");

		// Create all sequentials
		const result = await prisma.sequential.createMany({
			data: sequentialData.map((s, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...s, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully seeded ${result.count} sequentials`);
	} catch (error) {
		console.error("❌ Error seeding sequentials:", error);
		throw error;
	}
}

// For testing purposes, allow running this seeder standalone
if (require.main === module) {
	const standaloneClient = new PrismaClient();
	const DEFAULT_ORG_ID = "6944c22f1ba0ef821cb257d9";
	seedSequential(standaloneClient, DEFAULT_ORG_ID)
		.then(async () => {
			await standaloneClient.$disconnect();
			console.log("✅ Sequential seeding completed successfully");
			process.exit(0);
		})
		.catch(async (e) => {
			console.error("❌ Sequential seeding failed:", e);
			await standaloneClient.$disconnect();
			process.exit(1);
		});
}
