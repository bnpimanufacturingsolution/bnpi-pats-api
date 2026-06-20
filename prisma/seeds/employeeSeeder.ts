import { PrismaClient, SyncStatus } from "../../generated/prisma";

export async function seedEmployee(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting employee seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	const employeeData = [
		{
			id: "609f1f77bcf86cd799450001",
			externalId: "EXT-SEED-001",
			employeeId: "EMP-001",
			firstName: "John",
			lastName: "Doe",
			email: "john.doe@company.com",
			phone: "+1234567890",
			employmentStatus: "ACTIVE",
			employmentType: "REGULAR",
			departmentName: "Engineering",
			positionTitle: "Senior Developer",
			basicSalary: 85000,
			currency: "PHP",
			payFrequency: "MONTHLY",
			workLocation: "HYBRID",
			isManager: false,
			syncStatus: SyncStatus.LOCAL_ONLY,
			isTour: false,
			isDeleted: false,
		},
		{
			id: "609f1f77bcf86cd799450002",
			externalId: "EXT-SEED-002",
			employeeId: "EMP-002",
			firstName: "Jane",
			lastName: "Smith",
			email: "jane.smith@company.com",
			phone: "+1234567891",
			employmentStatus: "ACTIVE",
			employmentType: "REGULAR",
			departmentName: "Engineering",
			positionTitle: "Tech Lead",
			basicSalary: 120000,
			currency: "PHP",
			payFrequency: "MONTHLY",
			workLocation: "ONSITE",
			isManager: true,
			syncStatus: SyncStatus.LOCAL_ONLY,
			isTour: false,
			isDeleted: false,
		},
		{
			id: "609f1f77bcf86cd799450003",
			externalId: "EXT-SEED-003",
			employeeId: "EMP-003",
			firstName: "Michael",
			lastName: "Johnson",
			email: "michael.johnson@company.com",
			phone: "+1234567892",
			employmentStatus: "ACTIVE",
			employmentType: "CONTRACTUAL",
			departmentName: "Design",
			positionTitle: "UI/UX Designer",
			basicSalary: 65000,
			currency: "PHP",
			payFrequency: "MONTHLY",
			workLocation: "REMOTE",
			isManager: false,
			syncStatus: SyncStatus.LOCAL_ONLY,
			isTour: false,
			isDeleted: false,
		},
		{
			id: "609f1f77bcf86cd799450004",
			externalId: "EXT-SEED-004",
			employeeId: "EMP-004",
			firstName: "Emily",
			lastName: "Brown",
			email: "emily.brown@company.com",
			phone: "+1234567893",
			employmentStatus: "ACTIVE",
			employmentType: "REGULAR",
			departmentName: "Human Resources",
			positionTitle: "HR Manager",
			basicSalary: 75000,
			currency: "PHP",
			payFrequency: "MONTHLY",
			workLocation: "ONSITE",
			isManager: true,
			syncStatus: SyncStatus.LOCAL_ONLY,
			isTour: false,
			isDeleted: false,
		},
		{
			id: "609f1f77bcf86cd799450005",
			externalId: "EXT-SEED-005",
			employeeId: "EMP-005",
			firstName: "David",
			lastName: "Wilson",
			email: "david.wilson@company.com",
			phone: "+1234567894",
			employmentStatus: "ACTIVE",
			employmentType: "PROBATIONARY",
			departmentName: "Engineering",
			positionTitle: "Junior Developer",
			basicSalary: 45000,
			currency: "PHP",
			payFrequency: "MONTHLY",
			workLocation: "HYBRID",
			isManager: false,
			syncStatus: SyncStatus.LOCAL_ONLY,
			isTour: false,
			isDeleted: false,
		},
		{
			id: "609f1f77bcf86cd799450006",
			externalId: "EXT-SEED-006",
			employeeId: "EMP-006",
			firstName: "Sarah",
			lastName: "Davis",
			email: "sarah.davis@company.com",
			phone: "+1234567895",
			employmentStatus: "ACTIVE",
			employmentType: "REGULAR",
			departmentName: "Finance",
			positionTitle: "Financial Analyst",
			basicSalary: 70000,
			currency: "PHP",
			payFrequency: "MONTHLY",
			workLocation: "ONSITE",
			isManager: false,
			syncStatus: SyncStatus.LOCAL_ONLY,
			isTour: false,
			isDeleted: false,
		},
		{
			id: "609f1f77bcf86cd799450007",
			externalId: "EXT-SEED-007",
			employeeId: "EMP-007",
			firstName: "Robert",
			lastName: "Martinez",
			email: "robert.martinez@company.com",
			phone: "+1234567896",
			employmentStatus: "ON_LEAVE",
			employmentType: "REGULAR",
			departmentName: "Operations",
			positionTitle: "Operations Manager",
			basicSalary: 90000,
			currency: "PHP",
			payFrequency: "MONTHLY",
			workLocation: "ONSITE",
			isManager: true,
			syncStatus: SyncStatus.LOCAL_ONLY,
			isTour: false,
			isDeleted: false,
		},
		{
			id: "609f1f77bcf86cd799450008",
			externalId: "EXT-SEED-008",
			employeeId: "EMP-008",
			firstName: "Lisa",
			lastName: "Anderson",
			email: "lisa.anderson@company.com",
			phone: "+1234567897",
			employmentStatus: "ACTIVE",
			employmentType: "INTERN",
			departmentName: "Marketing",
			positionTitle: "Marketing Intern",
			basicSalary: 25000,
			currency: "PHP",
			payFrequency: "MONTHLY",
			workLocation: "HYBRID",
			isManager: false,
			syncStatus: SyncStatus.LOCAL_ONLY,
			isTour: false,
			isDeleted: false,
		},
		{
			id: "609f1f77bcf86cd799450009",
			externalId: "EXT-SEED-009",
			employeeId: "EMP-009",
			firstName: "James",
			lastName: "Taylor",
			email: "james.taylor@company.com",
			phone: "+1234567898",
			employmentStatus: "ACTIVE",
			employmentType: "REGULAR",
			departmentName: "Engineering",
			positionTitle: "DevOps Engineer",
			basicSalary: 95000,
			currency: "PHP",
			payFrequency: "MONTHLY",
			workLocation: "REMOTE",
			isManager: false,
			syncStatus: SyncStatus.LOCAL_ONLY,
			isTour: false,
			isDeleted: false,
		},
		{
			id: "609f1f77bcf86cd799450010",
			externalId: "EXT-SEED-010",
			employeeId: "EMP-010",
			firstName: "Jennifer",
			lastName: "Thomas",
			email: "jennifer.thomas@company.com",
			phone: "+1234567899",
			employmentStatus: "INACTIVE",
			employmentType: "REGULAR",
			departmentName: "Sales",
			positionTitle: "Sales Representative",
			basicSalary: 55000,
			currency: "PHP",
			payFrequency: "MONTHLY",
			workLocation: "ONSITE",
			isManager: false,
			syncStatus: SyncStatus.LOCAL_ONLY,
			isTour: false,
			isDeleted: false,
		},
	];

	try {
		// Clear existing employees
		console.log("🗑️  Clearing existing employees...");
		await prisma.employee.deleteMany({});
		console.log("   ✓ Employees deleted");

		// Create employees
		console.log("📝 Creating employee records...");
		await prisma.employee.createMany({
			data: employeeData.map((e, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...e, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${employeeData.length} employee records`);

		// Display summary
		const byStatus = employeeData.reduce((acc, e) => {
			acc[e.employmentStatus] = (acc[e.employmentStatus] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		const byDepartment = employeeData.reduce((acc, e) => {
			acc[e.departmentName] = (acc[e.departmentName] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		console.log("\n📊 Employee Summary:");
		console.log("   📋 By Status:");
		Object.entries(byStatus).forEach(([status, count]) => {
			console.log(`      - ${status}: ${count}`);
		});
		console.log("   🏢 By Department:");
		Object.entries(byDepartment).forEach(([dept, count]) => {
			console.log(`      - ${dept}: ${count}`);
		});
		console.log(`\n   📈 Total Employees: ${employeeData.length}`);

		console.log("\n🎉 Employee seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during employee seeding:", error);
		throw error;
	}
}
