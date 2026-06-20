import { PrismaClient, PurchaseOrderStatus } from "../../generated/prisma";

export async function seedPurchaseOrder(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting purchase order seeding...");

	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		// Get existing vendors, estimations, projects, PO types, and payment terms
		const vendors = await prisma.vendor.findMany({ take: 10 });
		const estimations = await prisma.estimation.findMany({ take: 10 });
		const projects = await prisma.project.findMany({ take: 10 });
		const poTypes = await prisma.pOType.findMany({ take: 10 });
		const paymentTerms = await prisma.paymentTerm.findMany();

		if (vendors.length === 0) {
			console.log("⚠️  No vendors found. Please seed vendors first.");
			return;
		}

		// Get PO type IDs by code for easy reference
		const poTypeByCode: Record<string, string> = {};
		poTypes.forEach(pt => { poTypeByCode[pt.code] = pt.id; });

		// Get payment term IDs by code for easy reference
		const ptByCode: Record<string, string> = {};
		paymentTerms.forEach(pt => { ptByCode[pt.code] = pt.id; });

		// Clear existing purchase orders
		console.log("🗑️  Clearing existing purchase orders...");
		await prisma.purchaseOrder.deleteMany({});
		console.log("   ✓ Purchase orders deleted");

		const purchaseOrderData = [
			{
				id: "707f1f77bcf86cd799439101",
				poNumber: "PO-2025-001",
				vendorId: vendors[0].id,
				estimationId: estimations[0]?.id || null,
				projectId: projects[0]?.id || null,
				poTypeId: poTypeByCode["P"] || poTypes[0]?.id || null, // Product
				orderDate: new Date("2025-01-15"),
				expectedDeliveryDate: new Date("2025-02-15"),
				approvalDate: new Date("2025-01-16"),
				requestedBy: "John Smith",
				requestedByTitle: "IT Manager",
				requestedByDepartment: "Information Technology",
				checkedBy: "Alice Rivera",
				checkedByTitle: "Procurement Specialist",
				approvedBy: "Jane Doe",
				approvedByTitle: "VP of Operations",
				leadTime: "4-6 weeks",
				availability: "In Stock",
				deliveryTerms: "Door-to-door delivery with setup",
				items: [
					{
						itemCode: "DELL-L7430",
						description: "Dell Latitude 7430 Laptop",
						quantity: 10,
						unitPrice: 65000.00,
						totalPrice: 650000.00,
						unit: "unit",
						remarks: "For IT department"
					},
					{
						itemCode: "DELL-M27",
						description: "Dell 27\" Monitor",
						quantity: 10,
						unitPrice: 15000.00,
						totalPrice: 150000.00,
						unit: "unit",
						remarks: "To pair with laptops"
					}
				],
				subtotal: 800000.00,
				taxPercentage: 12,
				taxAmount: 96000.00,
				discountAmount: 0,
				totalAmount: 896000.00,
				currency: "PHP",
				paymentTermId: ptByCode["NET30"] || null,
				shippingTerms: "FOB Destination",
				deliveryAddress: "123 Main St, Makati City, Metro Manila",
				termsConditions: "Standard procurement terms apply",
				status: PurchaseOrderStatus.APPROVED,
				remarks: "Urgent order for new hires",
				isDeleted: false,
			},
			{
				id: "707f1f77bcf86cd799439102",
				poNumber: "PO-2025-002",
				vendorId: vendors[1]?.id || vendors[0].id,
				estimationId: estimations[1]?.id || estimations[0]?.id || null,
				projectId: projects[1]?.id || projects[0]?.id || null,
				poTypeId: poTypeByCode["S"] || poTypes[0]?.id || null, // Service (software license)
				orderDate: new Date("2025-01-20"),
				expectedDeliveryDate: new Date("2025-02-28"),
				approvalDate: null,
				requestedBy: "Mike Chen",
				requestedByTitle: "Software Engineer",
				requestedByDepartment: "Engineering",
				checkedBy: null,
				checkedByTitle: null,
				approvedBy: null,
				approvedByTitle: null,
				leadTime: "Immediate",
				availability: "Available",
				deliveryTerms: null,
				items: [
					{
						itemCode: "MS-O365-BP",
						description: "Microsoft Office 365 Business Premium",
						quantity: 50,
						unitPrice: 1500.00,
						totalPrice: 75000.00,
						unit: "license",
						remarks: "Annual subscription"
					}
				],
				subtotal: 75000.00,
				taxPercentage: 12,
				taxAmount: 9000.00,
				discountAmount: 5000.00,
				totalAmount: 79000.00,
				currency: "PHP",
				paymentTermId: ptByCode["NET15"] || null,
				shippingTerms: null,
				deliveryAddress: null,
				termsConditions: "Software license agreement applies",
				status: PurchaseOrderStatus.DRAFT,
				remarks: "Awaiting budget approval",
				isDeleted: false,
			},
			{
				id: "707f1f77bcf86cd799439103",
				poNumber: "PO-2025-003",
				vendorId: vendors[2]?.id || vendors[0].id,
				estimationId: estimations[2]?.id || estimations[0]?.id || null,
				projectId: projects[2]?.id || projects[0]?.id || null,
				poTypeId: poTypeByCode["E"] || poTypes[0]?.id || null, // Equipment
				orderDate: new Date("2025-01-10"),
				expectedDeliveryDate: new Date("2025-01-25"),
				approvalDate: new Date("2025-01-11"),
				requestedBy: "Sarah Johnson",
				requestedByTitle: "Network Administrator",
				requestedByDepartment: "IT Infrastructure",
				checkedBy: "Mark Santos",
				checkedByTitle: "IT Manager",
				approvedBy: "Robert Taylor",
				approvedByTitle: "CTO",
				leadTime: "2-3 weeks",
				availability: "In Stock",
				deliveryTerms: "Free delivery within Metro Manila",
				items: [
					{
						itemCode: "CISCO-2960X",
						description: "Cisco Catalyst 2960-X Switch",
						quantity: 3,
						unitPrice: 85000.00,
						totalPrice: 255000.00,
						unit: "unit",
						remarks: "For network upgrade"
					},
					{
						itemCode: "CAT6-305M",
						description: "Cat6 Network Cable (305m box)",
						quantity: 5,
						unitPrice: 8000.00,
						totalPrice: 40000.00,
						unit: "box",
						remarks: null
					}
				],
				subtotal: 295000.00,
				taxPercentage: 12,
				taxAmount: 35400.00,
				discountAmount: 0,
				totalAmount: 330400.00,
				currency: "PHP",
				paymentTermId: ptByCode["COD"] || null,
				shippingTerms: "Free delivery",
				deliveryAddress: "456 Tech Park, BGC, Taguig",
				termsConditions: null,
				status: PurchaseOrderStatus.COMPLETED,
				remarks: "All items received and verified",
				isDeleted: false,
			},
			{
				id: "707f1f77bcf86cd799439104",
				poNumber: "PO-2025-004",
				vendorId: vendors[3]?.id || vendors[0].id,
				estimationId: estimations[3]?.id || estimations[0]?.id || null,
				projectId: projects[3]?.id || projects[0]?.id || null,
				poTypeId: poTypeByCode["P"] || poTypes[0]?.id || null, // Product (furniture)
				orderDate: new Date("2025-01-22"),
				expectedDeliveryDate: new Date("2025-03-15"),
				approvalDate: new Date("2025-01-23"),
				requestedBy: "Emily Davis",
				requestedByTitle: "Office Manager",
				requestedByDepartment: "Facilities",
				checkedBy: "Carlos Reyes",
				checkedByTitle: "Procurement Lead",
				approvedBy: "Jane Doe",
				approvedByTitle: "VP of Operations",
				leadTime: "6-8 weeks",
				availability: "Made to Order",
				deliveryTerms: "White glove delivery and assembly",
				items: [
					{
						itemCode: "HM-AERON",
						description: "Herman Miller Aeron Chair",
						quantity: 20,
						unitPrice: 75000.00,
						totalPrice: 1500000.00,
						unit: "unit",
						remarks: "Ergonomic chairs for executive floor"
					}
				],
				subtotal: 1500000.00,
				taxPercentage: 12,
				taxAmount: 180000.00,
				discountAmount: 100000.00,
				totalAmount: 1580000.00,
				currency: "PHP",
				paymentTermId: ptByCode["50-50"] || null,
				shippingTerms: "FOB Destination",
				deliveryAddress: "789 Corporate Tower, Ortigas Center",
				termsConditions: "12-year warranty on all chairs",
				status: PurchaseOrderStatus.APPROVED,
				remarks: "Custom order - extended lead time",
				isDeleted: false,
			},
			{
				id: "707f1f77bcf86cd799439105",
				poNumber: "PO-2025-005",
				vendorId: vendors[4]?.id || vendors[0].id,
				estimationId: estimations[4]?.id || estimations[0]?.id || null,
				projectId: projects[4]?.id || projects[0]?.id || null,
				poTypeId: poTypeByCode["E"] || poTypes[0]?.id || null, // Equipment (servers)
				orderDate: new Date("2025-01-25"),
				expectedDeliveryDate: new Date("2025-02-10"),
				approvalDate: new Date("2025-01-25"),
				requestedBy: "David Wilson",
				requestedByTitle: "Systems Administrator",
				requestedByDepartment: "IT Infrastructure",
				checkedBy: "Grace Tan",
				checkedByTitle: "IT Director",
				approvedBy: "Robert Taylor",
				approvedByTitle: "CTO",
				leadTime: "3-4 weeks",
				availability: "In Stock",
				deliveryTerms: "Rack mount installation included",
				items: [
					{
						itemCode: "DELL-R750",
						description: "Dell PowerEdge R750 Server",
						quantity: 2,
						unitPrice: 450000.00,
						totalPrice: 900000.00,
						unit: "unit",
						remarks: "Production servers"
					},
					{
						itemCode: "DDR4-32G-ECC",
						description: "32GB DDR4 ECC RAM",
						quantity: 8,
						unitPrice: 12000.00,
						totalPrice: 96000.00,
						unit: "module",
						remarks: "Additional memory modules"
					}
				],
				subtotal: 996000.00,
				taxPercentage: 12,
				taxAmount: 119520.00,
				discountAmount: 50000.00,
				totalAmount: 1065520.00,
				currency: "PHP",
				paymentTermId: ptByCode["NET45"] || null,
				shippingTerms: "White glove delivery",
				deliveryAddress: "Data Center, 321 Server St, Makati",
				termsConditions: "3-year ProSupport included",
				status: PurchaseOrderStatus.COMPLETED,
				remarks: "Servers delivered, RAM pending",
				isDeleted: false,
			},
			{
				id: "707f1f77bcf86cd799439106",
				poNumber: "PO-2025-006",
				vendorId: vendors[5]?.id || vendors[0].id,
				estimationId: null,
				projectId: null,
				poTypeId: poTypeByCode["C"] || poTypes[0]?.id || null, // Consumables
				orderDate: new Date("2025-01-05"),
				expectedDeliveryDate: new Date("2025-01-15"),
				approvalDate: new Date("2025-01-05"),
				requestedBy: "Admin Team",
				requestedByTitle: null,
				requestedByDepartment: "Administration",
				checkedBy: "Rosa Lim",
				checkedByTitle: "Office Coordinator",
				approvedBy: "Jane Doe",
				approvedByTitle: "VP of Operations",
				leadTime: "3-5 days",
				availability: "In Stock",
				deliveryTerms: null,
				items: [
					{
						itemCode: "PPR-A4-5R",
						description: "A4 Copy Paper (5 reams/box)",
						quantity: 50,
						unitPrice: 1200.00,
						totalPrice: 60000.00,
						unit: "box",
						remarks: "Monthly stock"
					},
					{
						itemCode: "PEN-BP-12",
						description: "Ballpoint Pens (box of 12)",
						quantity: 20,
						unitPrice: 150.00,
						totalPrice: 3000.00,
						unit: "box",
						remarks: null
					}
				],
				subtotal: 63000.00,
				taxPercentage: 12,
				taxAmount: 7560.00,
				discountAmount: 0,
				totalAmount: 70560.00,
				currency: "PHP",
				paymentTermId: ptByCode["COD"] || null,
				shippingTerms: "Standard delivery",
				deliveryAddress: "Office Supplies Room, Ground Floor",
				termsConditions: null,
				status: PurchaseOrderStatus.COMPLETED,
				remarks: "Regular monthly order",
				isDeleted: false,
			},
			{
				id: "707f1f77bcf86cd799439107",
				poNumber: "PO-2025-007",
				vendorId: vendors[6]?.id || vendors[0].id,
				estimationId: estimations[5]?.id || estimations[0]?.id || null,
				projectId: projects[5]?.id || projects[0]?.id || null,
				poTypeId: poTypeByCode["P"] || poTypes[0]?.id || null, // Product (security keys)
				orderDate: new Date("2025-01-28"),
				expectedDeliveryDate: new Date("2025-02-20"),
				approvalDate: null,
				requestedBy: "Security Team",
				requestedByTitle: null,
				requestedByDepartment: "IT Security",
				checkedBy: null,
				checkedByTitle: null,
				approvedBy: null,
				approvedByTitle: null,
				leadTime: "2-3 weeks",
				availability: "In Stock",
				deliveryTerms: "Express courier",
				items: [
					{
						itemCode: "YK5-NFC",
						description: "YubiKey 5 NFC Security Key",
						quantity: 100,
						unitPrice: 3500.00,
						totalPrice: 350000.00,
						unit: "piece",
						remarks: "Company-wide 2FA rollout"
					}
				],
				subtotal: 350000.00,
				taxPercentage: 12,
				taxAmount: 42000.00,
				discountAmount: 25000.00,
				totalAmount: 367000.00,
				currency: "PHP",
				paymentTermId: ptByCode["NET30"] || null,
				shippingTerms: "Express delivery",
				deliveryAddress: "IT Security Office, 5th Floor",
				termsConditions: "2-year warranty per unit",
				status: PurchaseOrderStatus.DRAFT,
				remarks: "Pending security budget approval",
				isDeleted: false,
			},
			{
				id: "707f1f77bcf86cd799439108",
				poNumber: "PO-2025-008",
				vendorId: vendors[7]?.id || vendors[0].id,
				estimationId: null,
				projectId: null,
				poTypeId: poTypeByCode["C"] || poTypes[0]?.id || null, // Consumables (lights)
				orderDate: new Date("2025-01-12"),
				expectedDeliveryDate: new Date("2025-01-20"),
				approvalDate: new Date("2025-01-12"),
				requestedBy: "Facilities",
				requestedByTitle: null,
				requestedByDepartment: "Facilities Management",
				checkedBy: "Jun Reyes",
				checkedByTitle: "Maintenance Supervisor",
				approvedBy: "Robert Taylor",
				approvedByTitle: "CTO",
				leadTime: "1 week",
				availability: "In Stock",
				deliveryTerms: null,
				items: [
					{
						itemCode: "LED-PNL-40W",
						description: "LED Panel Light 40W",
						quantity: 30,
						unitPrice: 2500.00,
						totalPrice: 75000.00,
						unit: "piece",
						remarks: "Replacement for 3rd floor"
					}
				],
				subtotal: 75000.00,
				taxPercentage: 12,
				taxAmount: 9000.00,
				discountAmount: 0,
				totalAmount: 84000.00,
				currency: "PHP",
				paymentTermId: ptByCode["COD"] || null,
				shippingTerms: "Standard",
				deliveryAddress: "Maintenance Office",
				termsConditions: null,
				status: PurchaseOrderStatus.CANCELLED,
				remarks: "Cancelled - found better pricing elsewhere",
				isDeleted: false,
			},
			{
				id: "707f1f77bcf86cd799439109",
				poNumber: "PO-2025-009",
				vendorId: vendors[8]?.id || vendors[0].id,
				estimationId: estimations[6]?.id || estimations[0]?.id || null,
				projectId: projects[6]?.id || projects[0]?.id || null,
				poTypeId: poTypeByCode["M"] || poTypes[0]?.id || null, // Mixed (equipment + installation)
				orderDate: new Date("2025-01-30"),
				expectedDeliveryDate: new Date("2025-03-01"),
				approvalDate: new Date("2025-01-31"),
				requestedBy: "AV Team",
				requestedByTitle: null,
				requestedByDepartment: "Audio Visual",
				checkedBy: "Kevin Brown",
				checkedByTitle: "AV Project Manager",
				approvedBy: "Jane Doe",
				approvedByTitle: "VP of Operations",
				leadTime: "4-5 weeks",
				availability: "Available",
				deliveryTerms: "Professional installation included",
				items: [
					{
						itemCode: "POLY-X50",
						description: "Poly Studio X50 Video Bar",
						quantity: 6,
						unitPrice: 120000.00,
						totalPrice: 720000.00,
						unit: "unit",
						remarks: "Conference room upgrade"
					},
					{
						itemCode: "SONY-75-4K",
						description: "Sony 75\" 4K Display",
						quantity: 6,
						unitPrice: 180000.00,
						totalPrice: 1080000.00,
						unit: "unit",
						remarks: "For conference rooms"
					}
				],
				subtotal: 1800000.00,
				taxPercentage: 12,
				taxAmount: 216000.00,
				discountAmount: 150000.00,
				totalAmount: 1866000.00,
				currency: "PHP",
				paymentTermId: ptByCode["NET60"] || null,
				shippingTerms: "Professional installation included",
				deliveryAddress: "All conference rooms",
				termsConditions: "3-year warranty, installation included",
				status: PurchaseOrderStatus.APPROVED,
				remarks: "AV upgrade project Phase 1",
				isDeleted: false,
			},
			{
				id: "707f1f77bcf86cd799439110",
				poNumber: "PO-2025-010",
				vendorId: vendors[9]?.id || vendors[0].id,
				estimationId: estimations[7]?.id || estimations[0]?.id || null,
				projectId: projects[7]?.id || projects[0]?.id || null,
				poTypeId: poTypeByCode["P"] || poTypes[0]?.id || null, // Product (furniture)
				orderDate: new Date("2025-02-01"),
				expectedDeliveryDate: new Date("2025-02-28"),
				approvalDate: new Date("2025-02-02"),
				requestedBy: "HR Department",
				requestedByTitle: null,
				requestedByDepartment: "Human Resources",
				checkedBy: "Anna Cruz",
				checkedByTitle: "HR Manager",
				approvedBy: "Robert Taylor",
				approvedByTitle: "CTO",
				leadTime: "3-4 weeks",
				availability: "In Stock",
				deliveryTerms: "Assembly and setup included",
				items: [
					{
						itemCode: "DESK-ELEC",
						description: "Standing Desk - Electric",
						quantity: 15,
						unitPrice: 35000.00,
						totalPrice: 525000.00,
						unit: "unit",
						remarks: "Health initiative"
					},
					{
						itemCode: "KB-ERGO",
						description: "Ergonomic Keyboard",
						quantity: 15,
						unitPrice: 5000.00,
						totalPrice: 75000.00,
						unit: "unit",
						remarks: null
					},
					{
						itemCode: "MS-ERGO",
						description: "Ergonomic Mouse",
						quantity: 15,
						unitPrice: 3500.00,
						totalPrice: 52500.00,
						unit: "unit",
						remarks: null
					}
				],
				subtotal: 652500.00,
				taxPercentage: 12,
				taxAmount: 78300.00,
				discountAmount: 30000.00,
				totalAmount: 700800.00,
				currency: "PHP",
				paymentTermId: ptByCode["NET30"] || null,
				shippingTerms: "Assembly included",
				deliveryAddress: "Various departments",
				termsConditions: "5-year warranty on desks",
				status: PurchaseOrderStatus.APPROVED,
				remarks: "Ergonomic workplace initiative",
				isDeleted: false,
			},
		];

		// Create purchase orders
		console.log("📝 Creating purchase order records...");
		await prisma.purchaseOrder.createMany({
			data: purchaseOrderData.map((po, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...po, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${purchaseOrderData.length} purchase order records`);

		// Display summary
		const draftCount = purchaseOrderData.filter(po => po.status === PurchaseOrderStatus.DRAFT).length;
		const pendingCount = 0;
		const approvedCount = purchaseOrderData.filter(po => po.status === PurchaseOrderStatus.APPROVED).length;
		const sentCount = 0;
		const partialCount = 0;
		const receivedCount = purchaseOrderData.filter(po => po.status === PurchaseOrderStatus.COMPLETED).length;
		const cancelledCount = purchaseOrderData.filter(po => po.status === PurchaseOrderStatus.CANCELLED).length;

		console.log("\n📊 Purchase Order Summary:");
		console.log(`   📝 Draft: ${draftCount}`);
		console.log(`   ⏳ Pending: ${pendingCount}`);
		console.log(`   ✅ Approved: ${approvedCount}`);
		console.log(`   📤 Sent: ${sentCount}`);
		console.log(`   📦 Partial: ${partialCount}`);
		console.log(`   ✔️  Received: ${receivedCount}`);
		console.log(`   ❌ Cancelled: ${cancelledCount}`);
		console.log(`\n   📈 Total Purchase Orders: ${purchaseOrderData.length}`);

		console.log("\n🎉 Purchase order seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during purchase order seeding:", error);
		throw error;
	}
}
