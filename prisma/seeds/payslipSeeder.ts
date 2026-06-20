import { PrismaClient } from "../../generated/prisma";

export async function seedPayslip(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting payslip seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		// Get existing estimations to create relationships
		const estimations = await prisma.estimation.findMany({ take: 15 });

		if (estimations.length === 0) {
			console.log("⚠️  No estimations found. Please seed estimations first.");
			return;
		}

		// Clear existing payslips
		console.log("🗑️  Clearing existing payslips...");
		await prisma.payslip.deleteMany({});
		console.log("   ✓ Payslips deleted");

		// Generate realistic employee names
		const names = [
			"John Smith",
			"Sarah Johnson",
			"Mike Chen",
			"Emily Davis",
			"David Wilson",
			"Amanda Lee",
			"Laura Martinez",
			"Kevin Brown",
			"Jennifer Garcia",
			"Thomas White",
		];

		const payslipData = [
			// Project 1 - Corporate Website Redesign - January Payslips
			{
				id: "908f1f77bcf86cd799439011",
				payslipNumber: "PS-2025-001",
				estimationId: estimations[0].id,
				name: names[0],
				amount: 12000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Senior Frontend Developer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439012",
				payslipNumber: "PS-2025-002",
				estimationId: estimations[0].id,
				name: names[1],
				amount: 10000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - UI/UX Designer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439013",
				payslipNumber: "PS-2025-003",
				estimationId: estimations[0].id,
				name: names[2],
				amount: 13000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Project Manager",
				isDeleted: false,
			},

			// Project 1 - February Payslips
			{
				id: "908f1f77bcf86cd799439014",
				payslipNumber: "PS-2025-004",
				estimationId: estimations[0].id,
				name: names[0],
				amount: 11500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Senior Frontend Developer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439015",
				payslipNumber: "PS-2025-005",
				estimationId: estimations[0].id,
				name: names[1],
				amount: 9500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - UI/UX Designer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439016",
				payslipNumber: "PS-2025-006",
				estimationId: estimations[0].id,
				name: names[2],
				amount: 12500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Project Manager",
				isDeleted: false,
			},

			// Project 2 - Mobile App Development - January Payslips
			{
				id: "908f1f77bcf86cd799439017",
				payslipNumber: "PS-2025-007",
				estimationId: estimations[1]?.id || estimations[0].id,
				name: names[3],
				amount: 13500.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - iOS Developer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439018",
				payslipNumber: "PS-2025-008",
				estimationId: estimations[1]?.id || estimations[0].id,
				name: names[4],
				amount: 13000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Android Developer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439019",
				payslipNumber: "PS-2025-009",
				estimationId: estimations[1]?.id || estimations[0].id,
				name: names[5],
				amount: 9000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - QA Engineer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439020",
				payslipNumber: "PS-2025-010",
				estimationId: estimations[1]?.id || estimations[0].id,
				name: names[6],
				amount: 12000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Backend Developer",
				isDeleted: false,
			},

			// Project 2 - February Payslips
			{
				id: "908f1f77bcf86cd799439021",
				payslipNumber: "PS-2025-011",
				estimationId: estimations[1]?.id || estimations[0].id,
				name: names[3],
				amount: 13000.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - iOS Developer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439022",
				payslipNumber: "PS-2025-012",
				estimationId: estimations[1]?.id || estimations[0].id,
				name: names[4],
				amount: 12500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Android Developer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439023",
				payslipNumber: "PS-2025-013",
				estimationId: estimations[1]?.id || estimations[0].id,
				name: names[5],
				amount: 8500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - QA Engineer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439024",
				payslipNumber: "PS-2025-014",
				estimationId: estimations[1]?.id || estimations[0].id,
				name: names[6],
				amount: 11500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Backend Developer",
				isDeleted: false,
			},

			// Project 5 - Data Analytics Dashboard - January Payslips
			{
				id: "908f1f77bcf86cd799439025",
				payslipNumber: "PS-2025-015",
				estimationId: estimations[4]?.id || estimations[0].id,
				name: names[7],
				amount: 11000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Data Analyst",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439026",
				payslipNumber: "PS-2025-016",
				estimationId: estimations[4]?.id || estimations[0].id,
				name: names[8],
				amount: 10500.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Data Visualization Specialist",
				isDeleted: false,
			},

			// Project 5 - February Payslips
			{
				id: "908f1f77bcf86cd799439027",
				payslipNumber: "PS-2025-017",
				estimationId: estimations[4]?.id || estimations[0].id,
				name: names[7],
				amount: 10500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Data Analyst",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439028",
				payslipNumber: "PS-2025-018",
				estimationId: estimations[4]?.id || estimations[0].id,
				name: names[8],
				amount: 10000.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Data Visualization Specialist",
				isDeleted: false,
			},

			// Project 6 - CRM System Customization - January Payslips
			{
				id: "908f1f77bcf86cd799439029",
				payslipNumber: "PS-2025-019",
				estimationId: estimations[5]?.id || estimations[0].id,
				name: names[9],
				amount: 15000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Salesforce Consultant",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439030",
				payslipNumber: "PS-2025-020",
				estimationId: estimations[5]?.id || estimations[0].id,
				name: names[0],
				amount: 14500.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Salesforce Consultant",
				isDeleted: false,
			},

			// Project 7 - Network Security - January Payslips
			{
				id: "908f1f77bcf86cd799439031",
				payslipNumber: "PS-2025-021",
				estimationId: estimations[6]?.id || estimations[0].id,
				name: names[1],
				amount: 15000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Security Engineer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439032",
				payslipNumber: "PS-2025-022",
				estimationId: estimations[6]?.id || estimations[0].id,
				name: names[2],
				amount: 12000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Network Administrator",
				isDeleted: false,
			},

			// Project 7 - February Payslips
			{
				id: "908f1f77bcf86cd799439033",
				payslipNumber: "PS-2025-023",
				estimationId: estimations[6]?.id || estimations[0].id,
				name: names[1],
				amount: 14500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Security Engineer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439034",
				payslipNumber: "PS-2025-024",
				estimationId: estimations[6]?.id || estimations[0].id,
				name: names[2],
				amount: 11500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Network Administrator",
				isDeleted: false,
			},

			// Project 9 - Digital Marketing - January Payslips
			{
				id: "908f1f77bcf86cd799439035",
				payslipNumber: "PS-2025-025",
				estimationId: estimations[8]?.id || estimations[0].id,
				name: names[3],
				amount: 11000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Digital Marketing Manager",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439036",
				payslipNumber: "PS-2025-026",
				estimationId: estimations[8]?.id || estimations[0].id,
				name: names[4],
				amount: 8000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - SEO Specialist",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439037",
				payslipNumber: "PS-2025-027",
				estimationId: estimations[8]?.id || estimations[0].id,
				name: names[5],
				amount: 6000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Content Writer",
				isDeleted: false,
			},

			// Project 9 - February Payslips
			{
				id: "908f1f77bcf86cd799439038",
				payslipNumber: "PS-2025-028",
				estimationId: estimations[8]?.id || estimations[0].id,
				name: names[3],
				amount: 10500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Digital Marketing Manager",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439039",
				payslipNumber: "PS-2025-029",
				estimationId: estimations[8]?.id || estimations[0].id,
				name: names[4],
				amount: 7500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - SEO Specialist",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439040",
				payslipNumber: "PS-2025-030",
				estimationId: estimations[8]?.id || estimations[0].id,
				name: names[5],
				amount: 5800.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Content Writer",
				isDeleted: false,
			},

			// Project 10 - IoT Sensor Network - January Payslips
			{
				id: "908f1f77bcf86cd799439041",
				payslipNumber: "PS-2025-031",
				estimationId: estimations[9]?.id || estimations[0].id,
				name: names[6],
				amount: 13000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - IoT Engineer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439042",
				payslipNumber: "PS-2025-032",
				estimationId: estimations[9]?.id || estimations[0].id,
				name: names[7],
				amount: 12000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Firmware Developer",
				isDeleted: false,
			},

			// Project 10 - February Payslips
			{
				id: "908f1f77bcf86cd799439043",
				payslipNumber: "PS-2025-033",
				estimationId: estimations[9]?.id || estimations[0].id,
				name: names[6],
				amount: 12500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - IoT Engineer",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439044",
				payslipNumber: "PS-2025-034",
				estimationId: estimations[9]?.id || estimations[0].id,
				name: names[7],
				amount: 11500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Firmware Developer",
				isDeleted: false,
			},

			// Project 13 - AI-Powered Chatbot - January Payslips
			{
				id: "908f1f77bcf86cd799439045",
				payslipNumber: "PS-2025-035",
				estimationId: estimations[12]?.id || estimations[0].id,
				name: names[8],
				amount: 17000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - NLP Specialist",
				isDeleted: false,
			},

			// Project 13 - February Payslips
			{
				id: "908f1f77bcf86cd799439046",
				payslipNumber: "PS-2025-036",
				estimationId: estimations[12]?.id || estimations[0].id,
				name: names[8],
				amount: 16500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - NLP Specialist",
				isDeleted: false,
			},

			// Project 14 - Legacy System Modernization - January Payslips
			{
				id: "908f1f77bcf86cd799439047",
				payslipNumber: "PS-2025-037",
				estimationId: estimations[13]?.id || estimations[0].id,
				name: names[9],
				amount: 14000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Legacy Systems Expert",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439048",
				payslipNumber: "PS-2025-038",
				estimationId: estimations[13]?.id || estimations[0].id,
				name: names[0],
				amount: 18000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Microservices Architect",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439049",
				payslipNumber: "PS-2025-039",
				estimationId: estimations[13]?.id || estimations[0].id,
				name: names[1],
				amount: 12000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - Backend Developer",
				isDeleted: false,
			},

			// Project 14 - February Payslips
			{
				id: "908f1f77bcf86cd799439050",
				payslipNumber: "PS-2025-040",
				estimationId: estimations[13]?.id || estimations[0].id,
				name: names[9],
				amount: 13500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Legacy Systems Expert",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439051",
				payslipNumber: "PS-2025-041",
				estimationId: estimations[13]?.id || estimations[0].id,
				name: names[0],
				amount: 17500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Microservices Architect",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439052",
				payslipNumber: "PS-2025-042",
				estimationId: estimations[13]?.id || estimations[0].id,
				name: names[1],
				amount: 11500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - Backend Developer",
				isDeleted: false,
			},

			// Project 15 - API Gateway - January Payslips
			{
				id: "908f1f77bcf86cd799439053",
				payslipNumber: "PS-2025-043",
				estimationId: estimations[14]?.id || estimations[0].id,
				name: names[2],
				amount: 13000.0,
				paymentDate: new Date("2025-01-31"),
				notes: "January 2025 - API Developer",
				isDeleted: false,
			},

			// Project 15 - February Payslips
			{
				id: "908f1f77bcf86cd799439054",
				payslipNumber: "PS-2025-044",
				estimationId: estimations[14]?.id || estimations[0].id,
				name: names[2],
				amount: 12500.0,
				paymentDate: new Date("2025-02-28"),
				notes: "February 2025 - API Developer",
				isDeleted: false,
			},

			// Pending Payments (no payment date yet)
			{
				id: "908f1f77bcf86cd799439055",
				payslipNumber: "PS-2025-045",
				estimationId: estimations[0].id,
				name: names[0],
				amount: 11500.0,
				paymentDate: null,
				notes: "March 2025 - Senior Frontend Developer (Pending)",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439056",
				payslipNumber: "PS-2025-046",
				estimationId: estimations[1]?.id || estimations[0].id,
				name: names[3],
				amount: 13000.0,
				paymentDate: null,
				notes: "March 2025 - iOS Developer (Pending)",
				isDeleted: false,
			},
			{
				id: "908f1f77bcf86cd799439057",
				payslipNumber: "PS-2025-047",
				estimationId: estimations[6]?.id || estimations[0].id,
				name: names[1],
				amount: 14500.0,
				paymentDate: null,
				notes: "March 2025 - Security Engineer (Pending)",
				isDeleted: false,
			},
		];

		// Create payslips
		console.log("📝 Creating payslip records...");
		await prisma.payslip.createMany({
			data: payslipData.map((p, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...p, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${payslipData.length} payslip records`);

		// Calculate financial summary
		const totalAmount = payslipData.reduce((sum, item) => sum + item.amount, 0);
		const paidPayslips = payslipData.filter((p) => p.paymentDate !== null);
		const pendingPayslips = payslipData.filter((p) => p.paymentDate === null);
		const totalPaid = paidPayslips.reduce((sum, item) => sum + item.amount, 0);
		const totalPending = pendingPayslips.reduce((sum, item) => sum + item.amount, 0);

		// Count by month
		const januaryCount = payslipData.filter(
			(p) => p.paymentDate && p.paymentDate.getMonth() === 0,
		).length;
		const februaryCount = payslipData.filter(
			(p) => p.paymentDate && p.paymentDate.getMonth() === 1,
		).length;

		console.log("\n📊 Payslip Summary:");
		console.log(`   Payment Status:`);
		console.log(`   ✅ Paid: ${paidPayslips.length}`);
		console.log(`   ⏳ Pending: ${pendingPayslips.length}`);
		console.log(`\n   Monthly Breakdown:`);
		console.log(`   📅 January 2025: ${januaryCount} payslips`);
		console.log(`   📅 February 2025: ${februaryCount} payslips`);
		console.log(`   📅 March 2025 (Pending): ${pendingPayslips.length} payslips`);
		console.log(`\n   Financial Summary:`);
		console.log(`   💰 Total Amount: $${totalAmount.toLocaleString()}`);
		console.log(`   💵 Total Paid: $${totalPaid.toLocaleString()}`);
		console.log(`   ⏳ Total Pending: $${totalPending.toLocaleString()}`);
		console.log(`\n   📈 Total Payslips: ${payslipData.length}`);

		console.log("\n🎉 Payslip seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during payslip seeding:", error);
		throw error;
	}
}
