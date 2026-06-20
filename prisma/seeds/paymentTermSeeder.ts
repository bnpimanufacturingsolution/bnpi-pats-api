import { PrismaClient, PaymentTermStatus } from "../../generated/prisma";

export async function seedPaymentTerm(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting payment term seeding...");

	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		// Get existing projects and estimations for linking
		const projects = await prisma.project.findMany({ take: 5 });
		const estimations = await prisma.estimation.findMany({ take: 5 });

		// Clear existing payment terms
		console.log("🗑️  Clearing existing payment terms...");
		await prisma.paymentTerm.deleteMany({});
		console.log("   ✓ Payment terms deleted");

		const paymentTermData = [
			{
				id: "a07f1f77bcf86cd799439401",
				code: "COD",
				name: "Cash on Delivery",
				description: "Payment is due upon delivery of goods or completion of services",
				dueDays: 0,
				discountDays: null,
				discountRate: null,
				lateFeeRate: null,
				lateFeeType: null,
				lateFeeGraceDays: null,
				isDefault: false,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "Immediate payment required",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 0, description: "Full Payment" }],
			},
			{
				id: "a07f1f77bcf86cd799439402",
				code: "CIA",
				name: "Cash in Advance",
				description: "Full payment required before goods are shipped or services are rendered",
				dueDays: 0,
				discountDays: null,
				discountRate: null,
				lateFeeRate: null,
				lateFeeType: null,
				lateFeeGraceDays: null,
				isDefault: false,
				requiresDeposit: true,
				depositPercentage: 100,
				notes: "Used for new customers or high-risk transactions",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 0, description: "Full Advance Payment" }],
			},
			{
				id: "a07f1f77bcf86cd799439403",
				code: "NET7",
				name: "Net 7 Days",
				description: "Payment is due within 7 days of invoice date",
				dueDays: 7,
				discountDays: null,
				discountRate: null,
				lateFeeRate: 2,
				lateFeeType: "PERCENTAGE",
				lateFeeGraceDays: 3,
				isDefault: false,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "Short-term payment option",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 7, description: "Full Payment" }],
			},
			{
				id: "a07f1f77bcf86cd799439404",
				code: "NET15",
				name: "Net 15 Days",
				description: "Payment is due within 15 days of invoice date",
				dueDays: 15,
				discountDays: 5,
				discountRate: 1,
				lateFeeRate: 1.5,
				lateFeeType: "PERCENTAGE",
				lateFeeGraceDays: 5,
				isDefault: false,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "1% discount if paid within 5 days",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 15, description: "Full Payment" }],
			},
			{
				id: "a07f1f77bcf86cd799439405",
				code: "NET30",
				name: "Net 30 Days",
				description: "Payment is due within 30 days of invoice date. Standard business term.",
				dueDays: 30,
				discountDays: 10,
				discountRate: 2,
				lateFeeRate: 1.5,
				lateFeeType: "PERCENTAGE",
				lateFeeGraceDays: 7,
				isDefault: true,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "2/10 Net 30 - 2% discount if paid within 10 days",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 30, description: "Full Payment" }],
			},
			{
				id: "a07f1f77bcf86cd799439406",
				code: "NET45",
				name: "Net 45 Days",
				description: "Payment is due within 45 days of invoice date",
				dueDays: 45,
				discountDays: 15,
				discountRate: 2,
				lateFeeRate: 1.5,
				lateFeeType: "PERCENTAGE",
				lateFeeGraceDays: 10,
				isDefault: false,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "Extended payment term for preferred customers",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 45, description: "Full Payment" }],
			},
			{
				id: "a07f1f77bcf86cd799439407",
				code: "NET60",
				name: "Net 60 Days",
				description: "Payment is due within 60 days of invoice date",
				dueDays: 60,
				discountDays: 20,
				discountRate: 3,
				lateFeeRate: 1.5,
				lateFeeType: "PERCENTAGE",
				lateFeeGraceDays: 14,
				isDefault: false,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "Extended term for large orders or key accounts",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 60, description: "Full Payment" }],
			},
			{
				id: "a07f1f77bcf86cd799439408",
				code: "NET90",
				name: "Net 90 Days",
				description: "Payment is due within 90 days of invoice date",
				dueDays: 90,
				discountDays: 30,
				discountRate: 4,
				lateFeeRate: 2,
				lateFeeType: "PERCENTAGE",
				lateFeeGraceDays: 14,
				isDefault: false,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "Special term for strategic partners only",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 90, description: "Full Payment" }],
			},
			{
				id: "a07f1f77bcf86cd799439409",
				code: "50-50",
				name: "50% Deposit, 50% on Delivery",
				description: "50% payment upfront, remaining 50% due upon delivery",
				dueDays: 0,
				discountDays: null,
				discountRate: null,
				lateFeeRate: 2,
				lateFeeType: "PERCENTAGE",
				lateFeeGraceDays: 7,
				isDefault: false,
				requiresDeposit: true,
				depositPercentage: 50,
				notes: "Common for custom orders or large purchases",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [
					{ sequence: 1, percentage: 50, dueDaysFromApproval: 0, description: "Deposit (50%)" },
					{ sequence: 2, percentage: 50, dueDaysFromApproval: 30, description: "Balance on Delivery (50%)" },
				],
			},
			{
				id: "a07f1f77bcf86cd799439410",
				code: "30-70",
				name: "30% Deposit, 70% on Completion",
				description: "30% payment upfront, remaining 70% due upon project completion",
				dueDays: 0,
				discountDays: null,
				discountRate: null,
				lateFeeRate: 2,
				lateFeeType: "PERCENTAGE",
				lateFeeGraceDays: 7,
				isDefault: false,
				requiresDeposit: true,
				depositPercentage: 30,
				notes: "Used for service contracts and projects",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [
					{ sequence: 1, percentage: 30, dueDaysFromApproval: 0, description: "Deposit (30%)" },
					{ sequence: 2, percentage: 70, dueDaysFromApproval: 60, description: "Balance on Completion (70%)" },
				],
			},
			{
				id: "a07f1f77bcf86cd799439411",
				code: "PROGRESS",
				name: "Progress Billing",
				description: "Payment due based on project milestones or percentage completion",
				dueDays: 15,
				discountDays: null,
				discountRate: null,
				lateFeeRate: 1.5,
				lateFeeType: "PERCENTAGE",
				lateFeeGraceDays: 7,
				isDefault: false,
				requiresDeposit: true,
				depositPercentage: 20,
				notes: "Invoiced monthly based on work completed",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [
					{ sequence: 1, percentage: 20, dueDaysFromApproval: 0, description: "Deposit (20%)" },
					{ sequence: 2, percentage: 30, dueDaysFromApproval: 30, description: "Progress Payment 1 (30%)" },
					{ sequence: 3, percentage: 30, dueDaysFromApproval: 60, description: "Progress Payment 2 (30%)" },
					{ sequence: 4, percentage: 20, dueDaysFromApproval: 90, description: "Final Payment (20%)" },
				],
			},
			{
				id: "a07f1f77bcf86cd799439412",
				code: "EOM",
				name: "End of Month",
				description: "Payment is due at the end of the month following the invoice date",
				dueDays: 30,
				discountDays: null,
				discountRate: null,
				lateFeeRate: 1.5,
				lateFeeType: "PERCENTAGE",
				lateFeeGraceDays: 7,
				isDefault: false,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "Due on the last day of the following month",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 30, description: "Full Payment (End of Month)" }],
			},
			{
				id: "a07f1f77bcf86cd799439413",
				code: "CONSIGN",
				name: "Consignment",
				description: "Payment due only after goods are sold by the buyer",
				dueDays: 0,
				discountDays: null,
				discountRate: null,
				lateFeeRate: null,
				lateFeeType: null,
				lateFeeGraceDays: null,
				isDefault: false,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "Payment upon sale of consigned goods",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 0, description: "Payment on Sale" }],
			},
			{
				id: "a07f1f77bcf86cd799439414",
				code: "LC",
				name: "Letter of Credit",
				description: "Payment secured by a letter of credit from buyer's bank",
				dueDays: 0,
				discountDays: null,
				discountRate: null,
				lateFeeRate: null,
				lateFeeType: null,
				lateFeeGraceDays: null,
				isDefault: false,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "Used for international trade transactions",
				status: PaymentTermStatus.ACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 0, description: "Full Payment (Letter of Credit)" }],
			},
			{
				id: "a07f1f77bcf86cd799439415",
				code: "LEGACY",
				name: "Legacy Term (Inactive)",
				description: "Old payment term no longer in use",
				dueDays: 45,
				discountDays: null,
				discountRate: null,
				lateFeeRate: null,
				lateFeeType: null,
				lateFeeGraceDays: null,
				isDefault: false,
				requiresDeposit: false,
				depositPercentage: null,
				notes: "Replaced by NET45",
				status: PaymentTermStatus.INACTIVE,
				isDeleted: false,
				installments: [{ sequence: 1, percentage: 100, dueDaysFromApproval: 45, description: "Full Payment" }],
			},
		];

		// Create payment terms
		console.log("📝 Creating payment term records...");
		await prisma.paymentTerm.createMany({
			data: paymentTermData.map((pt, index) => {
				const orgId = orgIds[index % orgIds.length];
				// Link some payment terms to projects/estimations for demo
				const projectId = index < 5 && projects[index] ? projects[index].id : null;
				const estimationId = index < 5 && estimations[index] ? estimations[index].id : null;
				return {
					...pt,
					workspaceId: orgId,
					organizationId: orgId,
					projectId,
					estimationId,
				};
			}),
		});

		console.log(`✅ Successfully created ${paymentTermData.length} payment term records`);

		// Count linked payment terms
		const linkedToProjectCount = Math.min(5, projects.length);
		const linkedToEstimationCount = Math.min(5, estimations.length);
		console.log(`   🔗 Linked to projects: ${linkedToProjectCount}`);
		console.log(`   🔗 Linked to estimations: ${linkedToEstimationCount}`);

		// Display summary
		const activeCount = paymentTermData.filter(pt => pt.status === PaymentTermStatus.ACTIVE).length;
		const inactiveCount = paymentTermData.filter(pt => pt.status === PaymentTermStatus.INACTIVE).length;
		const withDiscountCount = paymentTermData.filter(pt => pt.discountRate !== null).length;
		const withDepositCount = paymentTermData.filter(pt => pt.requiresDeposit).length;
		const defaultCount = paymentTermData.filter(pt => pt.isDefault).length;

		console.log("\n📊 Payment Term Summary:");
		console.log(`   ✅ Active: ${activeCount}`);
		console.log(`   ⏸️  Inactive: ${inactiveCount}`);
		console.log(`   💰 With Early Payment Discount: ${withDiscountCount}`);
		console.log(`   🏦 Requires Deposit: ${withDepositCount}`);
		console.log(`   ⭐ Default Terms: ${defaultCount}`);
		console.log(`\n   📈 Total Payment Terms: ${paymentTermData.length}`);

		console.log("\n🎉 Payment term seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during payment term seeding:", error);
		throw error;
	}
}
