import {
	PrismaClient,
	TransactionStatus,
	TransactionType,
	PaymentMethod,
} from "../../generated/prisma";

export async function seedTransaction(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting transaction seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		// Get existing projects, items, vendors, usageCodes, and purchase orders to create relationships
		const projects = await prisma.project.findMany({ take: 15 });
		const items = await prisma.item.findMany({ take: 20 });
		const vendors = await prisma.vendor.findMany({ take: 10 });
		const usageCodes = await prisma.usageCode.findMany();
		const purchaseOrders = await prisma.purchaseOrder.findMany({ take: 10 });

		if (projects.length === 0) {
			console.log("⚠️  No projects found. Please seed projects first.");
			return;
		}

		// Map usage codes by code for easy reference
		const usageCodeMap: { [key: string]: string } = {};
		usageCodes.forEach((uc) => {
			usageCodeMap[uc.code] = uc.id;
		});

		// Clear existing transactions
		console.log("🗑️  Clearing existing transactions...");
		await prisma.transaction.deleteMany({});
		console.log("   ✓ Transactions deleted");

		// Helper function to get dates within last 6 months
		const getRecentDate = (daysAgo: number): Date => {
			const date = new Date();
			date.setDate(date.getDate() - daysAgo);
			return date;
		};

		// Bank names for variety
		const banks = [
			"First National Bank",
			"Metro Bank",
			"City Savings Bank",
			"United Trust Bank",
			"Capital Bank",
			"Progressive Bank",
			"Community Bank",
		];

		const transactionData = [
			// ===== INCOMING TRANSACTIONS - Money coming INTO projects (Revenue) =====

			// Project 1 - Client payment (advance) - 5 days ago
			{
				id: "a08f1f77bcf86cd799440001",
				transactionNumber: "CHK-IN-2025-001",
				transactionDate: getRecentDate(5),
				projectId: projects[0].id,
				itemId: null, // INCOMING transactions don't link to items
				usageCodeId: null, // INCOMING transactions typically don't need usage codes
				transactionType: TransactionType.INCOMING,
				paymentMethod: PaymentMethod.CHECK,
				payeeName: "ABC Corporation", // Client paying us
				amount: 50000.0,
				checkDetails: {
					bankName: banks[0],
					accountNumber: "****1234",
					checkNumber: "CHK-001234",
					bouncedDate: null,
					bouncedReason: null,
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(8),
				documentUrls: [],
				idempotencyKey: "seed-txn-incoming-001",
				isDeleted: false,
			},
			// Project 1 - Client payment (final)
			{
				id: "a08f1f77bcf86cd799440002",
				transactionNumber: "WIRE-IN-2025-001",
				transactionDate: getRecentDate(35),
				projectId: projects[0].id,
				itemId: null,
				usageCodeId: null, // INCOMING transactions typically don't need usage codes
				transactionType: TransactionType.INCOMING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: "ABC Corporation",
				amount: 50000.0,
				bankTransferDetails: {
					bankName: banks[0],
					accountNumber: "****1234",
					referenceNumber: "WIRE-5678901234",
					transferType: "Wire Transfer",
				},
				status: TransactionStatus.PENDING,
				clearedDate: null,
				documentUrls: [],
				idempotencyKey: "seed-txn-incoming-002",
				isDeleted: false,
			},
			// Project 2 - Client payment
			{
				id: "a08f1f77bcf86cd799440003",
				transactionNumber: "CHK-IN-2025-002",
				transactionDate: getRecentDate(12),
				projectId: projects[1]?.id || projects[0].id,
				itemId: null,
				usageCodeId: null, // INCOMING transactions typically don't need usage codes
				transactionType: TransactionType.INCOMING,
				paymentMethod: PaymentMethod.CHECK,
				payeeName: "Tech Innovations Ltd",
				amount: 75000.0,
				checkDetails: {
					bankName: banks[1],
					accountNumber: "****5678",
					checkNumber: "CHK-567890",
					bouncedDate: null,
					bouncedReason: null,
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(15),
				documentUrls: [],
				idempotencyKey: "seed-txn-incoming-003",
				isDeleted: false,
			},
			// Project 3 - Bounced incoming transaction (client)
			{
				id: "a08f1f77bcf86cd799440004",
				transactionNumber: "CHK-IN-2025-003",
				transactionDate: getRecentDate(20),
				projectId: projects[2]?.id || projects[0].id,
				itemId: null,
				usageCodeId: null, // INCOMING transactions typically don't need usage codes
				transactionType: TransactionType.INCOMING,
				paymentMethod: PaymentMethod.CHECK,
				payeeName: "XYZ Enterprises",
				amount: 30000.0,
				checkDetails: {
					bankName: banks[2],
					accountNumber: "****9012",
					checkNumber: "CHK-901234",
					bouncedDate: new Date("2025-01-23"),
					bouncedReason: "Insufficient funds - client requested wire transfer instead",
				},
				status: TransactionStatus.BOUNCED,
				clearedDate: null,
				documentUrls: [],
				idempotencyKey: "seed-txn-incoming-004",
				isDeleted: false,
			},

			// ===== OUTGOING TRANSACTIONS - Money going OUT of projects (Expenses) =====

			// Project 1 - Payment for specific item (with itemId) - IT Equipment
			{
				id: "a08f1f77bcf86cd799440005",
				transactionNumber: "CHK-OUT-2025-001",
				transactionDate: getRecentDate(10),
				projectId: projects[0].id,
				itemId: items[0]?.id || null, // Payment for specific item
				usageCodeId: usageCodeMap["IT-EQUIP"] || null, // IT Equipment
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.CHECK,
				payeeName: vendors[0]?.name || "Web Hosting Services Inc",
				amount: 5000.0,
				checkDetails: {
					bankName: banks[3],
					accountNumber: "****3456",
					checkNumber: "CHK-123456",
					bouncedDate: null,
					bouncedReason: null,
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(12),
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-001",
				isDeleted: false,
			},
			// Project 1 - Payment for specific item (design services)
			{
				id: "a08f1f77bcf86cd799440006",
				transactionNumber: "WIRE-OUT-2025-001",
				transactionDate: getRecentDate(15),
				projectId: projects[0].id,
				itemId: items[1]?.id || null,
				usageCodeId: usageCodeMap["PROF-SVC"] || null, // Professional Services
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[1]?.name || "Creative Design Studio",
				amount: 12000.0,
				bankTransferDetails: {
					bankName: banks[4],
					accountNumber: "****7890",
					referenceNumber: "WIRE-12345",
					transferType: "Wire Transfer",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(18),
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-002",
				isDeleted: false,
			},
			// Project 1 - Office supplies (now with item)
			{
				id: "a08f1f77bcf86cd799440007",
				transactionNumber: "CASH-OUT-2025-001",
				transactionDate: getRecentDate(25),
				projectId: projects[0].id,
				itemId: items[11]?.id || items[0]?.id || null, // Now linked to office supplies item
				usageCodeId: usageCodeMap["OFF-SUP"] || null, // Office Supplies
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.CASH,
				payeeName: "Office Supplies Plus",
				amount: 500.0,
				cashDetails: {
					receivedBy: "Office Manager",
					notes: "Petty cash payment for office supplies",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: new Date("2025-01-27"),
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-003",
				isDeleted: false,
			},
			// Project 2 - Payment for development tools (with item)
			{
				id: "a08f1f77bcf86cd799440008",
				transactionNumber: "ONLINE-OUT-2025-001",
				transactionDate: getRecentDate(18),
				projectId: projects[1]?.id || projects[0].id,
				itemId: items[2]?.id || null,
				usageCodeId: usageCodeMap["SW-LIC"] || null, // Software Licenses
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.ONLINE,
				payeeName: vendors[2]?.name || "Software Licensing Co",
				amount: 8000.0,
				onlineDetails: {
					referenceNumber: "PAY-987654",
					platform: "PayPal",
					gatewayName: "PayPal Gateway",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(20),
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-004",
				isDeleted: false,
			},
			// Project 2 - Cloud infrastructure payment (with item)
			{
				id: "a08f1f77bcf86cd799440009",
				transactionNumber: "CHK-OUT-2025-005",
				transactionDate: getRecentDate(22),
				projectId: projects[1]?.id || projects[0].id,
				itemId: items[3]?.id || null,
				usageCodeId: usageCodeMap["IT-EQUIP"] || null, // IT Equipment
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.CHECK,
				payeeName: vendors[3]?.name || "Cloud Services Provider",
				amount: 3500.0,
				checkDetails: {
					bankName: banks[0],
					accountNumber: "****0123",
					checkNumber: "CHK-234567",
					bouncedDate: null,
					bouncedReason: null,
				},
				status: TransactionStatus.CLEARED,
				clearedDate: new Date("2025-01-24"),
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-005",
				isDeleted: false,
			},
			// Project 2 - Pending payment for QA testing (with item)
			{
				id: "a08f1f77bcf86cd799440010",
				transactionNumber: "CHK-OUT-2025-006",
				transactionDate: getRecentDate(40),
				projectId: projects[1]?.id || projects[0].id,
				itemId: items[4]?.id || null,
				usageCodeId: usageCodeMap["PROF-SVC"] || null, // Professional Services
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[4]?.name || "QA Testing Services",
				amount: 6000.0,
				bankTransferDetails: {
					bankName: banks[1],
					accountNumber: "****4567",
					referenceNumber: "WIRE-QA-6000",
					transferType: "ACH",
				},
				status: TransactionStatus.PENDING,
				clearedDate: null,
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-006",
				isDeleted: false,
			},
			// Project 3 - Payment gateway integration (with item)
			{
				id: "a08f1f77bcf86cd799440011",
				transactionNumber: "CHK-OUT-2025-007",
				transactionDate: getRecentDate(14),
				projectId: projects[2]?.id || projects[0].id,
				itemId: items[5]?.id || null,
				usageCodeId: usageCodeMap["SW-LIC"] || null, // Software Licenses
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[5]?.name || "Payment Gateway Solutions",
				amount: 15000.0,
				bankTransferDetails: {
					bankName: banks[2],
					accountNumber: "****8901",
					referenceNumber: "WIRE-GW-15000",
					transferType: "Wire Transfer",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: new Date("2025-01-17"),
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-007",
				isDeleted: false,
			},
			// Project 3 - SSL certificates (with item)
			{
				id: "a08f1f77bcf86cd799440012",
				transactionNumber: "CHK-OUT-2025-008",
				transactionDate: getRecentDate(28),
				projectId: projects[2]?.id || projects[0].id,
				itemId: items[6]?.id || null,
				usageCodeId: usageCodeMap["SEC-SVC"] || null, // Security Services
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[6]?.name || "Secure SSL Certificates",
				amount: 2000.0,
				bankTransferDetails: {
					bankName: banks[3],
					accountNumber: "****2345",
					referenceNumber: "WIRE-SSL-2000",
					transferType: "Wire Transfer",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: new Date("2025-01-30"),
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-008",
				isDeleted: false,
			},
			// Project 4 - AWS cloud migration (with item)
			{
				id: "a08f1f77bcf86cd799440013",
				transactionNumber: "CHK-OUT-2025-009",
				transactionDate: getRecentDate(20),
				projectId: projects[3]?.id || projects[0].id,
				itemId: items[7]?.id || null,
				usageCodeId: usageCodeMap["IT-EQUIP"] || null, // IT Equipment
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[7]?.name || "Amazon Web Services",
				amount: 35000.0,
				bankTransferDetails: {
					bankName: banks[4],
					accountNumber: "****6789",
					referenceNumber: "WIRE-AWS-35000",
					transferType: "Wire Transfer",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(22),
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-009",
				isDeleted: false,
			},
			// Project 4 - Database migration (with item, pending)
			{
				id: "a08f1f77bcf86cd799440014",
				transactionNumber: "CHK-OUT-2025-010",
				transactionDate: getRecentDate(50),
				projectId: projects[3]?.id || projects[0].id,
				itemId: items[8]?.id || null,
				usageCodeId: usageCodeMap["PROF-SVC"] || null, // Professional Services
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[8]?.name || "Data Migration Specialists",
				amount: 18000.0,
				bankTransferDetails: {
					bankName: banks[5],
					accountNumber: "****0123",
					referenceNumber: "WIRE-DB-18000",
					transferType: "ACH",
				},
				status: TransactionStatus.PENDING,
				clearedDate: null,
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-010",
				isDeleted: false,
			},
			// Project 5 - BI Tools license (with item)
			{
				id: "a08f1f77bcf86cd799440015",
				transactionNumber: "CHK-OUT-2025-011",
				transactionDate: getRecentDate(22),
				projectId: projects[4]?.id || projects[0].id,
				itemId: items[9]?.id || null,
				usageCodeId: usageCodeMap["SW-LIC"] || null, // Software Licenses
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[9]?.name || "BI Tools Enterprise",
				amount: 22000.0,
				bankTransferDetails: {
					bankName: banks[6],
					accountNumber: "****4567",
					referenceNumber: "WIRE-BI-22000",
					transferType: "Wire Transfer",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(25),
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-011",
				isDeleted: false,
			},
			// Cancelled outgoing transaction (now with item for deep linking)
			{
				id: "a08f1f77bcf86cd799440016",
				transactionNumber: "CHK-OUT-2025-012",
				transactionDate: getRecentDate(30),
				projectId: projects[5]?.id || projects[0].id,
				itemId: items[12]?.id || items[0]?.id || null, // Linked to consulting services item
				usageCodeId: usageCodeMap["PROF-SVC"] || null, // Professional Services
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.CHECK,
				payeeName: "Consulting Services Inc",
				amount: 7500.0,
				checkDetails: {
					bankName: banks[0],
					accountNumber: "****8901",
					checkNumber: "CHK-999999",
					bouncedDate: null,
					bouncedReason: null,
				},
				status: TransactionStatus.CANCELLED,
				clearedDate: null,
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-012",
				isDeleted: false,
			},
			// Voided outgoing transaction (now with item for deep linking)
			{
				id: "a08f1f77bcf86cd799440017",
				transactionNumber: "CHK-OUT-2025-013",
				transactionDate: getRecentDate(33),
				projectId: projects[6]?.id || projects[0].id,
				itemId: items[13]?.id || items[0]?.id || null, // Linked to office supplies item
				usageCodeId: usageCodeMap["OFF-SUP"] || null, // Office Supplies
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.CHECK,
				payeeName: vendors[0]?.name || "Office Supplies Store",
				amount: 1500.0,
				checkDetails: {
					bankName: banks[1],
					accountNumber: "****2345",
					checkNumber: "CHK-888888",
					bouncedDate: null,
					bouncedReason: null,
				},
				status: TransactionStatus.VOIDED,
				clearedDate: null,
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-013",
				isDeleted: false,
			},
			// Additional pending outgoing transactions
			{
				id: "a08f1f77bcf86cd799440018",
				transactionNumber: "CHK-OUT-2025-014",
				transactionDate: getRecentDate(45),
				projectId: projects[7]?.id || projects[0].id,
				itemId: items[10]?.id || null,
				usageCodeId: usageCodeMap["MKT-ADV"] || null, // Marketing & Advertising
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[1]?.name || "Marketing Agency",
				amount: 9500.0,
				bankTransferDetails: {
					bankName: banks[2],
					accountNumber: "****6789",
					referenceNumber: "WIRE-MKT-9500",
					transferType: "ACH",
				},
				status: TransactionStatus.PENDING,
				clearedDate: null,
				documentUrls: [],
				idempotencyKey: "seed-txn-outgoing-014",
				isDeleted: false,
			},

			// ===== PURCHASE ORDER LINKED TRANSACTIONS =====
			// These transactions are payments made against specific Purchase Orders

			// PO Payment - IT Equipment (Dell Laptops) - PO-2025-001
			{
				id: "a08f1f77bcf86cd799440019",
				transactionNumber: "PO-PAY-2025-001",
				transactionDate: getRecentDate(3),
				projectId: projects[0]?.id || projects[0].id,
				itemId: items[0]?.id || null,
				purchaseOrderId: purchaseOrders[0]?.id || null,
				usageCodeId: usageCodeMap["IT-EQUIP"] || null,
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[0]?.name || "Dell Technologies",
				amount: 896000.0, // Full payment for PO-2025-001
				bankTransferDetails: {
					bankName: banks[0],
					accountNumber: "****1234",
					referenceNumber: "WIRE-PO-001",
					transferType: "Wire Transfer",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(5),
				documentUrls: [],
				idempotencyKey: "seed-txn-po-001",
				isDeleted: false,
			},
			// PO Payment - Network Equipment (Cisco Switches) - PO-2025-003
			{
				id: "a08f1f77bcf86cd799440020",
				transactionNumber: "PO-PAY-2025-002",
				transactionDate: getRecentDate(8),
				projectId: projects[2]?.id || projects[0].id,
				itemId: items[5]?.id || null,
				purchaseOrderId: purchaseOrders[2]?.id || null,
				usageCodeId: usageCodeMap["IT-EQUIP"] || null,
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.CHECK,
				payeeName: vendors[2]?.name || "Cisco Systems",
				amount: 330400.0, // Full payment for PO-2025-003
				checkDetails: {
					bankName: banks[1],
					accountNumber: "****5678",
					checkNumber: "CHK-PO-003",
					bouncedDate: null,
					bouncedReason: null,
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(10),
				documentUrls: [],
				idempotencyKey: "seed-txn-po-002",
				isDeleted: false,
			},
			// PO Partial Payment - Herman Miller Chairs (50% Downpayment) - PO-2025-004
			{
				id: "a08f1f77bcf86cd799440021",
				transactionNumber: "PO-PAY-2025-003",
				transactionDate: getRecentDate(12),
				projectId: projects[3]?.id || projects[0].id,
				itemId: null, // Office furniture - no specific item
				purchaseOrderId: purchaseOrders[3]?.id || null,
				usageCodeId: usageCodeMap["OFF-SUP"] || null,
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[3]?.name || "Herman Miller",
				amount: 790000.0, // 50% downpayment for PO-2025-004
				bankTransferDetails: {
					bankName: banks[2],
					accountNumber: "****9012",
					referenceNumber: "WIRE-PO-004-DP",
					transferType: "Wire Transfer",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(14),
				documentUrls: [],
				idempotencyKey: "seed-txn-po-003",
				isDeleted: false,
			},
			// PO Payment - Server Equipment (Dell PowerEdge) - PO-2025-005
			{
				id: "a08f1f77bcf86cd799440022",
				transactionNumber: "PO-PAY-2025-004",
				transactionDate: getRecentDate(6),
				projectId: projects[4]?.id || projects[0].id,
				itemId: items[7]?.id || null,
				purchaseOrderId: purchaseOrders[4]?.id || null,
				usageCodeId: usageCodeMap["IT-EQUIP"] || null,
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[4]?.name || "Dell Technologies",
				amount: 1065520.0, // Full payment for PO-2025-005
				bankTransferDetails: {
					bankName: banks[3],
					accountNumber: "****3456",
					referenceNumber: "WIRE-PO-005",
					transferType: "Wire Transfer",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(8),
				documentUrls: [],
				idempotencyKey: "seed-txn-po-004",
				isDeleted: false,
			},
			// PO Payment - Office Supplies - PO-2025-006
			{
				id: "a08f1f77bcf86cd799440023",
				transactionNumber: "PO-PAY-2025-005",
				transactionDate: getRecentDate(15),
				projectId: projects[0]?.id || projects[0].id,
				itemId: items[11]?.id || null,
				purchaseOrderId: purchaseOrders[5]?.id || null,
				usageCodeId: usageCodeMap["OFF-SUP"] || null,
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.CASH,
				payeeName: "Office Supplies Store",
				amount: 70560.0, // Full payment for PO-2025-006
				cashDetails: {
					receivedBy: "Admin Officer",
					notes: "COD payment for office supplies",
				},
				status: TransactionStatus.CLEARED,
				clearedDate: getRecentDate(15),
				documentUrls: [],
				idempotencyKey: "seed-txn-po-005",
				isDeleted: false,
			},
			// PO Payment Pending - AV Equipment - PO-2025-009
			{
				id: "a08f1f77bcf86cd799440024",
				transactionNumber: "PO-PAY-2025-006",
				transactionDate: getRecentDate(2),
				projectId: projects[6]?.id || projects[0].id,
				itemId: null,
				purchaseOrderId: purchaseOrders[8]?.id || null,
				usageCodeId: usageCodeMap["IT-EQUIP"] || null,
				transactionType: TransactionType.OUTGOING,
				paymentMethod: PaymentMethod.BANK_TRANSFER,
				payeeName: vendors[8]?.name || "AV Solutions Inc",
				amount: 1866000.0, // Full payment for PO-2025-009
				bankTransferDetails: {
					bankName: banks[4],
					accountNumber: "****7890",
					referenceNumber: "WIRE-PO-009",
					transferType: "Wire Transfer",
				},
				status: TransactionStatus.PENDING,
				clearedDate: null,
				documentUrls: [],
				idempotencyKey: "seed-txn-po-006",
				isDeleted: false,
			},
		];

		// Create transactions using createMany for better performance
		console.log("📝 Creating transaction records...");
		await prisma.transaction.createMany({
			data: transactionData.map((t, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...t, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${transactionData.length} transaction records`);

		// Sync item financials for all items with transactions (optional module)
		console.log("📊 Syncing item financials...");
		try {
			const modulePath = "../../app/item-financials/item-financials.service";
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { syncAllFinancials } = require(modulePath);
			const syncResult = await syncAllFinancials(prisma);
			console.log(`✅ Synced financials: ${syncResult.totalProjects} projects, ${syncResult.totalItems} items in ${syncResult.duration}ms`);
		} catch (err) {
			console.log(`   ⚠️  Skipped item financials sync (module not available)`);
		}

		// Calculate financial summary
		const totalAmount = transactionData.reduce((sum, item) => sum + item.amount, 0);

		const incomingTransactions = transactionData.filter(
			(c) => c.transactionType === TransactionType.INCOMING,
		);
		const outgoingTransactions = transactionData.filter(
			(c) => c.transactionType === TransactionType.OUTGOING,
		);

		const clearedTransactions = transactionData.filter(
			(c) => c.status === TransactionStatus.CLEARED,
		);
		const pendingTransactions = transactionData.filter(
			(c) => c.status === TransactionStatus.PENDING,
		);
		const bouncedTransactions = transactionData.filter(
			(c) => c.status === TransactionStatus.BOUNCED,
		);
		const cancelledTransactions = transactionData.filter(
			(c) => c.status === TransactionStatus.CANCELLED,
		);
		const voidedTransactions = transactionData.filter(
			(c) => c.status === TransactionStatus.VOIDED,
		);

		const totalIncoming = incomingTransactions.reduce((sum, item) => sum + item.amount, 0);
		const totalOutgoing = outgoingTransactions.reduce((sum, item) => sum + item.amount, 0);
		const totalCleared = clearedTransactions.reduce((sum, item) => sum + item.amount, 0);
		const totalPending = pendingTransactions.reduce((sum, item) => sum + item.amount, 0);

		const transactionsWithItems = transactionData.filter((c) => c.itemId !== null);
		const transactionsWithoutItems = transactionData.filter((c) => c.itemId === null);
		const transactionsWithUsageCode = transactionData.filter((c) => c.usageCodeId !== null);
		const transactionsWithoutUsageCode = transactionData.filter((c) => c.usageCodeId === null);
		const transactionsWithPO = transactionData.filter((c: any) => c.purchaseOrderId !== null && c.purchaseOrderId !== undefined);
		const totalPOPayments = transactionsWithPO.reduce((sum, item) => sum + item.amount, 0);

		console.log("\n📊 Transaction Summary:");
		console.log(`\n   💰 Money Flow:`);
		console.log(
			`   📥 INCOMING (Revenue): ${incomingTransactions.length} transactions - $${totalIncoming.toLocaleString()}`,
		);
		console.log(
			`   📤 OUTGOING (Expenses): ${outgoingTransactions.length} transactions - $${totalOutgoing.toLocaleString()}`,
		);
		console.log(`   💵 Net Cash Flow: $${(totalIncoming - totalOutgoing).toLocaleString()}`);

		console.log(`\n   Status Breakdown:`);
		console.log(
			`   ✅ Cleared: ${clearedTransactions.length} transactions - $${totalCleared.toLocaleString()}`,
		);
		console.log(
			`   ⏳ Pending: ${pendingTransactions.length} transactions - $${totalPending.toLocaleString()}`,
		);
		console.log(`   ❌ Bounced: ${bouncedTransactions.length} transactions`);
		console.log(`   🚫 Cancelled: ${cancelledTransactions.length} transactions`);
		console.log(`   ⛔ Voided: ${voidedTransactions.length} transactions`);

		console.log(`\n   🔗 Item Association:`);
		console.log(`   📎 Linked to specific items: ${transactionsWithItems.length} transactions`);
		console.log(
			`   📋 General project expenses: ${transactionsWithoutItems.length} transactions`,
		);

		console.log(`\n   🏷️  Usage Code Association:`);
		console.log(`   ✅ With usage code: ${transactionsWithUsageCode.length} transactions`);
		console.log(`   ⚪ Without usage code: ${transactionsWithoutUsageCode.length} transactions`);

		console.log(`\n   📦 Purchase Order Payments:`);
		console.log(`   🔗 Linked to POs: ${transactionsWithPO.length} transactions - $${totalPOPayments.toLocaleString()}`);

		console.log(`\n   📈 Total Transactions: ${transactionData.length}`);
		console.log(`   💰 Total Amount: $${totalAmount.toLocaleString()}`);

		console.log("\n🎉 Transaction seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during transaction seeding:", error);
		throw error;
	}
}
