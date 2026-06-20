import { PrismaClient, ItemStatus } from "../../generated/prisma";
import {
	updateEstimationTotalsAndMetadata,
	updateProjectBudgetMetadata,
	updateProjectFinancials,
	updateProjectProgress,
} from "../../utils/calculations";

export async function seedItem(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting item seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		// Get existing estimations and orders to create relationships
		const estimations = await prisma.estimation.findMany({
			take: 105,
			select: { id: true, projectId: true },
		});
		const orders = await prisma.order.findMany({ take: 35 });
		const milestones = await prisma.milestone.findMany({
			where: { workspaceId: { in: orgIds }, isDeleted: false },
			select: { id: true, projectId: true, estimationId: true },
		});
		const purchaseOrders = await prisma.purchaseOrder.findMany({
			take: 10,
			select: { id: true, estimationId: true },
		});

		if (estimations.length === 0) {
			console.log("⚠️  No estimations found. Please seed estimations first.");
			return;
		}

		console.log("ℹ️  Item seeding: Data cleanup handled by projectSeeder");

		// Build milestone lookup maps so seeded items can reference milestones
		const milestonesByProjectId = new Map<string, string[]>();
		const milestoneProjectIdById = new Map<string, string | null>();
		for (const m of milestones) {
			milestoneProjectIdById.set(m.id, m.projectId ?? null);
			if (m.projectId) {
				const existing = milestonesByProjectId.get(m.projectId) || [];
				existing.push(m.id);
				milestonesByProjectId.set(m.projectId, existing);
			}
		}

		const estimationToProjectId = new Map<string, string>();
		for (const e of estimations) {
			if (e.projectId) estimationToProjectId.set(e.id, e.projectId);
		}

		const hashString = (s: string) => {
			let h = 0;
			for (let i = 0; i < s.length; i++) {
				h = (h * 31 + s.charCodeAt(i)) >>> 0;
			}
			return h;
		};

		const pickDeterministic = (list: string[], key: string) => list[hashString(key) % list.length];

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

		// Field IDs from fieldSeeder
		const FIELD_IDS = {
			// Common fields
			PROJECT_CODE: "608f1f77bcf86cd799440001",
			VENDOR_NAME: "608f1f77bcf86cd799440002",
			PRIORITY_LEVEL: "608f1f77bcf86cd799440003",
			DELIVERY_DATE: "608f1f77bcf86cd799440005",
			RISK_LEVEL: "608f1f77bcf86cd799440007",
			DEPARTMENT: "608f1f77bcf86cd799440008",
			TAGS: "608f1f77bcf86cd799440009",
			ASSIGNED_TO: "608f1f77bcf86cd799440011",
			NOTES: "608f1f77bcf86cd799440013",
			TECHNICAL_SPECS: "608f1f77bcf86cd799440015",
			// Human Resource category fields
			HR_ASSIGNED_EMPLOYEE: "608f1f77bcf86cd799440101",
			HR_EMPLOYMENT_PERIOD: "608f1f77bcf86cd799440102",
			HR_START_DATE: "608f1f77bcf86cd799440103",
			HR_END_DATE: "608f1f77bcf86cd799440104",
			HR_BILLABLE_RATE: "608f1f77bcf86cd799440105",
			HR_ROLE_IN_PROJECT: "608f1f77bcf86cd799440106",
			// Hardware category fields
			HW_MANUFACTURER: "608f1f77bcf86cd799440201",
			HW_MODEL_NUMBER: "608f1f77bcf86cd799440202",
			HW_SERIAL_NUMBER: "608f1f77bcf86cd799440203",
			HW_WARRANTY_EXPIRY: "608f1f77bcf86cd799440204",
			HW_SPECIFICATIONS: "608f1f77bcf86cd799440205",
			// Software category fields
			SW_LICENSE_TYPE: "608f1f77bcf86cd799440301",
			SW_LICENSE_KEY: "608f1f77bcf86cd799440302",
			SW_NUMBER_OF_SEATS: "608f1f77bcf86cd799440303",
			SW_RENEWAL_DATE: "608f1f77bcf86cd799440304",
			// Consulting category fields
			CONSULT_NAME: "608f1f77bcf86cd799440501",
			CONSULT_FIRM: "608f1f77bcf86cd799440502",
			CONSULT_ENGAGEMENT_TYPE: "608f1f77bcf86cd799440503",
			CONSULT_DELIVERABLES: "608f1f77bcf86cd799440504",
			// Training category fields
			TRAIN_PROVIDER: "608f1f77bcf86cd799440601",
			TRAIN_TYPE: "608f1f77bcf86cd799440602",
			TRAIN_PARTICIPANTS: "608f1f77bcf86cd799440603",
			TRAIN_DATE: "608f1f77bcf86cd799440604",
		};

		// Employee IDs from employeeSeeder (for Human Resource items)
		const EMPLOYEE_IDS = {
			JOHN_DOE: "609f1f77bcf86cd799450001",
			JANE_SMITH: "609f1f77bcf86cd799450002",
			MICHAEL_JOHNSON: "609f1f77bcf86cd799450003",
			EMILY_BROWN: "609f1f77bcf86cd799450004",
			DAVID_WILSON: "609f1f77bcf86cd799450005",
			SARAH_DAVIS: "609f1f77bcf86cd799450006",
			ROBERT_MARTINEZ: "609f1f77bcf86cd799450007",
			LISA_ANDERSON: "609f1f77bcf86cd799450008",
			JAMES_TAYLOR: "609f1f77bcf86cd799450009",
			JENNIFER_THOMAS: "609f1f77bcf86cd799450010",
		};

		const itemData = [
			// ============================================
			// CAPEX ITEMS
			// ============================================

			// Project 1 - Corporate Website Redesign
			{
				id: "708f1f77bcf86cd799439011",
				estimationId: estimations[0].id,
				orderId: orders[0]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Development Workstation - Dell Precision",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2500.0,
				estimatedTotal: 12500.0,
				actualUnitPrice: 2400.0,
				actualTotal: 12000.0,
				estimationPoints: 5,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-01-10"),
				endDate: new Date("2024-01-15"),
				parentItemId: null,
				isDeleted: false,
				fields: {
					common: [
						{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
						{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
						{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
						{ fieldId: FIELD_IDS.TAGS, value: ["Important", "Approved"] },
					],
					custom: [
						{ fieldId: FIELD_IDS.HW_MANUFACTURER, value: "Dell" },
						{ fieldId: FIELD_IDS.HW_MODEL_NUMBER, value: "Precision 5820" },
						{ fieldId: FIELD_IDS.HW_SERIAL_NUMBER, value: "DL5820-001-2024" },
						{ fieldId: FIELD_IDS.HW_WARRANTY_EXPIRY, value: new Date("2027-01-15") },
						{ fieldId: FIELD_IDS.HW_SPECIFICATIONS, value: { cpu: "Intel i9-13900K", memory: "64GB DDR5", storage: "2TB NVMe SSD", display: "N/A" } },
					],
				},
			},
			{
				id: "708f1f77bcf86cd799439012",
				estimationId: estimations[0].id,
				orderId: orders[2]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "4K Monitor - 27 inch",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 600.0,
				estimatedTotal: 3000.0,
				actualUnitPrice: 550.0,
				actualTotal: 2750.0,
				estimationPoints: 3,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-01-10"),
				endDate: new Date("2024-01-15"),
				parentItemId: null,
				isDeleted: false,
				fields: {
					common: [
						{ fieldId: FIELD_IDS.VENDOR_NAME, value: "Dell Technologies" },
						{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
						{ fieldId: FIELD_IDS.DELIVERY_DATE, value: new Date("2024-01-12") },
					],
					custom: [
						{ fieldId: FIELD_IDS.HW_MANUFACTURER, value: "Dell" },
						{ fieldId: FIELD_IDS.HW_MODEL_NUMBER, value: "U2723QE" },
						{ fieldId: FIELD_IDS.HW_WARRANTY_EXPIRY, value: new Date("2027-01-12") },
						{ fieldId: FIELD_IDS.HW_SPECIFICATIONS, value: { cpu: "N/A", memory: "N/A", storage: "N/A", display: "4K UHD (3840x2160), IPS Panel, 60Hz, USB-C" } },
					],
				},
			},

			// Project 2 - Mobile App Development
			{
				id: "708f1f77bcf86cd799439013",
				estimationId: estimations[1]?.id || estimations[0].id,
				orderId: orders[1]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: 'MacBook Pro 16" for iOS Development',
				estimatedQuantity: 3,
				actualQuantity: 3,
				estimatedUnitPrice: 3200.0,
				estimatedTotal: 9600.0,
				actualUnitPrice: 3100.0,
				actualTotal: 9300.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-02-01"),
				endDate: new Date("2024-02-10"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "708f1f77bcf86cd799439014",
				estimationId: estimations[1]?.id || estimations[0].id,
				orderId: orders[31]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "iPhone 15 Pro - Testing Device",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 1200.0,
				estimatedTotal: 6000.0,
				actualUnitPrice: 1150.0,
				actualTotal: 5750.0,
				estimationPoints: 5,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-02-05"),
				endDate: new Date("2024-02-08"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "708f1f77bcf86cd799439015",
				estimationId: estimations[1]?.id || estimations[0].id,
				orderId: orders[30]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Samsung Galaxy Tab S9 - Testing Device",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 800.0,
				estimatedTotal: 4000.0,
				actualUnitPrice: 750.0,
				actualTotal: 3750.0,
				estimationPoints: 5,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-02-05"),
				endDate: new Date("2024-02-08"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 3 - Cloud Infrastructure Migration
			{
				id: "708f1f77bcf86cd799439016",
				estimationId: estimations[2]?.id || estimations[0].id,
				orderId: orders[21]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Dell PowerEdge R750 Server",
				estimatedQuantity: 4,
				actualQuantity: null,
				estimatedUnitPrice: 8500.0,
				estimatedTotal: 34000.0,
				actualUnitPrice: null,
				actualTotal: null,
				estimationPoints: 13,
				status: ItemStatus.IN_PROGRESS,
				startDate: new Date("2024-03-01"),
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "708f1f77bcf86cd799439017",
				estimationId: estimations[2]?.id || estimations[0].id,
				orderId: orders[22]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Network Storage - NAS 48TB",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 5500.0,
				estimatedTotal: 11000.0,
				actualUnitPrice: 5200.0,
				actualTotal: 10400.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-03-05"),
				endDate: new Date("2024-03-12"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 4 - E-commerce Platform
			{
				id: "708f1f77bcf86cd799439018",
				estimationId: estimations[3]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.NETWORKING,
				itemName: "Load Balancer Hardware",
				estimatedQuantity: 2,
				actualQuantity: null,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: null,
				actualTotal: null,
				estimationPoints: 13,
				status: ItemStatus.PENDING,
				startDate: null,
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "708f1f77bcf86cd799439019",
				estimationId: estimations[3]?.id || estimations[0].id,
				orderId: orders[32]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.OFFICE_SUPPLIES,
				itemName: "HP Enterprise Printer",
				estimatedQuantity: 3,
				actualQuantity: 3,
				estimatedUnitPrice: 1800.0,
				estimatedTotal: 5400.0,
				actualUnitPrice: 1750.0,
				actualTotal: 5250.0,
				estimationPoints: 3,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-04-01"),
				endDate: new Date("2024-04-05"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 5 - Data Analytics Dashboard
			{
				id: "708f1f77bcf86cd799439020",
				estimationId: estimations[4]?.id || estimations[0].id,
				orderId: orders[0]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "High-Performance Workstation",
				estimatedQuantity: 4,
				actualQuantity: 4,
				estimatedUnitPrice: 3500.0,
				estimatedTotal: 14000.0,
				actualUnitPrice: 3400.0,
				actualTotal: 13600.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-05-01"),
				endDate: new Date("2024-05-10"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "708f1f77bcf86cd799439021",
				estimationId: estimations[4]?.id || estimations[0].id,
				orderId: orders[2]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Dual 4K Monitor Setup",
				estimatedQuantity: 4,
				actualQuantity: 4,
				estimatedUnitPrice: 1200.0,
				estimatedTotal: 4800.0,
				actualUnitPrice: 1100.0,
				actualTotal: 4400.0,
				estimationPoints: 5,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-05-01"),
				endDate: new Date("2024-05-05"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 6 - CRM System Customization
			{
				id: "708f1f77bcf86cd799439022",
				estimationId: estimations[5]?.id || estimations[0].id,
				orderId: orders[1]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Laptop for CRM Consultants",
				estimatedQuantity: 3,
				actualQuantity: 3,
				estimatedUnitPrice: 1800.0,
				estimatedTotal: 5400.0,
				actualUnitPrice: 1750.0,
				actualTotal: 5250.0,
				estimationPoints: 5,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-06-07"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 7 - Network Security Upgrade
			{
				id: "708f1f77bcf86cd799439023",
				estimationId: estimations[6]?.id || estimations[0].id,
				orderId: orders[7]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.NETWORKING,
				itemName: "Cisco Catalyst Switch",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 4200.0,
				estimatedTotal: 21000.0,
				actualUnitPrice: 4100.0,
				actualTotal: 20500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-07-01"),
				endDate: new Date("2024-07-10"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "708f1f77bcf86cd799439024",
				estimationId: estimations[6]?.id || estimations[0].id,
				orderId: orders[29]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.SECURITY,
				itemName: "Fortinet Firewall",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 8500.0,
				estimatedTotal: 17000.0,
				actualUnitPrice: 8200.0,
				actualTotal: 16400.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-07-05"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "708f1f77bcf86cd799439025",
				estimationId: estimations[6]?.id || estimations[0].id,
				orderId: orders[8]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.NETWORKING,
				itemName: "Wireless Access Points",
				estimatedQuantity: 15,
				actualQuantity: 15,
				estimatedUnitPrice: 350.0,
				estimatedTotal: 5250.0,
				actualUnitPrice: 320.0,
				actualTotal: 4800.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-07-08"),
				endDate: new Date("2024-07-20"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Office Furniture & Equipment
			{
				id: "708f1f77bcf86cd799439035",
				estimationId: estimations[0].id,
				orderId: orders[9]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.OFFICE_SUPPLIES,
				itemName: "Herman Miller Office Chairs",
				estimatedQuantity: 12,
				actualQuantity: 12,
				estimatedUnitPrice: 1200.0,
				estimatedTotal: 14400.0,
				actualUnitPrice: 1150.0,
				actualTotal: 13800.0,
				estimationPoints: 5,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-01-20"),
				endDate: new Date("2024-01-25"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "708f1f77bcf86cd799439036",
				estimationId: estimations[0].id,
				orderId: orders[10]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.OFFICE_SUPPLIES,
				itemName: "Electric Standing Desks",
				estimatedQuantity: 12,
				actualQuantity: 12,
				estimatedUnitPrice: 850.0,
				estimatedTotal: 10200.0,
				actualUnitPrice: 800.0,
				actualTotal: 9600.0,
				estimationPoints: 5,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-01-20"),
				endDate: new Date("2024-01-25"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// ============================================
			// OPEX ITEMS
			// ============================================

			// Project 1 - Corporate Website Redesign - Human Resources
			{
				id: "808f1f77bcf86cd799439011",
				estimationId: estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Senior Frontend Developer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-01-01"),
				endDate: new Date("2024-03-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{ fieldId: FIELD_IDS.HR_ASSIGNED_EMPLOYEE, value: EMPLOYEE_IDS.JOHN_DOE },
					{ fieldId: FIELD_IDS.HR_EMPLOYMENT_PERIOD, value: "6_months" },
					{ fieldId: FIELD_IDS.HR_START_DATE, value: new Date("2024-01-01") },
					{ fieldId: FIELD_IDS.HR_END_DATE, value: new Date("2024-06-30") },
					{ fieldId: FIELD_IDS.HR_BILLABLE_RATE, value: 750 },
					{ fieldId: FIELD_IDS.HR_ROLE_IN_PROJECT, value: "developer" },
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439012",
				estimationId: estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "UI/UX Designer",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 10000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 9500.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-01-01"),
				endDate: new Date("2024-03-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{ fieldId: FIELD_IDS.HR_ASSIGNED_EMPLOYEE, value: EMPLOYEE_IDS.MICHAEL_JOHNSON },
					{ fieldId: FIELD_IDS.HR_EMPLOYMENT_PERIOD, value: "3_months" },
					{ fieldId: FIELD_IDS.HR_START_DATE, value: new Date("2024-01-01") },
					{ fieldId: FIELD_IDS.HR_END_DATE, value: new Date("2024-03-31") },
					{ fieldId: FIELD_IDS.HR_BILLABLE_RATE, value: 600 },
					{ fieldId: FIELD_IDS.HR_ROLE_IN_PROJECT, value: "designer" },
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439013",
				estimationId: estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Project Manager",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 13000.0,
				estimatedTotal: 13000.0,
				actualUnitPrice: 12500.0,
				actualTotal: 12500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-01-01"),
				endDate: new Date("2024-03-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{ fieldId: FIELD_IDS.HR_ASSIGNED_EMPLOYEE, value: EMPLOYEE_IDS.JANE_SMITH },
					{ fieldId: FIELD_IDS.HR_EMPLOYMENT_PERIOD, value: "permanent" },
					{ fieldId: FIELD_IDS.HR_START_DATE, value: new Date("2024-01-01") },
					{ fieldId: FIELD_IDS.HR_BILLABLE_RATE, value: 950 },
					{ fieldId: FIELD_IDS.HR_ROLE_IN_PROJECT, value: "pm" },
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439014",
				estimationId: estimations[0].id,
				orderId: orders[4]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.SOFTWARE,
				itemName: "Adobe Creative Cloud Licenses",
				estimatedQuantity: 3,
				actualQuantity: 3,
				estimatedUnitPrice: 85.0,
				estimatedTotal: 255.0,
				actualUnitPrice: 80.0,
				actualTotal: 240.0,
				estimationPoints: 2,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-01-05"),
				endDate: new Date("2024-01-05"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{ fieldId: FIELD_IDS.SW_LICENSE_TYPE, value: "subscription_annual" },
					{ fieldId: FIELD_IDS.SW_LICENSE_KEY, value: "ADCC-XXXX-XXXX-XXXX-XXXX" },
					{ fieldId: FIELD_IDS.SW_NUMBER_OF_SEATS, value: 3 },
					{ fieldId: FIELD_IDS.SW_RENEWAL_DATE, value: new Date("2025-01-05") },
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439015",
				estimationId: estimations[0].id,
				orderId: orders[26]?.id || null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.OFFICE_SUPPLIES,
				itemName: "Office Supplies",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 500.0,
				estimatedTotal: 500.0,
				actualUnitPrice: 450.0,
				actualTotal: 450.0,
				estimationPoints: 1,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-01-03"),
				endDate: new Date("2024-01-03"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 2 - Mobile App Development
			{
				id: "808f1f77bcf86cd799439016",
				estimationId: estimations[1]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "iOS Developer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 13500.0,
				estimatedTotal: 27000.0,
				actualUnitPrice: 13000.0,
				actualTotal: 26000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-02-01"),
				endDate: new Date("2024-04-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439017",
				estimationId: estimations[1]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Android Developer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 13000.0,
				estimatedTotal: 26000.0,
				actualUnitPrice: 12500.0,
				actualTotal: 25000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-02-01"),
				endDate: new Date("2024-04-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439018",
				estimationId: estimations[1]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "QA Engineer",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 9000.0,
				estimatedTotal: 9000.0,
				actualUnitPrice: 8500.0,
				actualTotal: 8500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-02-15"),
				endDate: new Date("2024-04-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439019",
				estimationId: estimations[1]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Backend Developer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-02-01"),
				endDate: new Date("2024-04-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 5 - Data Analytics Dashboard
			{
				id: "808f1f77bcf86cd799439027",
				estimationId: estimations[4]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Data Analyst",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 11000.0,
				estimatedTotal: 22000.0,
				actualUnitPrice: 10500.0,
				actualTotal: 21000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-05-01"),
				endDate: new Date("2024-07-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439028",
				estimationId: estimations[4]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Data Visualization Specialist",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 10500.0,
				estimatedTotal: 10500.0,
				actualUnitPrice: 10000.0,
				actualTotal: 10000.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-05-15"),
				endDate: new Date("2024-07-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 7 - Network Security Upgrade
			{
				id: "808f1f77bcf86cd799439032",
				estimationId: estimations[6]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Security Engineer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 15000.0,
				estimatedTotal: 30000.0,
				actualUnitPrice: 14500.0,
				actualTotal: 29000.0,
				estimationPoints: 21,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-07-01"),
				endDate: new Date("2024-09-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439033",
				estimationId: estimations[6]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Network Administrator",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-07-01"),
				endDate: new Date("2024-09-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 9 - Digital Marketing Campaign
			{
				id: "808f1f77bcf86cd799439037",
				estimationId: estimations[8]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Digital Marketing Manager",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 11000.0,
				estimatedTotal: 11000.0,
				actualUnitPrice: 10500.0,
				actualTotal: 10500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-09-01"),
				endDate: new Date("2024-11-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439038",
				estimationId: estimations[8]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "SEO Specialist",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 8000.0,
				estimatedTotal: 8000.0,
				actualUnitPrice: 7500.0,
				actualTotal: 7500.0,
				estimationPoints: 5,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-09-01"),
				endDate: new Date("2024-11-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439039",
				estimationId: estimations[8]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Content Writer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 6000.0,
				estimatedTotal: 12000.0,
				actualUnitPrice: 5800.0,
				actualTotal: 11600.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-09-01"),
				endDate: new Date("2024-11-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "808f1f77bcf86cd799439040",
				estimationId: estimations[8]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.MISCELLANEOUS,
				itemName: "Google Ads Budget",
				estimatedQuantity: 6,
				actualQuantity: 6,
				estimatedUnitPrice: 3000.0,
				estimatedTotal: 18000.0,
				actualUnitPrice: 2900.0,
				actualTotal: 17400.0,
				estimationPoints: 3,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-09-01"),
				endDate: new Date("2024-11-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// ============================================
			// MISC TYPE ITEMS (for uncategorized expenses)
			// ============================================
			{
				id: "908f1f77bcf86cd799439010",
				estimationId: estimations[2]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.INFRASTRUCTURE,
				itemName: "Complete Infrastructure Package",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 100000.0,
				estimatedTotal: 100000.0,
				actualUnitPrice: 95000.0,
				actualTotal: 95000.0,
				estimationPoints: 21,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-03-01"),
				endDate: new Date("2024-05-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Child 1: Server Component
			{
				id: "908f1f77bcf86cd799439011",
				estimationId: estimations[2]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.INFRASTRUCTURE,
				itemName: "Server Components",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 30000.0,
				estimatedTotal: 60000.0,
				actualUnitPrice: 28000.0,
				actualTotal: 56000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-03-05"),
				endDate: new Date("2024-04-15"),
				parentItemId: "908f1f77bcf86cd799439010",
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Child 2: Network Component
			{
				id: "908f1f77bcf86cd799439012",
				estimationId: estimations[2]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.NETWORKING,
				itemName: "Network Equipment",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 25000.0,
				estimatedTotal: 25000.0,
				actualUnitPrice: 24000.0,
				actualTotal: 24000.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-04-01"),
				endDate: new Date("2024-05-10"),
				parentItemId: "908f1f77bcf86cd799439010",
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Child 3: Storage Component
			{
				id: "908f1f77bcf86cd799439013",
				estimationId: estimations[2]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.INFRASTRUCTURE,
				itemName: "Storage Systems",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 15000.0,
				estimatedTotal: 15000.0,
				actualUnitPrice: 15000.0,
				actualTotal: 15000.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-04-15"),
				endDate: new Date("2024-05-25"),
				parentItemId: "908f1f77bcf86cd799439010",
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// ============================================
			// ADDITIONAL PROJECTS (3-50) - COMPLETE COVERAGE
			// ============================================

			// Project 3 - Cloud Infrastructure Migration (using estimation index 4 or 5)
			{
				id: "908f1f77bcf86cd799439040",
				estimationId:
					estimations[5]?.id ||
					estimations[4]?.id ||
					estimations[2]?.id ||
					estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Cloud Migration Specialist",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 15000.0,
				estimatedTotal: 30000.0,
				actualUnitPrice: 14500.0,
				actualTotal: 29000.0,
				estimationPoints: 13,
				status: ItemStatus.IN_PROGRESS,
				startDate: new Date("2025-01-01"),
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439041",
				estimationId:
					estimations[5]?.id ||
					estimations[4]?.id ||
					estimations[2]?.id ||
					estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.INFRASTRUCTURE,
				itemName: "AWS Cloud Services Setup",
				estimatedQuantity: 1,
				actualQuantity: null,
				estimatedUnitPrice: 45000.0,
				estimatedTotal: 45000.0,
				actualUnitPrice: null,
				actualTotal: null,
				estimationPoints: 21,
				status: ItemStatus.PENDING,
				startDate: null,
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 4 - E-commerce Platform (using estimation index 6 or 7)
			{
				id: "908f1f77bcf86cd799439042",
				estimationId:
					estimations[7]?.id ||
					estimations[6]?.id ||
					estimations[3]?.id ||
					estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "E-commerce Developer",
				estimatedQuantity: 4,
				actualQuantity: null,
				estimatedUnitPrice: 12500.0,
				estimatedTotal: 50000.0,
				actualUnitPrice: null,
				actualTotal: null,
				estimationPoints: 21,
				status: ItemStatus.PENDING,
				startDate: null,
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439043",
				estimationId:
					estimations[7]?.id ||
					estimations[6]?.id ||
					estimations[3]?.id ||
					estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.INFRASTRUCTURE,
				itemName: "E-commerce Platform License",
				estimatedQuantity: 1,
				actualQuantity: null,
				estimatedUnitPrice: 35000.0,
				estimatedTotal: 35000.0,
				actualUnitPrice: null,
				actualTotal: null,
				estimationPoints: 8,
				status: ItemStatus.PENDING,
				startDate: null,
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 5 - Data Analytics Dashboard (using estimation index 8 or 9)
			{
				id: "908f1f77bcf86cd799439044",
				estimationId:
					estimations[9]?.id ||
					estimations[8]?.id ||
					estimations[4]?.id ||
					estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "BI Developer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 13000.0,
				estimatedTotal: 26000.0,
				actualUnitPrice: 12500.0,
				actualTotal: 25000.0,
				estimationPoints: 13,
				status: ItemStatus.IN_PROGRESS,
				startDate: new Date("2025-01-01"),
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439045",
				estimationId:
					estimations[9]?.id ||
					estimations[8]?.id ||
					estimations[4]?.id ||
					estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.SOFTWARE,
				itemName: "Tableau License",
				estimatedQuantity: 5,
				actualQuantity: null,
				estimatedUnitPrice: 1200.0,
				estimatedTotal: 6000.0,
				actualUnitPrice: null,
				actualTotal: null,
				estimationPoints: 5,
				status: ItemStatus.PENDING,
				startDate: null,
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 8 - HR Management System (using estimation index 14 or 15)
			{
				id: "908f1f77bcf86cd799439046",
				estimationId:
					estimations[15]?.id ||
					estimations[14]?.id ||
					estimations[7]?.id ||
					estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "HRMS Developer",
				estimatedQuantity: 3,
				actualQuantity: null,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 36000.0,
				actualUnitPrice: null,
				actualTotal: null,
				estimationPoints: 13,
				status: ItemStatus.PENDING,
				startDate: null,
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439047",
				estimationId:
					estimations[15]?.id ||
					estimations[14]?.id ||
					estimations[7]?.id ||
					estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.SOFTWARE,
				itemName: "HRMS Software License",
				estimatedQuantity: 1,
				actualQuantity: null,
				estimatedUnitPrice: 28000.0,
				estimatedTotal: 28000.0,
				actualUnitPrice: null,
				actualTotal: null,
				estimationPoints: 8,
				status: ItemStatus.PENDING,
				startDate: null,
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 9 - Digital Marketing Campaign (estimations[16] or [17])
			{
				id: "908f1f77bcf86cd799439050",
				estimationId: estimations[17]?.id || estimations[8]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Marketing Campaign Manager",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 12000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 11500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-09-01"),
				endDate: new Date("2024-11-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439052",
				estimationId: estimations[19]?.id || estimations[9]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "IoT Sensor Devices",
				estimatedQuantity: 100,
				actualQuantity: 100,
				estimatedUnitPrice: 450.0,
				estimatedTotal: 45000.0,
				actualUnitPrice: 420.0,
				actualTotal: 42000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-10-01"),
				endDate: new Date("2024-11-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439053",
				estimationId: estimations[19]?.id || estimations[9]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "IoT Integration Engineer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 14000.0,
				estimatedTotal: 28000.0,
				actualUnitPrice: 13500.0,
				actualTotal: 27000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-10-01"),
				endDate: new Date("2024-12-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 13 - AI-Powered Chatbot (estimations[24] or [25])
			{
				id: "908f1f77bcf86cd799439054",
				estimationId: estimations[25]?.id || estimations[12]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "AI/ML Engineer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 16000.0,
				estimatedTotal: 32000.0,
				actualUnitPrice: 15500.0,
				actualTotal: 31000.0,
				estimationPoints: 21,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-11-01"),
				endDate: new Date("2025-01-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439055",
				estimationId: estimations[25]?.id || estimations[12]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "GPU Server for ML Training",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 18000.0,
				estimatedTotal: 18000.0,
				actualUnitPrice: 17500.0,
				actualTotal: 17500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-11-05"),
				endDate: new Date("2024-11-10"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 15 - API Gateway (estimations[28] or [29])
			{
				id: "908f1f77bcf86cd799439056",
				estimationId: estimations[29]?.id || estimations[14]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Backend API Developer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 13000.0,
				estimatedTotal: 26000.0,
				actualUnitPrice: 12500.0,
				actualTotal: 25000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-12-01"),
				endDate: new Date("2025-02-28"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439057",
				estimationId: estimations[29]?.id || estimations[14]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.NETWORKING,
				itemName: "API Gateway Appliance",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 8500.0,
				estimatedTotal: 17000.0,
				actualUnitPrice: 8200.0,
				actualTotal: 16400.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-12-05"),
				endDate: new Date("2024-12-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 16 - Inventory Management (estimations[31] or [32])
			{
				id: "908f1f77bcf86cd799439058",
				estimationId: estimations[31]?.id || estimations[15]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Full-stack Developer",
				estimatedQuantity: 3,
				actualQuantity: 3,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 36000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 34500.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2025-01-01"),
				endDate: new Date("2025-03-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439059",
				estimationId: estimations[31]?.id || estimations[15]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Barcode Scanners",
				estimatedQuantity: 20,
				actualQuantity: 20,
				estimatedUnitPrice: 250.0,
				estimatedTotal: 5000.0,
				actualUnitPrice: 240.0,
				actualTotal: 4800.0,
				estimationPoints: 5,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2025-01-10"),
				endDate: new Date("2025-01-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 17 - Payment Processing (estimations[33] or [34])
			{
				id: "908f1f77bcf86cd799439060",
				estimationId: estimations[33]?.id || estimations[16]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Payment Integration Specialist",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 15000.0,
				estimatedTotal: 15000.0,
				actualUnitPrice: 14500.0,
				actualTotal: 14500.0,
				estimationPoints: 13,
				status: ItemStatus.IN_PROGRESS,
				startDate: new Date("2025-01-15"),
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439062",
				estimationId: estimations[37]?.id || estimations[18]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "DevOps Engineer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 14500.0,
				estimatedTotal: 29000.0,
				actualUnitPrice: 14000.0,
				actualTotal: 28000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-12-01"),
				endDate: new Date("2024-12-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439063",
				estimationId: estimations[37]?.id || estimations[18]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.INFRASTRUCTURE,
				itemName: "CI/CD Pipeline Infrastructure",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 25000.0,
				estimatedTotal: 25000.0,
				actualUnitPrice: 24000.0,
				actualTotal: 24000.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-12-05"),
				endDate: new Date("2024-12-20"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 20 - Learning Management System (estimations[39] or [40])
			{
				id: "908f1f77bcf86cd799439064",
				estimationId: estimations[39]?.id || estimations[19]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "E-learning Developer",
				estimatedQuantity: 3,
				actualQuantity: 3,
				estimatedUnitPrice: 11000.0,
				estimatedTotal: 33000.0,
				actualUnitPrice: 10500.0,
				actualTotal: 31500.0,
				estimationPoints: 13,
				status: ItemStatus.IN_PROGRESS,
				startDate: new Date("2025-01-01"),
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439065",
				estimationId: estimations[39]?.id || estimations[19]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.SOFTWARE,
				itemName: "LMS Platform License",
				estimatedQuantity: 1,
				actualQuantity: null,
				estimatedUnitPrice: 15000.0,
				estimatedTotal: 15000.0,
				actualUnitPrice: null,
				actualTotal: null,
				estimationPoints: 5,
				status: ItemStatus.IN_PROGRESS,
				startDate: new Date("2025-01-05"),
				endDate: null,
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 23 - Video Streaming Platform (estimations[45] or [46])
			{
				id: "908f1f77bcf86cd799439066",
				estimationId: estimations[45]?.id || estimations[22]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Video Platform Developer",
				estimatedQuantity: 4,
				actualQuantity: 4,
				estimatedUnitPrice: 13500.0,
				estimatedTotal: 54000.0,
				actualUnitPrice: 13000.0,
				actualTotal: 52000.0,
				estimationPoints: 21,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-11-01"),
				endDate: new Date("2025-01-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439067",
				estimationId: estimations[45]?.id || estimations[22]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.INFRASTRUCTURE,
				itemName: "Video Streaming Servers",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 60000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 57500.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-11-10"),
				endDate: new Date("2024-12-01"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 27 - Warehouse Management (estimations[53] or [54])
			{
				id: "908f1f77bcf86cd799439068",
				estimationId: estimations[53]?.id || estimations[26]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Warehouse System Developer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-10-01"),
				endDate: new Date("2024-12-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				id: "908f1f77bcf86cd799439069",
				estimationId: estimations[53]?.id || estimations[26]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "RFID Tracking System",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 35000.0,
				estimatedTotal: 35000.0,
				actualUnitPrice: 33500.0,
				actualTotal: 33500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-10-15"),
				endDate: new Date("2024-11-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 29 - Supply Chain Platform (estimations[57] or [58])
			{
				id: "908f1f77bcf86cd799439070",
				estimationId: estimations[57]?.id || estimations[28]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Supply Chain Analyst",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 11500.0,
				estimatedTotal: 23000.0,
				actualUnitPrice: 11000.0,
				actualTotal: 22000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-09-01"),
				endDate: new Date("2024-11-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 30 - Fleet Management (estimations[59] or [60])
			{
				id: "908f1f77bcf86cd799439071",
				estimationId: estimations[59]?.id || estimations[29]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "GPS Tracking Devices",
				estimatedQuantity: 50,
				actualQuantity: 50,
				estimatedUnitPrice: 350.0,
				estimatedTotal: 17500.0,
				actualUnitPrice: 330.0,
				actualTotal: 16500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-08-01"),
				endDate: new Date("2024-08-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 32 - Real Estate Portal (estimations[63] or [64])
			{
				id: "908f1f77bcf86cd799439072",
				estimationId: estimations[63]?.id || estimations[31]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Real Estate Platform Developer",
				estimatedQuantity: 3,
				actualQuantity: 3,
				estimatedUnitPrice: 12500.0,
				estimatedTotal: 37500.0,
				actualUnitPrice: 12000.0,
				actualTotal: 36000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-07-01"),
				endDate: new Date("2024-09-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 34 - Telemedicine Platform (estimations[67] or [68])
			{
				id: "908f1f77bcf86cd799439073",
				estimationId: estimations[67]?.id || estimations[33]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Healthcare Software Developer",
				estimatedQuantity: 4,
				actualQuantity: 4,
				estimatedUnitPrice: 14000.0,
				estimatedTotal: 56000.0,
				actualUnitPrice: 13500.0,
				actualTotal: 54000.0,
				estimationPoints: 21,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 36 - Insurance Claims (estimations[71] or [72])
			{
				id: "908f1f77bcf86cd799439074",
				estimationId: estimations[71]?.id || estimations[35]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Insurance Platform Developer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 13000.0,
				estimatedTotal: 26000.0,
				actualUnitPrice: 12500.0,
				actualTotal: 25000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-05-01"),
				endDate: new Date("2024-07-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 38 - Restaurant POS (estimations[75] or [76])
			{
				id: "908f1f77bcf86cd799439075",
				estimationId: estimations[75]?.id || estimations[37]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "POS Terminal Systems",
				estimatedQuantity: 15,
				actualQuantity: 15,
				estimatedUnitPrice: 1200.0,
				estimatedTotal: 18000.0,
				actualUnitPrice: 1150.0,
				actualTotal: 17250.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-04-01"),
				endDate: new Date("2024-04-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 40 - Hotel Booking System (estimations[79] or [80])
			{
				id: "908f1f77bcf86cd799439076",
				estimationId: estimations[79]?.id || estimations[39]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Booking System Developer",
				estimatedQuantity: 3,
				actualQuantity: 3,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 36000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 34500.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-03-01"),
				endDate: new Date("2024-05-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 42 - Fitness Tracking App (estimations[83] or [84])
			{
				id: "908f1f77bcf86cd799439077",
				estimationId: estimations[83]?.id || estimations[41]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Mobile App Developer - Fitness",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 13000.0,
				estimatedTotal: 26000.0,
				actualUnitPrice: 12500.0,
				actualTotal: 25000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-02-01"),
				endDate: new Date("2024-04-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 44 - Event Management (estimations[87] or [88])
			{
				id: "908f1f77bcf86cd799439078",
				estimationId: estimations[87]?.id || estimations[43]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Event Platform Developer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 11500.0,
				estimatedTotal: 23000.0,
				actualUnitPrice: 11000.0,
				actualTotal: 22000.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-01-01"),
				endDate: new Date("2024-03-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 46 - Smart Home Integration (estimations[91] or [92])
			{
				id: "908f1f77bcf86cd799439079",
				estimationId: estimations[91]?.id || estimations[45]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Smart Home Hub Devices",
				estimatedQuantity: 50,
				actualQuantity: 50,
				estimatedUnitPrice: 280.0,
				estimatedTotal: 14000.0,
				actualUnitPrice: 260.0,
				actualTotal: 13000.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2023-12-01"),
				endDate: new Date("2023-12-20"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 48 - Energy Management (estimations[95] or [96])
			{
				id: "908f1f77bcf86cd799439080",
				estimationId: estimations[95]?.id || estimations[47]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Energy Systems Engineer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 14500.0,
				estimatedTotal: 29000.0,
				actualUnitPrice: 14000.0,
				actualTotal: 28000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2023-11-01"),
				endDate: new Date("2024-01-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 49 - Document Management (estimations[97] or [98])
			{
				id: "908f1f77bcf86cd799439081",
				estimationId: estimations[97]?.id || estimations[48]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Document System Developer",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2023-10-01"),
				endDate: new Date("2023-12-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 50 - Customer Feedback (estimations[99] or [100])
			{
				id: "908f1f77bcf86cd799439082",
				estimationId: estimations[99]?.id || estimations[49]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Feedback Platform Developer",
				estimatedQuantity: 1,
				actualQuantity: 1,
				estimatedUnitPrice: 11000.0,
				estimatedTotal: 11000.0,
				actualUnitPrice: 10500.0,
				actualTotal: 10500.0,
				estimationPoints: 5,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2023-09-01"),
				endDate: new Date("2023-11-30"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},

			// Project 11 - Auto-generated
			{
				estimationId: estimations[20]?.id || estimations[21]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 11",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[20]?.id || estimations[21]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 11",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 12 - Auto-generated
			{
				estimationId: estimations[22]?.id || estimations[23]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 12",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[22]?.id || estimations[23]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 12",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 13 - Auto-generated
			{
				estimationId: estimations[24]?.id || estimations[25]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 13",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[24]?.id || estimations[25]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 13",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 14 - Auto-generated
			{
				estimationId: estimations[26]?.id || estimations[27]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 14",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[26]?.id || estimations[27]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 14",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 15 - Auto-generated
			{
				estimationId: estimations[28]?.id || estimations[29]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 15",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[28]?.id || estimations[29]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 15",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 16 - Auto-generated
			{
				estimationId: estimations[30]?.id || estimations[31]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 16",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[30]?.id || estimations[31]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 16",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 17 - Auto-generated
			{
				estimationId: estimations[32]?.id || estimations[33]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 17",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[32]?.id || estimations[33]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 17",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 18 - Auto-generated
			{
				estimationId: estimations[34]?.id || estimations[35]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 18",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[34]?.id || estimations[35]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 18",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 19 - Auto-generated
			{
				estimationId: estimations[36]?.id || estimations[37]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 19",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[36]?.id || estimations[37]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 19",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 20 - Auto-generated
			{
				estimationId: estimations[38]?.id || estimations[39]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 20",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[38]?.id || estimations[39]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 20",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 21 - Auto-generated
			{
				estimationId: estimations[40]?.id || estimations[41]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 21",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[40]?.id || estimations[41]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 21",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 22 - Auto-generated
			{
				estimationId: estimations[42]?.id || estimations[43]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 22",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[42]?.id || estimations[43]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 22",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 23 - Auto-generated
			{
				estimationId: estimations[44]?.id || estimations[45]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 23",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[44]?.id || estimations[45]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 23",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 24 - Auto-generated
			{
				estimationId: estimations[46]?.id || estimations[47]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 24",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[46]?.id || estimations[47]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 24",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 25 - Auto-generated
			{
				estimationId: estimations[48]?.id || estimations[49]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 25",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[48]?.id || estimations[49]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 25",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 26 - Auto-generated
			{
				estimationId: estimations[50]?.id || estimations[51]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 26",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[50]?.id || estimations[51]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 26",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 27 - Auto-generated
			{
				estimationId: estimations[52]?.id || estimations[53]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 27",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[52]?.id || estimations[53]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 27",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 28 - Auto-generated
			{
				estimationId: estimations[54]?.id || estimations[55]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 28",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[54]?.id || estimations[55]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 28",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 29 - Auto-generated
			{
				estimationId: estimations[56]?.id || estimations[57]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 29",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[56]?.id || estimations[57]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 29",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 30 - Auto-generated
			{
				estimationId: estimations[58]?.id || estimations[59]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 30",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[58]?.id || estimations[59]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 30",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 31 - Auto-generated
			{
				estimationId: estimations[60]?.id || estimations[61]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 31",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[60]?.id || estimations[61]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 31",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 32 - Auto-generated
			{
				estimationId: estimations[62]?.id || estimations[63]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 32",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[62]?.id || estimations[63]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 32",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 33 - Auto-generated
			{
				estimationId: estimations[64]?.id || estimations[65]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 33",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[64]?.id || estimations[65]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 33",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 34 - Auto-generated
			{
				estimationId: estimations[66]?.id || estimations[67]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 34",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[66]?.id || estimations[67]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 34",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 35 - Auto-generated
			{
				estimationId: estimations[68]?.id || estimations[69]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 35",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[68]?.id || estimations[69]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 35",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 36 - Auto-generated
			{
				estimationId: estimations[70]?.id || estimations[71]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 36",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[70]?.id || estimations[71]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 36",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 37 - Auto-generated
			{
				estimationId: estimations[72]?.id || estimations[73]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 37",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[72]?.id || estimations[73]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 37",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 38 - Auto-generated
			{
				estimationId: estimations[74]?.id || estimations[75]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 38",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[74]?.id || estimations[75]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 38",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 39 - Auto-generated
			{
				estimationId: estimations[76]?.id || estimations[77]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 39",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[76]?.id || estimations[77]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 39",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 40 - Auto-generated
			{
				estimationId: estimations[78]?.id || estimations[79]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 40",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[78]?.id || estimations[79]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 40",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 41 - Auto-generated
			{
				estimationId: estimations[80]?.id || estimations[81]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 41",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[80]?.id || estimations[81]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 41",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 42 - Auto-generated
			{
				estimationId: estimations[82]?.id || estimations[83]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 42",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[82]?.id || estimations[83]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 42",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 43 - Auto-generated
			{
				estimationId: estimations[84]?.id || estimations[85]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 43",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[84]?.id || estimations[85]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 43",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 44 - Auto-generated
			{
				estimationId: estimations[86]?.id || estimations[87]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 44",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[86]?.id || estimations[87]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 44",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 45 - Auto-generated
			{
				estimationId: estimations[88]?.id || estimations[89]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 45",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[88]?.id || estimations[89]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 45",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 4 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 46 - Auto-generated
			{
				estimationId: estimations[90]?.id || estimations[91]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 46",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 1 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[90]?.id || estimations[91]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 46",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 47 - Auto-generated
			{
				estimationId: estimations[92]?.id || estimations[93]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 47",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[92]?.id || estimations[93]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 47",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 48 - Auto-generated
			{
				estimationId: estimations[94]?.id || estimations[95]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 48",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[94]?.id || estimations[95]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 48",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 49 - Auto-generated
			{
				estimationId: estimations[96]?.id || estimations[97]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 49",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 2 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Low" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[96]?.id || estimations[97]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 49",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			// Project 50 - Auto-generated
			{
				estimationId: estimations[98]?.id || estimations[99]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450002",
				categoryId: CATEGORY_IDS.HUMAN_RESOURCE,
				itemName: "Developer - Project 50",
				estimatedQuantity: 2,
				actualQuantity: 2,
				estimatedUnitPrice: 12000.0,
				estimatedTotal: 24000.0,
				actualUnitPrice: 11500.0,
				actualTotal: 23000.0,
				estimationPoints: 13,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-08-31"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 5 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "High" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "Operations" },
					{ fieldId: FIELD_IDS.TAGS, value: ["OPEX", "Recurring"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
			{
				estimationId: estimations[98]?.id || estimations[99]?.id || estimations[0].id,
				orderId: null,
				itemTypeId: "608f1f77bcf86cd799450001",
				categoryId: CATEGORY_IDS.HARDWARE,
				itemName: "Equipment - Project 50",
				estimatedQuantity: 5,
				actualQuantity: 5,
				estimatedUnitPrice: 2000.0,
				estimatedTotal: 10000.0,
				actualUnitPrice: 1900.0,
				actualTotal: 9500.0,
				estimationPoints: 8,
				status: ItemStatus.COMPLETED,
				startDate: new Date("2024-06-01"),
				endDate: new Date("2024-07-15"),
				parentItemId: null,
				isDeleted: false,
			fields: {
				common: [
					{ fieldId: FIELD_IDS.PRIORITY_LEVEL, value: 3 },
					{ fieldId: FIELD_IDS.RISK_LEVEL, value: "Medium" },
					{ fieldId: FIELD_IDS.DEPARTMENT, value: "IT" },
					{ fieldId: FIELD_IDS.TAGS, value: ["CAPEX", "Important"] },
				],
				custom: [
					{
						fieldId: FIELD_IDS.NOTES,
						value: "Item seeded with default fields",
					},
				],
			},
			},
		];
		// Create items
		console.log("📝 Creating item records...");
		await prisma.item.createMany({
			data: itemData.map((i, index) => {
				// Ensure milestone belongs to the same project as the item's estimation
				const projectId = estimationToProjectId.get(i.estimationId);
				let milestoneId: string | undefined = (i as any).milestoneId;

				// If item already has milestoneId but it points to another project, override it.
				if (milestoneId && projectId) {
					const milestoneProjectId = milestoneProjectIdById.get(milestoneId) ?? null;
					if (milestoneProjectId && milestoneProjectId !== projectId) {
						milestoneId = undefined;
					}
				}

				if (!milestoneId && projectId) {
					const byProj = milestonesByProjectId.get(projectId);
					if (byProj?.length) {
						milestoneId = pickDeterministic(byProj, i.id || i.itemName || i.estimationId);
					}
				}

				const orgId = orgIds[index % orgIds.length];
				// Link some items to purchase orders (every 10th item)
				let purchaseOrderId: string | null = null;
				if (index % 10 === 0 && purchaseOrders.length > 0) {
					const poIndex = Math.floor(index / 10) % purchaseOrders.length;
					purchaseOrderId = purchaseOrders[poIndex].id;
				}
				return { ...i, milestoneId, purchaseOrderId, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${itemData.length} item records`);

		// Also fix items created by other seeders (e.g. seedEstimation) that may not have milestoneId.
		console.log("🔗 Assigning missing milestoneId for existing items...");
		const itemsMissingMilestone = await prisma.item.findMany({
			where: { workspaceId: { in: orgIds }, isDeleted: false, milestoneId: null },
			select: { id: true, estimationId: true, itemName: true },
		});

		let milestonesAssigned = 0;
		for (const it of itemsMissingMilestone) {
			let projectId = estimationToProjectId.get(it.estimationId);

			// If estimation wasn't in our initial take(), fetch it on-demand
			if (!projectId) {
				const est = await prisma.estimation.findUnique({
					where: { id: it.estimationId },
					select: { projectId: true },
				});
				if (est?.projectId) {
					projectId = est.projectId;
					estimationToProjectId.set(it.estimationId, projectId);
				}
			}

			if (!projectId) continue;
			const byProj = milestonesByProjectId.get(projectId);
			if (!byProj?.length) continue;

			const milestoneId = pickDeterministic(byProj, it.id || it.itemName || it.estimationId);
			try {
				await prisma.item.update({
					where: { id: it.id },
					data: { milestoneId },
				});
				milestonesAssigned++;
			} catch (e) {
				console.warn(`   ⚠️  Failed to assign milestone for item ${it.id}:`, e);
			}
		}

		console.log(
			`✅ Assigned milestoneId for ${milestonesAssigned}/${itemsMissingMilestone.length} items missing milestones`,
		);

		// Calculate summaries
		const capexItems = itemData.filter(
			(item) => item.itemTypeId === "608f1f77bcf86cd799450001",
		);
		const opexItems = itemData.filter((item) => item.itemTypeId === "608f1f77bcf86cd799450002");

		const totalEstimated = itemData.reduce((sum, item) => sum + item.estimatedTotal, 0);
		const totalActual = itemData.reduce((sum, item) => sum + (item.actualTotal || 0), 0);

		const capexEstimated = capexItems.reduce((sum, item) => sum + item.estimatedTotal, 0);
		const capexActual = capexItems.reduce((sum, item) => sum + (item.actualTotal || 0), 0);

		const opexEstimated = opexItems.reduce((sum, item) => sum + item.estimatedTotal, 0);
		const opexActual = opexItems.reduce((sum, item) => sum + (item.actualTotal || 0), 0);

		const itemsWithActuals = itemData.filter((item) => item.actualTotal !== null).length;
		const itemsLinkedToOrders = itemData.filter((item) => item.orderId !== null).length;

		console.log("\n📊 Item Summary:");
		console.log(`   Type Breakdown:`);
		console.log(`   🏗️  CAPEX Items: ${capexItems.length}`);
		console.log(`   💼 OPEX Items: ${opexItems.length}`);
		console.log(`\n   Financial Summary:`);
		console.log(`   💰 Total Estimated: $${totalEstimated.toLocaleString()}`);
		console.log(`   💵 Total Actual: $${totalActual.toLocaleString()}`);
		console.log(`\n   CAPEX Financial:`);
		console.log(`   💰 Estimated: $${capexEstimated.toLocaleString()}`);
		console.log(`   💵 Actual: $${capexActual.toLocaleString()}`);
		console.log(`\n   OPEX Financial:`);
		console.log(`   💰 Estimated: $${opexEstimated.toLocaleString()}`);
		console.log(`   💵 Actual: $${opexActual.toLocaleString()}`);
		console.log(`\n   Additional Info:`);
		console.log(`   ✅ Items with Actuals: ${itemsWithActuals}/${itemData.length}`);
		console.log(`   🔗 Items Linked to Orders: ${itemsLinkedToOrders}/${itemData.length}`);
		console.log(`\n   📈 Total Items: ${itemData.length}`);

		// Recalculate estimation totals and metadata using centralized function (parallelized)
		console.log("\n📊 Calculating and updating estimation breakdowns...");
		const uniqueEstimationIds = [...new Set(itemData.map((item) => item.estimationId))];

		const BATCH_SIZE = 10;
		const estimationBatches = [];
		for (let i = 0; i < uniqueEstimationIds.length; i += BATCH_SIZE) {
			estimationBatches.push(uniqueEstimationIds.slice(i, i + BATCH_SIZE));
		}

		for (const batch of estimationBatches) {
			await Promise.all(
				batch.map((estimationId) => updateEstimationTotalsAndMetadata(prisma, estimationId))
			);
		}

		console.log(
			`✅ Updated ${uniqueEstimationIds.length} estimations with breakdown data in metaData`,
		);

		// Update project financials and budget metadata (parallelized)
		console.log("\n💰 Updating project financials and budget metrics...");

		// Get all estimations with project IDs in one query
		const estimationsWithProjects = await prisma.estimation.findMany({
			where: { id: { in: uniqueEstimationIds } },
			select: { id: true, projectId: true },
		});

		const uniqueProjectIds = new Set<string>();
		estimationsWithProjects.forEach((e) => uniqueProjectIds.add(e.projectId));

		// Parallelize updateProjectFinancials by estimation
		for (const batch of estimationBatches) {
			await Promise.all(
				batch.map(async (estimationId) => {
					try {
						await updateProjectFinancials(prisma, estimationId);
					} catch (error) {
						console.warn(
							`   ⚠️  Failed to update financials for estimation ${estimationId}:`,
							error,
						);
					}
				})
			);
		}

		// Update budget metadata and progress for all affected projects (parallelized)
		const projectIds = [...uniqueProjectIds];
		const projectBatches = [];
		for (let i = 0; i < projectIds.length; i += BATCH_SIZE) {
			projectBatches.push(projectIds.slice(i, i + BATCH_SIZE));
		}

		let budgetMetricsUpdated = 0;
		let progressUpdated = 0;

		for (const batch of projectBatches) {
			const results = await Promise.all(
				batch.map(async (projectId) => {
					let budgetSuccess = false;
					let progressSuccess = false;

					try {
						// Run budget and progress updates in parallel for each project
						await Promise.all([
							updateProjectBudgetMetadata(prisma, projectId).then(() => {
								budgetSuccess = true;
							}),
							updateProjectProgress(prisma, projectId).then(() => {
								progressSuccess = true;
							}),
						]);
					} catch (error) {
						console.warn(
							`   ⚠️  Failed to update metrics for project ${projectId}:`,
							error,
						);
					}

					return { budgetSuccess, progressSuccess };
				})
			);

			results.forEach((r) => {
				if (r.budgetSuccess) budgetMetricsUpdated++;
				if (r.progressSuccess) progressUpdated++;
			});
		}

		console.log(
			`✅ Updated financials and budget metrics for ${budgetMetricsUpdated} projects`,
		);
		console.log(`✅ Updated point-based progress for ${progressUpdated} projects`);

		console.log("\n🎉 Item seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during item seeding:", error);
		throw error;
	}
}
