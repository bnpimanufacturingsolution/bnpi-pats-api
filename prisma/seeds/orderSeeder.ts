import { PrismaClient, ItemCondition, OrderStatus } from "../../generated/prisma";

export async function seedOrder(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting order seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		// Get existing estimations and vendors to create relationships
		const estimations = await prisma.estimation.findMany({ take: 15 });
		const vendors = await prisma.vendor.findMany({ take: 10 });

		if (estimations.length === 0) {
			console.log("⚠️  No estimations found. Please seed estimations first.");
			return;
		}

		if (vendors.length === 0) {
			console.log("⚠️  No vendors found. Please seed vendors first.");
			return;
		}

		// Clear existing orders
		console.log("🗑️  Clearing existing orders...");
		await prisma.order.deleteMany({});
		console.log("   ✓ Orders deleted");

		const orderData = [
			// Hardware Orders
			{
				id: "607f1f77bcf86cd799439011",
				orderNumber: "OR-2025-001",
				estimationId: estimations[0].id,
				vendorId: vendors[0].id,
				itemName: "Dell Latitude 7430 Laptop",
				quantity: 5,
				deliveryDate: new Date("2025-02-15"),
				receivedBy: "John Smith",
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "3-year manufacturer warranty, covering hardware defects",
				status: OrderStatus.RECEIVED,
				remarks: "Delivered on time, all units tested and working",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439012",
				orderNumber: "OR-2025-002",
				estimationId: estimations[0].id,
				vendorId: vendors[1].id,
				itemName: "HP ProBook 450 G9 Laptop",
				quantity: 10,
				deliveryDate: new Date("2025-02-20"),
				receivedBy: null,
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "2-year warranty with on-site support",
				status: OrderStatus.PENDING,
				remarks: "Awaiting delivery confirmation",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439013",
				orderNumber: "OR-2025-003",
				estimationId: estimations[1]?.id || estimations[0].id,
				vendorId: vendors[0].id,
				itemName: "Dell UltraSharp 27\" Monitor",
				quantity: 15,
				deliveryDate: new Date("2025-01-25"),
				receivedBy: "Sarah Johnson",
				condition: ItemCondition.DAMAGED,
				hasWarranty: true,
				warrantyDetails: "3-year warranty",
				status: OrderStatus.PARTIAL,
				remarks: "3 units damaged during shipping, replacement requested",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439014",
				orderNumber: "OR-2025-004",
				estimationId: estimations[1]?.id || estimations[0].id,
				vendorId: vendors[2]?.id || vendors[0].id,
				itemName: "Logitech MX Master 3S Mouse",
				quantity: 20,
				deliveryDate: new Date("2025-01-30"),
				receivedBy: "Mike Chen",
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "1-year limited warranty",
				status: OrderStatus.RECEIVED,
				remarks: "All units in perfect condition",
				isDeleted: false,
			},

			// Software Licenses
			{
				id: "607f1f77bcf86cd799439015",
				orderNumber: "OR-2025-005",
				estimationId: estimations[2]?.id || estimations[0].id,
				vendorId: vendors[1].id,
				itemName: "Microsoft Office 365 Business Premium",
				quantity: 50,
				deliveryDate: new Date("2025-02-01"),
				receivedBy: "IT Admin",
				condition: ItemCondition.LICENSE,
				hasWarranty: false,
				warrantyDetails: null,
				status: OrderStatus.RECEIVED,
				remarks: "License keys activated successfully",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439016",
				orderNumber: "OR-2025-006",
				estimationId: estimations[2]?.id || estimations[0].id,
				vendorId: vendors[2]?.id || vendors[0].id,
				itemName: "Adobe Creative Cloud Team License",
				quantity: 25,
				deliveryDate: new Date("2025-02-10"),
				receivedBy: null,
				condition: ItemCondition.LICENSE,
				hasWarranty: false,
				warrantyDetails: null,
				status: OrderStatus.PENDING,
				remarks: "Awaiting license provisioning from vendor",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439017",
				orderNumber: "OR-2025-007",
				estimationId: estimations[3]?.id || estimations[0].id,
				vendorId: vendors[1].id,
				itemName: "Zoom Business License",
				quantity: 100,
				deliveryDate: new Date("2025-01-15"),
				receivedBy: "Emily Davis",
				condition: ItemCondition.LICENSE,
				hasWarranty: false,
				warrantyDetails: null,
				status: OrderStatus.RECEIVED,
				remarks: "Annual subscription activated",
				isDeleted: false,
			},

			// Network Equipment
			{
				id: "607f1f77bcf86cd799439018",
				orderNumber: "OR-2025-008",
				estimationId: estimations[3]?.id || estimations[0].id,
				vendorId: vendors[0].id,
				itemName: "Cisco Catalyst 2960-X Switch",
				quantity: 3,
				deliveryDate: new Date("2025-02-28"),
				receivedBy: null,
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "5-year warranty with Cisco SmartNet support",
				status: OrderStatus.PENDING,
				remarks: "Order placed, ETA 4 weeks",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439019",
				orderNumber: "OR-2025-009",
				estimationId: estimations[4]?.id || estimations[0].id,
				vendorId: vendors[3]?.id || vendors[0].id,
				itemName: "Ubiquiti UniFi 6 Access Point",
				quantity: 12,
				deliveryDate: new Date("2025-01-20"),
				receivedBy: "Network Team",
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "2-year manufacturer warranty",
				status: OrderStatus.RECEIVED,
				remarks: "Installation scheduled for next week",
				isDeleted: false,
			},

			// Office Furniture
			{
				id: "607f1f77bcf86cd799439020",
				orderNumber: "OR-2025-010",
				estimationId: estimations[4]?.id || estimations[0].id,
				vendorId: vendors[4]?.id || vendors[0].id,
				itemName: "Herman Miller Aeron Chair",
				quantity: 8,
				deliveryDate: new Date("2025-03-05"),
				receivedBy: null,
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "12-year manufacturer warranty",
				status: OrderStatus.PENDING,
				remarks: "Custom order, extended lead time",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439021",
				orderNumber: "OR-2025-011",
				estimationId: estimations[5]?.id || estimations[0].id,
				vendorId: vendors[4]?.id || vendors[0].id,
				itemName: "Standing Desk - Electric Adjustable",
				quantity: 15,
				deliveryDate: new Date("2025-02-05"),
				receivedBy: "Facilities Manager",
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "5-year warranty on motor, 2-year on frame",
				status: OrderStatus.RECEIVED,
				remarks: "Assembly completed, ready for use",
				isDeleted: false,
			},

			// Server Equipment
			{
				id: "607f1f77bcf86cd799439022",
				orderNumber: "OR-2025-012",
				estimationId: estimations[5]?.id || estimations[0].id,
				vendorId: vendors[0].id,
				itemName: "Dell PowerEdge R750 Server",
				quantity: 2,
				deliveryDate: new Date("2025-03-15"),
				receivedBy: null,
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "3-year ProSupport with 4-hour response",
				status: OrderStatus.PENDING,
				remarks: "Custom configuration, extended delivery time",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439023",
				orderNumber: "OR-2025-013",
				estimationId: estimations[6]?.id || estimations[0].id,
				vendorId: vendors[1].id,
				itemName: "Synology DS1522+ NAS",
				quantity: 4,
				deliveryDate: new Date("2025-02-12"),
				receivedBy: "David Wilson",
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "2-year warranty",
				status: OrderStatus.RECEIVED,
				remarks: "Configured and deployed successfully",
				isDeleted: false,
			},

			// Peripherals
			{
				id: "607f1f77bcf86cd799439024",
				orderNumber: "OR-2025-014",
				estimationId: estimations[6]?.id || estimations[0].id,
				vendorId: vendors[2]?.id || vendors[0].id,
				itemName: "Logitech C920 HD Webcam",
				quantity: 30,
				deliveryDate: new Date("2025-01-28"),
				receivedBy: "Amanda Lee",
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "2-year limited warranty",
				status: OrderStatus.RECEIVED,
				remarks: "Distributed to remote workers",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439025",
				orderNumber: "OR-2025-015",
				estimationId: estimations[7]?.id || estimations[0].id,
				vendorId: vendors[3]?.id || vendors[0].id,
				itemName: "Blue Yeti USB Microphone",
				quantity: 20,
				deliveryDate: new Date("2025-02-08"),
				receivedBy: null,
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "2-year warranty",
				status: OrderStatus.PENDING,
				remarks: "For podcast studio setup",
				isDeleted: false,
			},

			// Cancelled Orders
			{
				id: "607f1f77bcf86cd799439026",
				orderNumber: "OR-2025-016",
				estimationId: estimations[7]?.id || estimations[0].id,
				vendorId: vendors[4]?.id || vendors[0].id,
				itemName: "Apple MacBook Pro 14\" M3",
				quantity: 12,
				deliveryDate: null,
				receivedBy: null,
				condition: ItemCondition.NA,
				hasWarranty: false,
				warrantyDetails: null,
				status: OrderStatus.CANCELLED,
				remarks: "Budget constraints, order cancelled",
				isDeleted: false,
			},

			// Consumables
			{
				id: "607f1f77bcf86cd799439027",
				orderNumber: "OR-2025-017",
				estimationId: estimations[8]?.id || estimations[0].id,
				vendorId: vendors[5]?.id || vendors[0].id,
				itemName: "HP 410X High Yield Toner Cartridge",
				quantity: 50,
				deliveryDate: new Date("2025-01-22"),
				receivedBy: "Office Manager",
				condition: ItemCondition.GOOD,
				hasWarranty: false,
				warrantyDetails: null,
				status: OrderStatus.RECEIVED,
				remarks: "Stock replenishment for Q1",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439028",
				orderNumber: "OR-2025-018",
				estimationId: estimations[8]?.id || estimations[0].id,
				vendorId: vendors[5]?.id || vendors[0].id,
				itemName: "USB-C to HDMI Cable 6ft",
				quantity: 40,
				deliveryDate: new Date("2025-02-03"),
				receivedBy: "IT Support",
				condition: ItemCondition.GOOD,
				hasWarranty: false,
				warrantyDetails: null,
				status: OrderStatus.RECEIVED,
				remarks: "Conference room equipment upgrade",
				isDeleted: false,
			},

			// Security Equipment
			{
				id: "607f1f77bcf86cd799439029",
				orderNumber: "OR-2025-019",
				estimationId: estimations[9]?.id || estimations[0].id,
				vendorId: vendors[6]?.id || vendors[0].id,
				itemName: "YubiKey 5 NFC Security Key",
				quantity: 100,
				deliveryDate: new Date("2025-02-25"),
				receivedBy: null,
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "2-year warranty",
				status: OrderStatus.PENDING,
				remarks: "Company-wide 2FA rollout",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439030",
				orderNumber: "OR-2025-020",
				estimationId: estimations[9]?.id || estimations[0].id,
				vendorId: vendors[6]?.id || vendors[0].id,
				itemName: "Fortinet FortiGate 100F Firewall",
				quantity: 1,
				deliveryDate: new Date("2025-01-18"),
				receivedBy: "Security Team",
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "3-year FortiCare support",
				status: OrderStatus.RECEIVED,
				remarks: "Deployed to production network",
				isDeleted: false,
			},

			// Mobile Devices
			{
				id: "607f1f77bcf86cd799439031",
				orderNumber: "OR-2025-021",
				estimationId: estimations[0].id,
				vendorId: vendors[7]?.id || vendors[0].id,
				itemName: "Samsung Galaxy Tab S9",
				quantity: 25,
				deliveryDate: new Date("2025-03-01"),
				receivedBy: null,
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "1-year manufacturer warranty + Samsung Care+",
				status: OrderStatus.PENDING,
				remarks: "For field operations team",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439032",
				orderNumber: "OR-2025-022",
				estimationId: estimations[1]?.id || estimations[0].id,
				vendorId: vendors[7]?.id || vendors[0].id,
				itemName: "iPhone 15 Pro 256GB",
				quantity: 10,
				deliveryDate: new Date("2025-02-18"),
				receivedBy: "Laura Martinez",
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "1-year AppleCare+ warranty",
				status: OrderStatus.RECEIVED,
				remarks: "Issued to executive team",
				isDeleted: false,
			},

			// Printing Equipment
			{
				id: "607f1f77bcf86cd799439033",
				orderNumber: "OR-2025-023",
				estimationId: estimations[2]?.id || estimations[0].id,
				vendorId: vendors[8]?.id || vendors[0].id,
				itemName: "HP LaserJet Enterprise M507dn",
				quantity: 5,
				deliveryDate: new Date("2025-02-14"),
				receivedBy: "Office Admin",
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "3-year warranty with next-business-day support",
				status: OrderStatus.RECEIVED,
				remarks: "Installed in all department areas",
				isDeleted: false,
			},

			// Audio/Visual Equipment
			{
				id: "607f1f77bcf86cd799439034",
				orderNumber: "OR-2025-024",
				estimationId: estimations[3]?.id || estimations[0].id,
				vendorId: vendors[9]?.id || vendors[0].id,
				itemName: "Poly Studio X50 Video Bar",
				quantity: 6,
				deliveryDate: new Date("2025-03-10"),
				receivedBy: null,
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "3-year warranty",
				status: OrderStatus.PENDING,
				remarks: "Conference room AV upgrade project",
				isDeleted: false,
			},
			{
				id: "607f1f77bcf86cd799439035",
				orderNumber: "OR-2025-025",
				estimationId: estimations[4]?.id || estimations[0].id,
				vendorId: vendors[9]?.id || vendors[0].id,
				itemName: "Sony 75\" 4K Display",
				quantity: 3,
				deliveryDate: new Date("2025-01-29"),
				receivedBy: "AV Team",
				condition: ItemCondition.GOOD,
				hasWarranty: true,
				warrantyDetails: "2-year commercial warranty",
				status: OrderStatus.RECEIVED,
				remarks: "Mounted in main conference rooms",
				isDeleted: false,
			},
		];

		// Create orders
		console.log("📝 Creating order records...");
		await prisma.order.createMany({
			data: orderData.map((o, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...o, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${orderData.length} order records`);

		// Display summary by status
		const pendingCount = orderData.filter((o) => o.status === OrderStatus.PENDING).length;
		const receivedCount = orderData.filter((o) => o.status === OrderStatus.RECEIVED).length;
		const cancelledCount = orderData.filter((o) => o.status === OrderStatus.CANCELLED).length;
		const partialCount = orderData.filter((o) => o.status === OrderStatus.PARTIAL).length;

		// Display summary by condition
		const goodCondition = orderData.filter((o) => o.condition === ItemCondition.GOOD).length;
		const damagedCondition = orderData.filter(
			(o) => o.condition === ItemCondition.DAMAGED,
		).length;
		const licenseCondition = orderData.filter(
			(o) => o.condition === ItemCondition.LICENSE,
		).length;
		const naCondition = orderData.filter((o) => o.condition === ItemCondition.NA).length;

		console.log("\n📊 Order Summary:");
		console.log(`   Status Breakdown:`);
		console.log(`   ⏳ Pending: ${pendingCount}`);
		console.log(`   ✅ Received: ${receivedCount}`);
		console.log(`   ❌ Cancelled: ${cancelledCount}`);
		console.log(`   📦 Partial: ${partialCount}`);
		console.log(`\n   Condition Breakdown:`);
		console.log(`   🟢 Good: ${goodCondition}`);
		console.log(`   🔴 Damaged: ${damagedCondition}`);
		console.log(`   🔑 License: ${licenseCondition}`);
		console.log(`   ⚪ N/A: ${naCondition}`);
		console.log(`\n   📈 Total Orders: ${orderData.length}`);

		console.log("\n🎉 Order seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during order seeding:", error);
		throw error;
	}
}
