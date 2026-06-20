import { PrismaClient, POTypeStatus } from "../../generated/prisma";

export async function seedPOType(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting PO type seeding...");

	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		// Clear existing PO types
		console.log("🗑️  Clearing existing PO types...");
		await prisma.pOType.deleteMany({});
		console.log("   ✓ PO types deleted");

		const poTypeData = [
			{
				id: "b07f1f77bcf86cd799439501",
				code: "S",
				name: "Service",
				description: "Service-based purchase orders for professional services, consulting, and labor",
				isDefault: false,
				requiresDelivery: false,
				requiresInspection: false,
				allowsPartialDelivery: false,
				autoCreateInvoice: true,
				invoiceTrigger: "ON_COMPLETION",
				status: POTypeStatus.ACTIVE,
				isDeleted: false,
			},
			{
				id: "b07f1f77bcf86cd799439502",
				code: "P",
				name: "Product",
				description: "Product-based purchase orders for physical goods, materials, and equipment",
				isDefault: true,
				requiresDelivery: true,
				requiresInspection: true,
				allowsPartialDelivery: true,
				autoCreateInvoice: false,
				invoiceTrigger: "ON_DELIVERY",
				status: POTypeStatus.ACTIVE,
				isDeleted: false,
			},
			{
				id: "b07f1f77bcf86cd799439503",
				code: "M",
				name: "Mixed",
				description: "Mixed purchase orders combining both services and products",
				isDefault: false,
				requiresDelivery: true,
				requiresInspection: true,
				allowsPartialDelivery: true,
				autoCreateInvoice: false,
				invoiceTrigger: "ON_COMPLETION",
				status: POTypeStatus.ACTIVE,
				isDeleted: false,
			},
			{
				id: "b07f1f77bcf86cd799439504",
				code: "C",
				name: "Consumables",
				description: "Purchase orders for consumable items like office supplies and maintenance materials",
				isDefault: false,
				requiresDelivery: true,
				requiresInspection: false,
				allowsPartialDelivery: true,
				autoCreateInvoice: false,
				invoiceTrigger: "ON_DELIVERY",
				status: POTypeStatus.ACTIVE,
				isDeleted: false,
			},
			{
				id: "b07f1f77bcf86cd799439505",
				code: "E",
				name: "Equipment",
				description: "Purchase orders for capital equipment and machinery requiring inspection",
				isDefault: false,
				requiresDelivery: true,
				requiresInspection: true,
				allowsPartialDelivery: false,
				autoCreateInvoice: false,
				invoiceTrigger: "ON_DELIVERY",
				status: POTypeStatus.ACTIVE,
				isDeleted: false,
			},
			{
				id: "b07f1f77bcf86cd799439506",
				code: "R",
				name: "Recurring",
				description: "Recurring purchase orders for ongoing supplies or services",
				isDefault: false,
				requiresDelivery: true,
				requiresInspection: false,
				allowsPartialDelivery: true,
				autoCreateInvoice: true,
				invoiceTrigger: "ON_DELIVERY",
				status: POTypeStatus.ACTIVE,
				isDeleted: false,
			},
			{
				id: "b07f1f77bcf86cd799439507",
				code: "U",
				name: "Urgent",
				description: "Urgent purchase orders requiring expedited processing",
				isDefault: false,
				requiresDelivery: true,
				requiresInspection: false,
				allowsPartialDelivery: true,
				autoCreateInvoice: false,
				invoiceTrigger: "ON_DELIVERY",
				status: POTypeStatus.ACTIVE,
				isDeleted: false,
			},
			{
				id: "b07f1f77bcf86cd799439508",
				code: "SUB",
				name: "Subcontractor",
				description: "Purchase orders for subcontractor work and outsourced services",
				isDefault: false,
				requiresDelivery: false,
				requiresInspection: true,
				allowsPartialDelivery: true,
				autoCreateInvoice: true,
				invoiceTrigger: "ON_COMPLETION",
				status: POTypeStatus.ACTIVE,
				isDeleted: false,
			},
			{
				id: "b07f1f77bcf86cd799439509",
				code: "RNT",
				name: "Rental",
				description: "Purchase orders for equipment or facility rentals",
				isDefault: false,
				requiresDelivery: true,
				requiresInspection: true,
				allowsPartialDelivery: false,
				autoCreateInvoice: true,
				invoiceTrigger: "ON_APPROVAL",
				status: POTypeStatus.ACTIVE,
				isDeleted: false,
			},
			{
				id: "b07f1f77bcf86cd799439510",
				code: "LEGACY",
				name: "Legacy Type (Inactive)",
				description: "Old PO type no longer in use",
				isDefault: false,
				requiresDelivery: true,
				requiresInspection: false,
				allowsPartialDelivery: true,
				autoCreateInvoice: false,
				invoiceTrigger: null,
				status: POTypeStatus.INACTIVE,
				isDeleted: false,
			},
		];

		// Create PO types
		console.log("📝 Creating PO type records...");
		await prisma.pOType.createMany({
			data: poTypeData.map((pt, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...pt, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${poTypeData.length} PO type records`);

		// Display summary
		const activeCount = poTypeData.filter(pt => pt.status === POTypeStatus.ACTIVE).length;
		const inactiveCount = poTypeData.filter(pt => pt.status === POTypeStatus.INACTIVE).length;
		const serviceTypes = poTypeData.filter(pt => !pt.requiresDelivery).length;
		const productTypes = poTypeData.filter(pt => pt.requiresDelivery).length;
		const autoInvoiceCount = poTypeData.filter(pt => pt.autoCreateInvoice).length;
		const defaultCount = poTypeData.filter(pt => pt.isDefault).length;

		console.log("\n📊 PO Type Summary:");
		console.log(`   ✅ Active: ${activeCount}`);
		console.log(`   ⏸️  Inactive: ${inactiveCount}`);
		console.log(`   🔧 Service Types (no delivery): ${serviceTypes}`);
		console.log(`   📦 Product Types (with delivery): ${productTypes}`);
		console.log(`   📄 Auto Invoice Generation: ${autoInvoiceCount}`);
		console.log(`   ⭐ Default Types: ${defaultCount}`);
		console.log(`\n   📈 Total PO Types: ${poTypeData.length}`);

		console.log("\n🎉 PO type seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during PO type seeding:", error);
		throw error;
	}
}
