import { PrismaClient, FieldType, FieldCategory } from "../../generated/prisma";

// Category IDs from categorySeeder
const CATEGORY_IDS = {
	HUMAN_RESOURCE: "607f1f77bcf86cd799430001",
	HARDWARE: "607f1f77bcf86cd799430002",
	SOFTWARE: "607f1f77bcf86cd799430003",
	INFRASTRUCTURE: "607f1f77bcf86cd799430004",
	CONSULTING: "607f1f77bcf86cd799430005",
	TRAINING: "607f1f77bcf86cd799430006",
	NETWORKING: "607f1f77bcf86cd799430007",
	SECURITY: "607f1f77bcf86cd799430008",
	OFFICE_SUPPLIES: "607f1f77bcf86cd799430009",
	TELECOMMUNICATIONS: "607f1f77bcf86cd799430010",
	MAINTENANCE: "607f1f77bcf86cd799430011",
	MISCELLANEOUS: "607f1f77bcf86cd799430012",
};

export async function seedField(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting field seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	const fieldData = [
		// ==========================================
		// COMMON FIELDS (No category - available to all)
		// ==========================================
		{
			id: "608f1f77bcf86cd799440001",
			name: "projectCode",
			label: "Project Code",
			type: FieldType.singletext,
			category: FieldCategory.common,
			placeholder: "Enter project code",
			required: false,
			sortOrder: 1,
			value: null,
			categoryId: null,
		},
		{
			id: "608f1f77bcf86cd799440002",
			name: "vendorName",
			label: "Vendor Name",
			type: FieldType.singletext,
			category: FieldCategory.common,
			placeholder: "Enter vendor name",
			required: false,
			sortOrder: 2,
			value: null,
			categoryId: null,
		},
		{
			id: "608f1f77bcf86cd799440003",
			name: "priorityLevel",
			label: "Priority Level",
			type: FieldType.number,
			category: FieldCategory.common,
			placeholder: "1-5",
			required: false,
			sortOrder: 3,
			value: { min: 1, max: 5, default: 3 },
			categoryId: null,
		},
		{
			id: "608f1f77bcf86cd799440005",
			name: "deliveryDate",
			label: "Delivery Date",
			type: FieldType.date,
			category: FieldCategory.common,
			placeholder: "Select delivery date",
			required: false,
			sortOrder: 5,
			value: null,
			categoryId: null,
		},
		{
			id: "608f1f77bcf86cd799440007",
			name: "riskLevel",
			label: "Risk Level",
			type: FieldType.singleselect,
			category: FieldCategory.common,
			placeholder: "Select risk level",
			required: false,
			sortOrder: 7,
			value: {
				options: [
					{ label: "Low", value: "low", color: "#10B981" },
					{ label: "Medium", value: "medium", color: "#F59E0B" },
					{ label: "High", value: "high", color: "#EF4444" },
					{ label: "Critical", value: "critical", color: "#7C3AED" },
				],
			},
			categoryId: null,
		},
		{
			id: "608f1f77bcf86cd799440009",
			name: "tags",
			label: "Tags",
			type: FieldType.multipleselect,
			category: FieldCategory.common,
			placeholder: "Select tags",
			required: false,
			sortOrder: 9,
			value: {
				options: [
					{ label: "Urgent", value: "urgent", color: "#EF4444" },
					{ label: "Important", value: "important", color: "#F59E0B" },
					{ label: "Review", value: "review", color: "#3B82F6" },
					{ label: "Approved", value: "approved", color: "#10B981" },
					{ label: "On Hold", value: "onhold", color: "#6B7280" },
				],
			},
			categoryId: null,
		},
		{
			id: "608f1f77bcf86cd799440013",
			name: "notes",
			label: "Notes",
			type: FieldType.multitext,
			category: FieldCategory.common,
			placeholder: "Enter notes...",
			required: false,
			sortOrder: 13,
			value: null,
			categoryId: null,
		},

		// ==========================================
		// HUMAN RESOURCE CATEGORY FIELDS
		// ==========================================
		{
			id: "608f1f77bcf86cd799440101",
			name: "assignedEmployee",
			label: "Assigned Employee",
			type: FieldType.employee,
			category: FieldCategory.custom,
			placeholder: "Select an employee",
			required: true,
			sortOrder: 1,
			value: { allowMultiple: false },
			categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
		},
		{
			id: "608f1f77bcf86cd799440102",
			name: "employmentPeriod",
			label: "Employment Period",
			type: FieldType.singleselect,
			category: FieldCategory.custom,
			placeholder: "Select period",
			required: false,
			sortOrder: 2,
			value: {
				options: [
					{ label: "1 Month", value: "1_month" },
					{ label: "3 Months", value: "3_months" },
					{ label: "6 Months", value: "6_months" },
					{ label: "1 Year", value: "1_year" },
					{ label: "Permanent", value: "permanent" },
				],
			},
			categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
		},
		{
			id: "608f1f77bcf86cd799440103",
			name: "startDate",
			label: "Start Date",
			type: FieldType.date,
			category: FieldCategory.custom,
			placeholder: "Select start date",
			required: false,
			sortOrder: 3,
			value: null,
			categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
		},
		{
			id: "608f1f77bcf86cd799440104",
			name: "endDate",
			label: "End Date",
			type: FieldType.date,
			category: FieldCategory.custom,
			placeholder: "Select end date",
			required: false,
			sortOrder: 4,
			value: null,
			categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
		},
		{
			id: "608f1f77bcf86cd799440105",
			name: "billableRate",
			label: "Billable Rate (per hour)",
			type: FieldType.number,
			category: FieldCategory.custom,
			placeholder: "Enter hourly rate",
			required: false,
			sortOrder: 5,
			value: { min: 0, currency: "PHP" },
			categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
		},
		{
			id: "608f1f77bcf86cd799440106",
			name: "roleInProject",
			label: "Role in Project",
			type: FieldType.singleselect,
			category: FieldCategory.custom,
			placeholder: "Select role",
			required: false,
			sortOrder: 6,
			value: {
				options: [
					{ label: "Project Manager", value: "pm" },
					{ label: "Developer", value: "developer" },
					{ label: "Designer", value: "designer" },
					{ label: "QA Engineer", value: "qa" },
					{ label: "Business Analyst", value: "ba" },
					{ label: "Technical Lead", value: "tech_lead" },
					{ label: "Consultant", value: "consultant" },
				],
			},
			categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
		},

		// ==========================================
		// HARDWARE CATEGORY FIELDS
		// ==========================================
		{
			id: "608f1f77bcf86cd799440201",
			name: "manufacturer",
			label: "Manufacturer",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter manufacturer name",
			required: false,
			sortOrder: 1,
			value: null,
			categoryId: CATEGORY_IDS.HARDWARE,
		},
		{
			id: "608f1f77bcf86cd799440202",
			name: "modelNumber",
			label: "Model Number",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter model number",
			required: false,
			sortOrder: 2,
			value: null,
			categoryId: CATEGORY_IDS.HARDWARE,
		},
		{
			id: "608f1f77bcf86cd799440203",
			name: "serialNumber",
			label: "Serial Number",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter serial number",
			required: false,
			sortOrder: 3,
			value: null,
			categoryId: CATEGORY_IDS.HARDWARE,
		},
		{
			id: "608f1f77bcf86cd799440204",
			name: "warrantyExpiry",
			label: "Warranty Expiry",
			type: FieldType.date,
			category: FieldCategory.custom,
			placeholder: "Select warranty expiry date",
			required: false,
			sortOrder: 4,
			value: null,
			categoryId: CATEGORY_IDS.HARDWARE,
		},
		{
			id: "608f1f77bcf86cd799440205",
			name: "specifications",
			label: "Technical Specifications",
			type: FieldType.object,
			category: FieldCategory.custom,
			placeholder: "Enter specifications as JSON",
			required: false,
			sortOrder: 5,
			value: {
				schema: {
					cpu: "string",
					memory: "string",
					storage: "string",
					display: "string",
				},
			},
			categoryId: CATEGORY_IDS.HARDWARE,
		},

		// ==========================================
		// SOFTWARE CATEGORY FIELDS
		// ==========================================
		{
			id: "608f1f77bcf86cd799440301",
			name: "licenseType",
			label: "License Type",
			type: FieldType.singleselect,
			category: FieldCategory.custom,
			placeholder: "Select license type",
			required: false,
			sortOrder: 1,
			value: {
				options: [
					{ label: "Perpetual", value: "perpetual" },
					{ label: "Subscription (Monthly)", value: "subscription_monthly" },
					{ label: "Subscription (Annual)", value: "subscription_annual" },
					{ label: "Open Source", value: "open_source" },
					{ label: "Enterprise", value: "enterprise" },
				],
			},
			categoryId: CATEGORY_IDS.SOFTWARE,
		},
		{
			id: "608f1f77bcf86cd799440302",
			name: "licenseKey",
			label: "License Key",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter license key",
			required: false,
			sortOrder: 2,
			value: null,
			categoryId: CATEGORY_IDS.SOFTWARE,
		},
		{
			id: "608f1f77bcf86cd799440303",
			name: "numberOfSeats",
			label: "Number of Seats/Users",
			type: FieldType.number,
			category: FieldCategory.custom,
			placeholder: "Enter number of seats",
			required: false,
			sortOrder: 3,
			value: { min: 1 },
			categoryId: CATEGORY_IDS.SOFTWARE,
		},
		{
			id: "608f1f77bcf86cd799440304",
			name: "renewalDate",
			label: "Renewal Date",
			type: FieldType.date,
			category: FieldCategory.custom,
			placeholder: "Select renewal date",
			required: false,
			sortOrder: 4,
			value: null,
			categoryId: CATEGORY_IDS.SOFTWARE,
		},

		// ==========================================
		// CONSULTING CATEGORY FIELDS
		// ==========================================
		{
			id: "608f1f77bcf86cd799440501",
			name: "consultantName",
			label: "Consultant Name",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter consultant name",
			required: false,
			sortOrder: 1,
			value: null,
			categoryId: CATEGORY_IDS.CONSULTING,
		},
		{
			id: "608f1f77bcf86cd799440502",
			name: "consultingFirm",
			label: "Consulting Firm",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter firm name",
			required: false,
			sortOrder: 2,
			value: null,
			categoryId: CATEGORY_IDS.CONSULTING,
		},
		{
			id: "608f1f77bcf86cd799440503",
			name: "engagementType",
			label: "Engagement Type",
			type: FieldType.singleselect,
			category: FieldCategory.custom,
			placeholder: "Select engagement type",
			required: false,
			sortOrder: 3,
			value: {
				options: [
					{ label: "Fixed Price", value: "fixed" },
					{ label: "Time & Materials", value: "time_materials" },
					{ label: "Retainer", value: "retainer" },
					{ label: "Milestone-based", value: "milestone" },
				],
			},
			categoryId: CATEGORY_IDS.CONSULTING,
		},
		{
			id: "608f1f77bcf86cd799440504",
			name: "deliverables",
			label: "Deliverables",
			type: FieldType.multitext,
			category: FieldCategory.custom,
			placeholder: "List expected deliverables",
			required: false,
			sortOrder: 4,
			value: null,
			categoryId: CATEGORY_IDS.CONSULTING,
		},

		// ==========================================
		// TRAINING CATEGORY FIELDS
		// ==========================================
		{
			id: "608f1f77bcf86cd799440601",
			name: "trainingProvider",
			label: "Training Provider",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter provider name",
			required: false,
			sortOrder: 1,
			value: null,
			categoryId: CATEGORY_IDS.TRAINING,
		},
		{
			id: "608f1f77bcf86cd799440602",
			name: "trainingType",
			label: "Training Type",
			type: FieldType.singleselect,
			category: FieldCategory.custom,
			placeholder: "Select training type",
			required: false,
			sortOrder: 2,
			value: {
				options: [
					{ label: "Online Course", value: "online" },
					{ label: "In-Person Workshop", value: "workshop" },
					{ label: "Certification", value: "certification" },
					{ label: "Conference", value: "conference" },
					{ label: "Bootcamp", value: "bootcamp" },
				],
			},
			categoryId: CATEGORY_IDS.TRAINING,
		},
		{
			id: "608f1f77bcf86cd799440603",
			name: "participants",
			label: "Number of Participants",
			type: FieldType.number,
			category: FieldCategory.custom,
			placeholder: "Enter number of participants",
			required: false,
			sortOrder: 3,
			value: { min: 1 },
			categoryId: CATEGORY_IDS.TRAINING,
		},
		{
			id: "608f1f77bcf86cd799440604",
			name: "trainingDate",
			label: "Training Date",
			type: FieldType.date,
			category: FieldCategory.custom,
			placeholder: "Select training date",
			required: false,
			sortOrder: 4,
			value: null,
			categoryId: CATEGORY_IDS.TRAINING,
		},

		// ==========================================
		// MAINTENANCE CATEGORY FIELDS
		// ==========================================
		{
			id: "608f1f77bcf86cd799440701",
			name: "maintenanceType",
			label: "Maintenance Type",
			type: FieldType.singleselect,
			category: FieldCategory.custom,
			placeholder: "Select maintenance type",
			required: false,
			sortOrder: 1,
			value: {
				options: [
					{ label: "Preventive", value: "preventive" },
					{ label: "Corrective", value: "corrective" },
					{ label: "Emergency", value: "emergency" },
					{ label: "Scheduled", value: "scheduled" },
				],
			},
			categoryId: CATEGORY_IDS.MAINTENANCE,
		},
		{
			id: "608f1f77bcf86cd799440702",
			name: "assetName",
			label: "Asset/Equipment Name",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter asset name",
			required: false,
			sortOrder: 2,
			value: null,
			categoryId: CATEGORY_IDS.MAINTENANCE,
		},
		{
			id: "608f1f77bcf86cd799440703",
			name: "serviceProvider",
			label: "Service Provider",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter service provider name",
			required: false,
			sortOrder: 3,
			value: null,
			categoryId: CATEGORY_IDS.MAINTENANCE,
		},
		{
			id: "608f1f77bcf86cd799440704",
			name: "scheduledDate",
			label: "Scheduled Date",
			type: FieldType.date,
			category: FieldCategory.custom,
			placeholder: "Select scheduled date",
			required: false,
			sortOrder: 4,
			value: null,
			categoryId: CATEGORY_IDS.MAINTENANCE,
		},
		{
			id: "608f1f77bcf86cd799440705",
			name: "completionDate",
			label: "Completion Date",
			type: FieldType.date,
			category: FieldCategory.custom,
			placeholder: "Select completion date",
			required: false,
			sortOrder: 5,
			value: null,
			categoryId: CATEGORY_IDS.MAINTENANCE,
		},

		// ==========================================
		// OFFICE SUPPLIES CATEGORY FIELDS
		// ==========================================
		{
			id: "608f1f77bcf86cd799440801",
			name: "supplier",
			label: "Supplier",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter supplier name",
			required: false,
			sortOrder: 1,
			value: null,
			categoryId: CATEGORY_IDS.OFFICE_SUPPLIES,
		},
		{
			id: "608f1f77bcf86cd799440802",
			name: "reorderLevel",
			label: "Reorder Level",
			type: FieldType.number,
			category: FieldCategory.custom,
			placeholder: "Enter reorder threshold",
			required: false,
			sortOrder: 2,
			value: { min: 0 },
			categoryId: CATEGORY_IDS.OFFICE_SUPPLIES,
		},
		{
			id: "608f1f77bcf86cd799440803",
			name: "storageLocation",
			label: "Storage Location",
			type: FieldType.singletext,
			category: FieldCategory.custom,
			placeholder: "Enter storage location",
			required: false,
			sortOrder: 3,
			value: null,
			categoryId: CATEGORY_IDS.OFFICE_SUPPLIES,
		},

		// ==========================================
		// INFRASTRUCTURE CATEGORY FIELDS
		// ==========================================
		{
			id: "608f1f77bcf86cd799440901",
			name: "infrastructureType",
			label: "Infrastructure Type",
			type: FieldType.singleselect,
			category: FieldCategory.custom,
			placeholder: "Select type",
			required: false,
			sortOrder: 1,
			value: {
				options: [
					{ label: "Cloud Services", value: "cloud" },
					{ label: "On-Premise Server", value: "onprem" },
					{ label: "Networking Equipment", value: "network" },
					{ label: "Data Center", value: "datacenter" },
					{ label: "Storage", value: "storage" },
				],
			},
			categoryId: CATEGORY_IDS.INFRASTRUCTURE,
		},
		{
			id: "608f1f77bcf86cd799440902",
			name: "cloudProvider",
			label: "Cloud Provider",
			type: FieldType.singleselect,
			category: FieldCategory.custom,
			placeholder: "Select provider",
			required: false,
			sortOrder: 2,
			value: {
				options: [
					{ label: "AWS", value: "aws" },
					{ label: "Azure", value: "azure" },
					{ label: "Google Cloud", value: "gcp" },
					{ label: "Digital Ocean", value: "digitalocean" },
					{ label: "Other", value: "other" },
				],
			},
			categoryId: CATEGORY_IDS.INFRASTRUCTURE,
		},
		{
			id: "608f1f77bcf86cd799440903",
			name: "monthlyRecurringCost",
			label: "Monthly Recurring Cost",
			type: FieldType.number,
			category: FieldCategory.custom,
			placeholder: "Enter monthly cost",
			required: false,
			sortOrder: 3,
			value: { min: 0, currency: "PHP" },
			categoryId: CATEGORY_IDS.INFRASTRUCTURE,
		},
	];

	try {
		// Clear existing fields
		console.log("🗑️  Clearing existing fields...");
		await prisma.field.deleteMany({});
		console.log("   ✓ Fields deleted");

		// Create fields
		console.log("📝 Creating field records...");
		await prisma.field.createMany({
			data: fieldData.map((f, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...f, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${fieldData.length} field records`);

		// Display summary
		const commonFields = fieldData.filter((f) => f.category === "common").length;
		const customFields = fieldData.filter((f) => f.category === "custom").length;
		const fieldsWithCategory = fieldData.filter((f) => f.categoryId).length;

		const fieldsByType = fieldData.reduce(
			(acc, f) => {
				acc[f.type] = (acc[f.type] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		);

		const fieldsByCategory = fieldData.reduce(
			(acc, f) => {
				const catName = f.categoryId
					? Object.entries(CATEGORY_IDS).find(([_, id]) => id === f.categoryId)?.[0] || "Unknown"
					: "Common (No Category)";
				acc[catName] = (acc[catName] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		);

		console.log("\n📊 Field Summary:");
		console.log(`   🔵 Common Fields: ${commonFields}`);
		console.log(`   🟣 Custom Fields: ${customFields}`);
		console.log(`   🏷️  Fields with Category: ${fieldsWithCategory}`);

		console.log("\n   📋 Fields by Type:");
		Object.entries(fieldsByType).forEach(([type, count]) => {
			console.log(`      - ${type}: ${count}`);
		});

		console.log("\n   🏢 Fields by Category:");
		Object.entries(fieldsByCategory).forEach(([cat, count]) => {
			console.log(`      - ${cat}: ${count}`);
		});

		console.log(`\n   📈 Total Fields: ${fieldData.length}`);

		console.log("\n🎉 Field seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during field seeding:", error);
		throw error;
	}
}
