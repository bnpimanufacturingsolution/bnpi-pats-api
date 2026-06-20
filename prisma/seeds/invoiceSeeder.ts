import { PrismaClient, InvoiceStatus, InvoiceType } from "../../generated/prisma";

export async function seedInvoice(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting invoice seeding...");

	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		// Get existing purchase orders, delivery orders, vendors, and projects
		const purchaseOrders = await prisma.purchaseOrder.findMany({ take: 10 });
		const deliveryOrders = await prisma.deliveryOrder.findMany({ take: 10 });
		const vendors = await prisma.vendor.findMany({ take: 10 });
		const projects = await prisma.project.findMany({ take: 10 });

		if (vendors.length === 0) {
			console.log("⚠️  No vendors found. Please seed vendors first.");
			return;
		}

		// Clear existing invoices
		console.log("🗑️  Clearing existing invoices...");
		await prisma.invoice.deleteMany({});
		console.log("   ✓ Invoices deleted");

		const invoiceData = [
			{
				id: "907f1f77bcf86cd799439301",
				invoiceNumber: "INV-2025-001",
				invoiceType: InvoiceType.PAYABLE,
				purchaseOrderId: purchaseOrders[0]?.id || null,
				deliveryOrderId: deliveryOrders[0]?.id || null,
				vendorId: vendors[0].id,
				projectId: projects[0]?.id || null,
				partyName: "TechSupply Global Inc.",
				partyAddress: "1234 Technology Drive, Silicon Valley, CA 94025",
				partyContact: "+1-555-0101",
				partyEmail: "accounts@techsupply.com",
				invoiceDate: new Date("2025-02-16"),
				dueDate: new Date("2025-03-18"),
				paidDate: null,
				items: [
					{
						description: "Dell Latitude 7430 Laptop",
						quantity: 10,
						unitPrice: 65000.00,
						totalPrice: 650000.00,
						taxable: true,
						remarks: null
					},
					{
						description: "Dell 27\" Monitor",
						quantity: 10,
						unitPrice: 15000.00,
						totalPrice: 150000.00,
						taxable: true,
						remarks: null
					}
				],
				subtotal: 800000.00,
				taxPercentage: 12,
				taxAmount: 96000.00,
				discountAmount: 0,
				totalAmount: 896000.00,
				currency: "PHP",
				paidAmount: 0,
				balanceDue: 896000.00,
				paymentTerms: "Net 30",
				paymentRecords: [],
				status: InvoiceStatus.SENT,
				remarks: "Please process payment before due date",
				sentAt: new Date("2025-02-16"),
				acknowledgedAt: new Date("2025-02-17"),
				acknowledgedBy: "Finance Team",
				isDeleted: false,
			},
			{
				id: "907f1f77bcf86cd799439302",
				invoiceNumber: "INV-2025-002",
				invoiceType: InvoiceType.PAYABLE,
				purchaseOrderId: purchaseOrders[2]?.id || null,
				deliveryOrderId: deliveryOrders[1]?.id || null,
				vendorId: vendors[2]?.id || vendors[0].id,
				projectId: projects[2]?.id || null,
				partyName: "NetworkPro Systems",
				partyAddress: "890 Network Lane, Austin, TX 78701",
				partyContact: "+1-555-0103",
				partyEmail: "billing@networkpro.com",
				invoiceDate: new Date("2025-01-26"),
				dueDate: new Date("2025-02-10"),
				paidDate: new Date("2025-02-08"),
				items: [
					{
						description: "Cisco Catalyst 2960-X Switch",
						quantity: 3,
						unitPrice: 85000.00,
						totalPrice: 255000.00,
						taxable: true,
						remarks: null
					},
					{
						description: "Cat6 Network Cable (305m box)",
						quantity: 5,
						unitPrice: 8000.00,
						totalPrice: 40000.00,
						taxable: true,
						remarks: null
					}
				],
				subtotal: 295000.00,
				taxPercentage: 12,
				taxAmount: 35400.00,
				discountAmount: 0,
				totalAmount: 330400.00,
				currency: "PHP",
				paidAmount: 330400.00,
				balanceDue: 0,
				paymentTerms: "COD",
				paymentRecords: [
					{
						paymentDate: new Date("2025-02-08"),
						amount: 330400.00,
						paymentMethod: "BANK_TRANSFER",
						referenceNumber: "BT-2025-001234",
						remarks: "Full payment"
					}
				],
				status: InvoiceStatus.PAID,
				remarks: "Payment completed",
				sentAt: new Date("2025-01-26"),
				acknowledgedAt: new Date("2025-01-26"),
				acknowledgedBy: "Accounts Payable",
				isDeleted: false,
			},
			{
				id: "907f1f77bcf86cd799439303",
				invoiceNumber: "INV-2025-003",
				invoiceType: InvoiceType.PAYABLE,
				purchaseOrderId: purchaseOrders[4]?.id || null,
				deliveryOrderId: deliveryOrders[2]?.id || null,
				vendorId: vendors[4]?.id || vendors[0].id,
				projectId: projects[4]?.id || null,
				partyName: "CloudHost Services",
				partyAddress: "456 Cloud Avenue, Seattle, WA 98101",
				partyContact: "+1-555-0105",
				partyEmail: "invoices@cloudhost.com",
				invoiceDate: new Date("2025-02-09"),
				dueDate: new Date("2025-03-26"),
				paidDate: null,
				items: [
					{
						description: "Dell PowerEdge R750 Server",
						quantity: 2,
						unitPrice: 450000.00,
						totalPrice: 900000.00,
						taxable: true,
						remarks: null
					}
				],
				subtotal: 900000.00,
				taxPercentage: 12,
				taxAmount: 108000.00,
				discountAmount: 45000.00,
				totalAmount: 963000.00,
				currency: "PHP",
				paidAmount: 500000.00,
				balanceDue: 463000.00,
				paymentTerms: "Net 45",
				paymentRecords: [
					{
						paymentDate: new Date("2025-02-15"),
						amount: 500000.00,
						paymentMethod: "CHECK",
						referenceNumber: "CHK-2025-0056",
						remarks: "Partial payment - 50% downpayment"
					}
				],
				status: InvoiceStatus.PARTIAL,
				remarks: "Partial payment received, balance due on delivery of RAM",
				sentAt: new Date("2025-02-09"),
				acknowledgedAt: new Date("2025-02-10"),
				acknowledgedBy: "Finance Manager",
				isDeleted: false,
			},
			{
				id: "907f1f77bcf86cd799439304",
				invoiceNumber: "INV-2025-004",
				invoiceType: InvoiceType.PAYABLE,
				purchaseOrderId: purchaseOrders[3]?.id || null,
				deliveryOrderId: null,
				vendorId: vendors[3]?.id || vendors[0].id,
				projectId: projects[3]?.id || null,
				partyName: "Office Furniture Depot",
				partyAddress: "234 Commerce St, Chicago, IL 60601",
				partyContact: "+1-555-0104",
				partyEmail: "ar@officefurniture.com",
				invoiceDate: new Date("2025-01-24"),
				dueDate: new Date("2025-02-08"),
				paidDate: null,
				items: [
					{
						description: "Herman Miller Aeron Chair",
						quantity: 20,
						unitPrice: 75000.00,
						totalPrice: 1500000.00,
						taxable: true,
						remarks: "Executive ergonomic chairs"
					}
				],
				subtotal: 1500000.00,
				taxPercentage: 12,
				taxAmount: 180000.00,
				discountAmount: 100000.00,
				totalAmount: 1580000.00,
				currency: "PHP",
				paidAmount: 790000.00,
				balanceDue: 790000.00,
				paymentTerms: "50% downpayment, 50% on delivery",
				paymentRecords: [
					{
						paymentDate: new Date("2025-01-25"),
						amount: 790000.00,
						paymentMethod: "BANK_TRANSFER",
						referenceNumber: "BT-2025-002345",
						remarks: "50% downpayment"
					}
				],
				status: InvoiceStatus.PARTIAL,
				remarks: "Awaiting delivery for final payment",
				sentAt: new Date("2025-01-24"),
				acknowledgedAt: new Date("2025-01-24"),
				acknowledgedBy: "Procurement",
				isDeleted: false,
			},
			{
				id: "907f1f77bcf86cd799439305",
				invoiceNumber: "INV-2025-005",
				invoiceType: InvoiceType.PAYABLE,
				purchaseOrderId: purchaseOrders[5]?.id || null,
				deliveryOrderId: deliveryOrders[3]?.id || null,
				vendorId: vendors[5]?.id || vendors[0].id,
				projectId: null,
				partyName: "Security First Technologies",
				partyAddress: "789 Security Blvd, Washington, DC 20001",
				partyContact: "+1-555-0106",
				partyEmail: "billing@securityfirst.com",
				invoiceDate: new Date("2025-01-16"),
				dueDate: new Date("2025-01-16"),
				paidDate: new Date("2025-01-16"),
				items: [
					{
						description: "A4 Copy Paper (5 reams/box)",
						quantity: 50,
						unitPrice: 1200.00,
						totalPrice: 60000.00,
						taxable: true,
						remarks: null
					},
					{
						description: "Ballpoint Pens (box of 12)",
						quantity: 20,
						unitPrice: 150.00,
						totalPrice: 3000.00,
						taxable: true,
						remarks: null
					}
				],
				subtotal: 63000.00,
				taxPercentage: 12,
				taxAmount: 7560.00,
				discountAmount: 0,
				totalAmount: 70560.00,
				currency: "PHP",
				paidAmount: 70560.00,
				balanceDue: 0,
				paymentTerms: "COD",
				paymentRecords: [
					{
						paymentDate: new Date("2025-01-16"),
						amount: 70560.00,
						paymentMethod: "CASH",
						referenceNumber: "CASH-2025-0012",
						remarks: "COD payment"
					}
				],
				status: InvoiceStatus.PAID,
				remarks: "Paid on delivery",
				sentAt: new Date("2025-01-16"),
				acknowledgedAt: new Date("2025-01-16"),
				acknowledgedBy: "Admin",
				isDeleted: false,
			},
			{
				id: "907f1f77bcf86cd799439306",
				invoiceNumber: "INV-2025-006",
				invoiceType: InvoiceType.PAYABLE,
				purchaseOrderId: purchaseOrders[1]?.id || null,
				deliveryOrderId: deliveryOrders[8]?.id || null,
				vendorId: vendors[1]?.id || vendors[0].id,
				projectId: projects[1]?.id || null,
				partyName: "Software Solutions Ltd.",
				partyAddress: "567 Innovation Blvd, Boston, MA 02101",
				partyContact: "+1-555-0102",
				partyEmail: "invoices@softwaresolutions.com",
				invoiceDate: new Date("2025-02-21"),
				dueDate: new Date("2025-03-08"),
				paidDate: null,
				items: [
					{
						description: "Microsoft Office 365 Business Premium",
						quantity: 50,
						unitPrice: 1500.00,
						totalPrice: 75000.00,
						taxable: true,
						remarks: "Annual subscription"
					}
				],
				subtotal: 75000.00,
				taxPercentage: 12,
				taxAmount: 9000.00,
				discountAmount: 5000.00,
				totalAmount: 79000.00,
				currency: "PHP",
				paidAmount: 0,
				balanceDue: 79000.00,
				paymentTerms: "Net 15",
				paymentRecords: [],
				status: InvoiceStatus.SENT,
				remarks: "Software license renewal",
				sentAt: new Date("2025-02-21"),
				acknowledgedAt: null,
				acknowledgedBy: null,
				isDeleted: false,
			},
			{
				id: "907f1f77bcf86cd799439307",
				invoiceNumber: "INV-2025-007",
				invoiceType: InvoiceType.PAYABLE,
				purchaseOrderId: null,
				deliveryOrderId: null,
				vendorId: vendors[6]?.id || vendors[0].id,
				projectId: null,
				partyName: "Mobile Devices International",
				partyAddress: "321 Mobile Way, San Francisco, CA 94102",
				partyContact: "+1-555-0107",
				partyEmail: "billing@mobiledevices.com",
				invoiceDate: new Date("2025-01-10"),
				dueDate: new Date("2025-01-25"),
				paidDate: null,
				items: [
					{
						description: "Mobile phone repair services",
						quantity: 5,
						unitPrice: 3500.00,
						totalPrice: 17500.00,
						taxable: true,
						remarks: "Screen replacements"
					}
				],
				subtotal: 17500.00,
				taxPercentage: 12,
				taxAmount: 2100.00,
				discountAmount: 0,
				totalAmount: 19600.00,
				currency: "PHP",
				paidAmount: 0,
				balanceDue: 19600.00,
				paymentTerms: "Net 15",
				paymentRecords: [],
				status: InvoiceStatus.OVERDUE,
				remarks: "OVERDUE - Please settle immediately",
				sentAt: new Date("2025-01-10"),
				acknowledgedAt: new Date("2025-01-11"),
				acknowledgedBy: "IT Support",
				isDeleted: false,
			},
			{
				id: "907f1f77bcf86cd799439308",
				invoiceNumber: "INV-2025-008",
				invoiceType: InvoiceType.PAYABLE,
				purchaseOrderId: purchaseOrders[8]?.id || null,
				deliveryOrderId: null,
				vendorId: vendors[8]?.id || vendors[0].id,
				projectId: projects[6]?.id || null,
				partyName: "AV Systems Pro",
				partyAddress: "987 Audio Visual Rd, Los Angeles, CA 90001",
				partyContact: "+1-555-0109",
				partyEmail: "accounts@avsystems.com",
				invoiceDate: new Date("2025-02-01"),
				dueDate: new Date("2025-04-02"),
				paidDate: null,
				items: [
					{
						description: "Poly Studio X50 Video Bar",
						quantity: 6,
						unitPrice: 120000.00,
						totalPrice: 720000.00,
						taxable: true,
						remarks: null
					},
					{
						description: "Sony 75\" 4K Display",
						quantity: 6,
						unitPrice: 180000.00,
						totalPrice: 1080000.00,
						taxable: true,
						remarks: null
					},
					{
						description: "Professional Installation",
						quantity: 1,
						unitPrice: 50000.00,
						totalPrice: 50000.00,
						taxable: true,
						remarks: "Installation for all 6 conference rooms"
					}
				],
				subtotal: 1850000.00,
				taxPercentage: 12,
				taxAmount: 222000.00,
				discountAmount: 150000.00,
				totalAmount: 1922000.00,
				currency: "PHP",
				paidAmount: 0,
				balanceDue: 1922000.00,
				paymentTerms: "Net 60",
				paymentRecords: [],
				status: InvoiceStatus.DRAFT,
				remarks: "Draft - pending PO finalization",
				sentAt: null,
				acknowledgedAt: null,
				acknowledgedBy: null,
				isDeleted: false,
			},
			{
				id: "907f1f77bcf86cd799439309",
				invoiceNumber: "INV-2025-009",
				invoiceType: InvoiceType.RECEIVABLE,
				purchaseOrderId: null,
				deliveryOrderId: null,
				vendorId: null,
				projectId: projects[0]?.id || null,
				partyName: "ABC Corporation",
				partyAddress: "100 Client Street, Makati City",
				partyContact: "+63-2-888-1234",
				partyEmail: "payments@abccorp.com",
				invoiceDate: new Date("2025-02-01"),
				dueDate: new Date("2025-03-03"),
				paidDate: null,
				items: [
					{
						description: "IT Consulting Services - January 2025",
						quantity: 1,
						unitPrice: 500000.00,
						totalPrice: 500000.00,
						taxable: true,
						remarks: "Monthly retainer"
					}
				],
				subtotal: 500000.00,
				taxPercentage: 12,
				taxAmount: 60000.00,
				discountAmount: 0,
				totalAmount: 560000.00,
				currency: "PHP",
				paidAmount: 0,
				balanceDue: 560000.00,
				paymentTerms: "Net 30",
				paymentRecords: [],
				status: InvoiceStatus.SENT,
				remarks: "Monthly consulting invoice",
				sentAt: new Date("2025-02-01"),
				acknowledgedAt: new Date("2025-02-02"),
				acknowledgedBy: "Client AP Team",
				isDeleted: false,
			},
			{
				id: "907f1f77bcf86cd799439310",
				invoiceNumber: "INV-2025-010",
				invoiceType: InvoiceType.RECEIVABLE,
				purchaseOrderId: null,
				deliveryOrderId: null,
				vendorId: null,
				projectId: projects[1]?.id || null,
				partyName: "XYZ Enterprises",
				partyAddress: "200 Enterprise Ave, BGC, Taguig",
				partyContact: "+63-2-999-5678",
				partyEmail: "finance@xyzent.com",
				invoiceDate: new Date("2025-01-15"),
				dueDate: new Date("2025-02-14"),
				paidDate: new Date("2025-02-10"),
				items: [
					{
						description: "Software Development - Phase 1",
						quantity: 1,
						unitPrice: 1500000.00,
						totalPrice: 1500000.00,
						taxable: true,
						remarks: "Project milestone payment"
					}
				],
				subtotal: 1500000.00,
				taxPercentage: 12,
				taxAmount: 180000.00,
				discountAmount: 0,
				totalAmount: 1680000.00,
				currency: "PHP",
				paidAmount: 1680000.00,
				balanceDue: 0,
				paymentTerms: "Net 30",
				paymentRecords: [
					{
						paymentDate: new Date("2025-02-10"),
						amount: 1680000.00,
						paymentMethod: "BANK_TRANSFER",
						referenceNumber: "BT-XYZ-2025-001",
						remarks: "Full payment received"
					}
				],
				status: InvoiceStatus.PAID,
				remarks: "Phase 1 completed and paid",
				sentAt: new Date("2025-01-15"),
				acknowledgedAt: new Date("2025-01-16"),
				acknowledgedBy: "XYZ Finance",
				isDeleted: false,
			},
		];

		// Create invoices
		console.log("📝 Creating invoice records...");
		await prisma.invoice.createMany({
			data: invoiceData.map((inv, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...inv, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${invoiceData.length} invoice records`);

		// Display summary
		const draftCount = invoiceData.filter(i => i.status === InvoiceStatus.DRAFT).length;
		const sentCount = invoiceData.filter(i => i.status === InvoiceStatus.SENT).length;
		const partialCount = invoiceData.filter(i => i.status === InvoiceStatus.PARTIAL).length;
		const paidCount = invoiceData.filter(i => i.status === InvoiceStatus.PAID).length;
		const overdueCount = invoiceData.filter(i => i.status === InvoiceStatus.OVERDUE).length;
		const payableCount = invoiceData.filter(i => i.invoiceType === InvoiceType.PAYABLE).length;
		const receivableCount = invoiceData.filter(i => i.invoiceType === InvoiceType.RECEIVABLE).length;

		console.log("\n📊 Invoice Summary:");
		console.log(`   Status Breakdown:`);
		console.log(`   📝 Draft: ${draftCount}`);
		console.log(`   📤 Sent: ${sentCount}`);
		console.log(`   💰 Partial: ${partialCount}`);
		console.log(`   ✅ Paid: ${paidCount}`);
		console.log(`   ⚠️  Overdue: ${overdueCount}`);
		console.log(`\n   Type Breakdown:`);
		console.log(`   📥 Payable (to vendors): ${payableCount}`);
		console.log(`   📤 Receivable (from clients): ${receivableCount}`);
		console.log(`\n   📈 Total Invoices: ${invoiceData.length}`);

		console.log("\n🎉 Invoice seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during invoice seeding:", error);
		throw error;
	}
}
