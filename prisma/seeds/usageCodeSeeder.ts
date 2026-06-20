import { PrismaClient } from "../../generated/prisma";

export async function seedUsageCode(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting usageCode seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	const usageCodeData = [
		{
			id: "608f1f77bcf86cd799440001",
			name: "Office Supplies",
			code: "OFF-SUP",
			description: "General office supplies including stationery, paper, and writing materials",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440002",
			name: "IT Equipment",
			code: "IT-EQUIP",
			description: "Computer hardware, servers, networking equipment, and IT infrastructure",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440003",
			name: "Software Licenses",
			code: "SW-LIC",
			description: "Software licensing, subscriptions, and digital tools",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440004",
			name: "Furniture",
			code: "FURN",
			description: "Office furniture including desks, chairs, cabinets, and storage",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440005",
			name: "Travel Expenses",
			code: "TRVL",
			description: "Business travel costs including transportation, accommodation, and meals",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440006",
			name: "Professional Services",
			code: "PROF-SVC",
			description: "Consulting, legal, accounting, and other professional services",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440007",
			name: "Training & Development",
			code: "TRN-DEV",
			description: "Employee training, courses, certifications, and professional development",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440008",
			name: "Telecommunications",
			code: "TELECOM",
			description: "Phone systems, mobile devices, internet, and communication services",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440009",
			name: "Utilities",
			code: "UTIL",
			description: "Electricity, water, gas, and other utility services",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440010",
			name: "Maintenance & Repairs",
			code: "MAINT",
			description: "Equipment maintenance, facility repairs, and support contracts",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440011",
			name: "Marketing & Advertising",
			code: "MKT-ADV",
			description: "Marketing campaigns, advertising, promotional materials, and branding",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440012",
			name: "Research & Development",
			code: "R-D",
			description: "Research activities, prototyping, and development initiatives",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440013",
			name: "Security Services",
			code: "SEC-SVC",
			description: "Physical security, cybersecurity tools, monitoring, and protection services",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440014",
			name: "Insurance",
			code: "INS",
			description: "Business insurance, liability coverage, and risk management",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440015",
			name: "Rent & Lease",
			code: "RENT",
			description: "Office space rental, equipment leasing, and facility costs",
			isDeleted: false,
		},
		{
			id: "608f1f77bcf86cd799440016",
			name: "Miscellaneous",
			code: "MISC",
			description: "Other uncategorized expenses and general operational costs",
			isDeleted: false,
		},
	];

	try {
		// Clear existing usageCodes
		console.log("🗑️  Clearing existing usageCodes...");
		await prisma.usageCode.deleteMany({});
		console.log("   ✓ UsageCodes deleted");

		// Create usageCodes
		console.log("📝 Creating usageCode records...");
		await prisma.usageCode.createMany({
			data: usageCodeData.map((u, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...u, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${usageCodeData.length} usageCode records`);

		// Display summary
		const withDescription = usageCodeData.filter((uc) => uc.description).length;
		const uniqueCodes = new Set(usageCodeData.map((uc) => uc.code)).size;

		console.log("\n📊 UsageCode Summary:");
		console.log(`   📝 With Description: ${withDescription}`);
		console.log(`   🔑 Unique Codes: ${uniqueCodes}`);
		console.log(`   📈 Total UsageCodes: ${usageCodeData.length}`);

		console.log("\n🎉 UsageCode seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during usageCode seeding:", error);
		throw error;
	}
}
