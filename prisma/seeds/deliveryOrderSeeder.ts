import { PrismaClient, DeliveryOrderStatus, DeliveryItemCondition } from "../../generated/prisma";

export async function seedDeliveryOrder(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting delivery order seeding...");

	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		// Get existing purchase orders and vendors
		const purchaseOrders = await prisma.purchaseOrder.findMany({ take: 10 });
		const vendors = await prisma.vendor.findMany({ take: 10 });

		if (purchaseOrders.length === 0) {
			console.log("⚠️  No purchase orders found. Please seed purchase orders first.");
			return;
		}

		if (vendors.length === 0) {
			console.log("⚠️  No vendors found. Please seed vendors first.");
			return;
		}

		// Clear existing delivery orders
		console.log("🗑️  Clearing existing delivery orders...");
		await prisma.deliveryOrder.deleteMany({});
		console.log("   ✓ Delivery orders deleted");

		const deliveryOrderData = [
			{
				id: "807f1f77bcf86cd799439201",
				doNumber: "DO-2025-001",
				purchaseOrderId: purchaseOrders[0].id,
				vendorId: purchaseOrders[0].vendorId,
				deliveryDate: new Date("2025-02-15"),
				receivedDate: new Date("2025-02-15"),
				dispatchDate: new Date("2025-02-14"),
				deliveryAddress: "123 Main St, Makati City, Metro Manila",
				trackingNumber: "LBC-2025-001234",
				carrier: "LBC Express",
				receivedBy: "John Smith",
				receiverContact: "+63-917-123-4567",
				receiverSignature: null,
				items: [
					{
						poItemIndex: 0,
						description: "Dell Latitude 7430 Laptop",
						orderedQuantity: 10,
						deliveredQuantity: 10,
						receivedQuantity: 10,
						condition: DeliveryItemCondition.GOOD,
						remarks: "All units working perfectly"
					},
					{
						poItemIndex: 1,
						description: "Dell 27\" Monitor",
						orderedQuantity: 10,
						deliveredQuantity: 10,
						receivedQuantity: 10,
						condition: DeliveryItemCondition.GOOD,
						remarks: "No dead pixels"
					}
				],
				inspectedBy: "IT Quality Team",
				inspectionDate: new Date("2025-02-15"),
				inspectionNotes: "All items tested and verified working",
				status: DeliveryOrderStatus.DELIVERED,
				remarks: "Complete delivery, no issues",
				isDeleted: false,
			},
			{
				id: "807f1f77bcf86cd799439202",
				doNumber: "DO-2025-002",
				purchaseOrderId: purchaseOrders[2]?.id || purchaseOrders[0].id,
				vendorId: purchaseOrders[2]?.vendorId || vendors[0].id,
				deliveryDate: new Date("2025-01-25"),
				receivedDate: new Date("2025-01-25"),
				dispatchDate: new Date("2025-01-24"),
				deliveryAddress: "456 Tech Park, BGC, Taguig",
				trackingNumber: "JNT-2025-005678",
				carrier: "J&T Express",
				receivedBy: "Sarah Johnson",
				receiverContact: "+63-918-234-5678",
				receiverSignature: null,
				items: [
					{
						poItemIndex: 0,
						description: "Cisco Catalyst 2960-X Switch",
						orderedQuantity: 3,
						deliveredQuantity: 3,
						receivedQuantity: 3,
						condition: DeliveryItemCondition.GOOD,
						remarks: null
					},
					{
						poItemIndex: 1,
						description: "Cat6 Network Cable (305m box)",
						orderedQuantity: 5,
						deliveredQuantity: 5,
						receivedQuantity: 5,
						condition: DeliveryItemCondition.GOOD,
						remarks: null
					}
				],
				inspectedBy: "Network Team",
				inspectionDate: new Date("2025-01-25"),
				inspectionNotes: "Switches tested, all ports working",
				status: DeliveryOrderStatus.DELIVERED,
				remarks: "Full delivery completed",
				isDeleted: false,
			},
			{
				id: "807f1f77bcf86cd799439203",
				doNumber: "DO-2025-003",
				purchaseOrderId: purchaseOrders[4]?.id || purchaseOrders[0].id,
				vendorId: purchaseOrders[4]?.vendorId || vendors[0].id,
				deliveryDate: new Date("2025-02-08"),
				receivedDate: new Date("2025-02-08"),
				dispatchDate: new Date("2025-02-07"),
				deliveryAddress: "Data Center, 321 Server St, Makati",
				trackingNumber: "FEDEX-2025-789012",
				carrier: "FedEx",
				receivedBy: "David Wilson",
				receiverContact: "+63-919-345-6789",
				receiverSignature: null,
				items: [
					{
						poItemIndex: 0,
						description: "Dell PowerEdge R750 Server",
						orderedQuantity: 2,
						deliveredQuantity: 2,
						receivedQuantity: 2,
						condition: DeliveryItemCondition.GOOD,
						remarks: "Servers delivered with all accessories"
					}
				],
				inspectedBy: "Data Center Team",
				inspectionDate: new Date("2025-02-08"),
				inspectionNotes: "Servers rack-mounted and powered on successfully",
				status: DeliveryOrderStatus.DELIVERED,
				remarks: "Partial delivery - RAM modules pending",
				isDeleted: false,
			},
			{
				id: "807f1f77bcf86cd799439204",
				doNumber: "DO-2025-004",
				purchaseOrderId: purchaseOrders[5]?.id || purchaseOrders[0].id,
				vendorId: purchaseOrders[5]?.vendorId || vendors[0].id,
				deliveryDate: new Date("2025-01-15"),
				receivedDate: new Date("2025-01-15"),
				dispatchDate: new Date("2025-01-14"),
				deliveryAddress: "Office Supplies Room, Ground Floor",
				trackingNumber: "GRAB-2025-111213",
				carrier: "Grab Express",
				receivedBy: "Admin Staff",
				receiverContact: "+63-920-456-7890",
				receiverSignature: null,
				items: [
					{
						poItemIndex: 0,
						description: "A4 Copy Paper (5 reams/box)",
						orderedQuantity: 50,
						deliveredQuantity: 50,
						receivedQuantity: 50,
						condition: DeliveryItemCondition.GOOD,
						remarks: null
					},
					{
						poItemIndex: 1,
						description: "Ballpoint Pens (box of 12)",
						orderedQuantity: 20,
						deliveredQuantity: 20,
						receivedQuantity: 20,
						condition: DeliveryItemCondition.GOOD,
						remarks: null
					}
				],
				inspectedBy: "Admin Officer",
				inspectionDate: new Date("2025-01-15"),
				inspectionNotes: "All supplies counted and stored",
				status: DeliveryOrderStatus.DELIVERED,
				remarks: "Regular monthly delivery",
				isDeleted: false,
			},
			{
				id: "807f1f77bcf86cd799439205",
				doNumber: "DO-2025-005",
				purchaseOrderId: purchaseOrders[3]?.id || purchaseOrders[0].id,
				vendorId: purchaseOrders[3]?.vendorId || vendors[0].id,
				deliveryDate: new Date("2025-03-10"),
				receivedDate: null,
				dispatchDate: new Date("2025-03-08"),
				deliveryAddress: "789 Corporate Tower, Ortigas Center",
				trackingNumber: "DHL-2025-141516",
				carrier: "DHL",
				receivedBy: null,
				receiverContact: null,
				receiverSignature: null,
				items: [
					{
						poItemIndex: 0,
						description: "Herman Miller Aeron Chair",
						orderedQuantity: 20,
						deliveredQuantity: 20,
						receivedQuantity: 0,
						condition: DeliveryItemCondition.GOOD,
						remarks: "Scheduled for delivery"
					}
				],
				inspectedBy: null,
				inspectionDate: null,
				inspectionNotes: null,
				status: DeliveryOrderStatus.IN_TRANSIT,
				remarks: "Out for delivery",
				isDeleted: false,
			},
			{
				id: "807f1f77bcf86cd799439206",
				doNumber: "DO-2025-006",
				purchaseOrderId: purchaseOrders[8]?.id || purchaseOrders[0].id,
				vendorId: purchaseOrders[8]?.vendorId || vendors[0].id,
				deliveryDate: new Date("2025-03-05"),
				receivedDate: null,
				dispatchDate: null,
				deliveryAddress: "All conference rooms",
				trackingNumber: null,
				carrier: null,
				receivedBy: null,
				receiverContact: null,
				receiverSignature: null,
				items: [
					{
						poItemIndex: 0,
						description: "Poly Studio X50 Video Bar",
						orderedQuantity: 6,
						deliveredQuantity: 0,
						receivedQuantity: 0,
						condition: DeliveryItemCondition.GOOD,
						remarks: "Pending shipment"
					},
					{
						poItemIndex: 1,
						description: "Sony 75\" 4K Display",
						orderedQuantity: 6,
						deliveredQuantity: 0,
						receivedQuantity: 0,
						condition: DeliveryItemCondition.GOOD,
						remarks: "Pending shipment"
					}
				],
				inspectedBy: null,
				inspectionDate: null,
				inspectionNotes: null,
				status: DeliveryOrderStatus.PENDING,
				remarks: "Awaiting vendor dispatch",
				isDeleted: false,
			},
			{
				id: "807f1f77bcf86cd799439207",
				doNumber: "DO-2025-007",
				purchaseOrderId: purchaseOrders[0].id,
				vendorId: purchaseOrders[0].vendorId,
				deliveryDate: new Date("2025-02-10"),
				receivedDate: new Date("2025-02-10"),
				dispatchDate: new Date("2025-02-09"),
				deliveryAddress: "123 Main St, Makati City, Metro Manila",
				trackingNumber: "LBC-2025-171819",
				carrier: "LBC Express",
				receivedBy: "Mike Chen",
				receiverContact: "+63-921-567-8901",
				receiverSignature: null,
				items: [
					{
						poItemIndex: 0,
						description: "Dell Latitude 7430 Laptop",
						orderedQuantity: 5,
						deliveredQuantity: 5,
						receivedQuantity: 4,
						condition: DeliveryItemCondition.DAMAGED,
						remarks: "1 unit has cracked screen"
					}
				],
				inspectedBy: "IT Quality Team",
				inspectionDate: new Date("2025-02-10"),
				inspectionNotes: "1 unit damaged during shipping, RMA requested",
				status: DeliveryOrderStatus.PARTIAL,
				remarks: "Damaged unit being returned to vendor",
				isDeleted: false,
			},
			{
				id: "807f1f77bcf86cd799439208",
				doNumber: "DO-2025-008",
				purchaseOrderId: purchaseOrders[9]?.id || purchaseOrders[0].id,
				vendorId: purchaseOrders[9]?.vendorId || vendors[0].id,
				deliveryDate: new Date("2025-02-25"),
				receivedDate: new Date("2025-02-25"),
				dispatchDate: new Date("2025-02-24"),
				deliveryAddress: "Various departments",
				trackingNumber: "NINJA-2025-202122",
				carrier: "Ninja Van",
				receivedBy: "HR Coordinator",
				receiverContact: "+63-922-678-9012",
				receiverSignature: null,
				items: [
					{
						poItemIndex: 0,
						description: "Standing Desk - Electric",
						orderedQuantity: 15,
						deliveredQuantity: 15,
						receivedQuantity: 15,
						condition: DeliveryItemCondition.GOOD,
						remarks: "Assembly completed"
					},
					{
						poItemIndex: 1,
						description: "Ergonomic Keyboard",
						orderedQuantity: 15,
						deliveredQuantity: 15,
						receivedQuantity: 15,
						condition: DeliveryItemCondition.GOOD,
						remarks: null
					},
					{
						poItemIndex: 2,
						description: "Ergonomic Mouse",
						orderedQuantity: 15,
						deliveredQuantity: 15,
						receivedQuantity: 15,
						condition: DeliveryItemCondition.GOOD,
						remarks: null
					}
				],
				inspectedBy: "Facilities Team",
				inspectionDate: new Date("2025-02-25"),
				inspectionNotes: "All desks assembled and tested",
				status: DeliveryOrderStatus.DELIVERED,
				remarks: "Ergonomic equipment deployment complete",
				isDeleted: false,
			},
			{
				id: "807f1f77bcf86cd799439209",
				doNumber: "DO-2025-009",
				purchaseOrderId: purchaseOrders[1]?.id || purchaseOrders[0].id,
				vendorId: purchaseOrders[1]?.vendorId || vendors[0].id,
				deliveryDate: new Date("2025-02-20"),
				receivedDate: new Date("2025-02-20"),
				dispatchDate: new Date("2025-02-20"),
				deliveryAddress: "IT Department - License activation",
				trackingNumber: "EMAIL-DELIVERY",
				carrier: "Electronic Delivery",
				receivedBy: "IT Admin",
				receiverContact: "it-admin@company.com",
				receiverSignature: null,
				items: [
					{
						poItemIndex: 0,
						description: "Microsoft Office 365 Business Premium",
						orderedQuantity: 50,
						deliveredQuantity: 50,
						receivedQuantity: 50,
						condition: DeliveryItemCondition.GOOD,
						remarks: "License keys received via email"
					}
				],
				inspectedBy: "IT Admin",
				inspectionDate: new Date("2025-02-20"),
				inspectionNotes: "All license keys validated and activated",
				status: DeliveryOrderStatus.DELIVERED,
				remarks: "Software licenses delivered electronically",
				isDeleted: false,
			},
			{
				id: "807f1f77bcf86cd799439210",
				doNumber: "DO-2025-010",
				purchaseOrderId: purchaseOrders[4]?.id || purchaseOrders[0].id,
				vendorId: purchaseOrders[4]?.vendorId || vendors[0].id,
				deliveryDate: new Date("2025-02-20"),
				receivedDate: null,
				dispatchDate: new Date("2025-02-18"),
				deliveryAddress: "Data Center, 321 Server St, Makati",
				trackingNumber: "FEDEX-2025-232425",
				carrier: "FedEx",
				receivedBy: null,
				receiverContact: null,
				receiverSignature: null,
				items: [
					{
						poItemIndex: 1,
						description: "32GB DDR4 ECC RAM",
						orderedQuantity: 8,
						deliveredQuantity: 8,
						receivedQuantity: 0,
						condition: DeliveryItemCondition.GOOD,
						remarks: "RAM modules for servers"
					}
				],
				inspectedBy: null,
				inspectionDate: null,
				inspectionNotes: null,
				status: DeliveryOrderStatus.REJECTED,
				remarks: "Wrong specification delivered - returning to vendor",
				isDeleted: false,
			},
		];

		// Create delivery orders
		console.log("📝 Creating delivery order records...");
		await prisma.deliveryOrder.createMany({
			data: deliveryOrderData.map((dob, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...dob, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${deliveryOrderData.length} delivery order records`);

		// Display summary
		const pendingCount = deliveryOrderData.filter(d => d.status === DeliveryOrderStatus.PENDING).length;
		const inTransitCount = deliveryOrderData.filter(d => d.status === DeliveryOrderStatus.IN_TRANSIT).length;
		const deliveredCount = deliveryOrderData.filter(d => d.status === DeliveryOrderStatus.DELIVERED).length;
		const partialCount = deliveryOrderData.filter(d => d.status === DeliveryOrderStatus.PARTIAL).length;
		const rejectedCount = deliveryOrderData.filter(d => d.status === DeliveryOrderStatus.REJECTED).length;

		console.log("\n📊 Delivery Order Summary:");
		console.log(`   ⏳ Pending: ${pendingCount}`);
		console.log(`   🚚 In Transit: ${inTransitCount}`);
		console.log(`   ✅ Delivered: ${deliveredCount}`);
		console.log(`   📦 Partial: ${partialCount}`);
		console.log(`   ❌ Rejected: ${rejectedCount}`);
		console.log(`\n   📈 Total Delivery Orders: ${deliveryOrderData.length}`);

		console.log("\n🎉 Delivery order seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during delivery order seeding:", error);
		throw error;
	}
}
