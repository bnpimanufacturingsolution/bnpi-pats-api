import {
	PrismaClient,
	MilestonePhase,
	MilestoneStatus,
	MilestonePriority,
} from "../../generated/prisma";

// Helper function to generate project-specific milestones
function generateMilestonesForProject(project: any, startingId: number) {
	const projectIdHex = startingId.toString(16).padStart(3, "0");
	const baseId = `608f1f77bcf86cd799${projectIdHex}`;
	const milestones: any[] = [];

	// Determine project phase based on status
	const isCompleted = project.status === "COMPLETED";
	const isActive = project.status === "ACTIVE";
	const isPending = project.status === "PENDING";
	const isCancelled = project.status === "CANCELLED";
	const isOnHold = project.status === "ON_HOLD";

	// Milestone 1: Requirements & Planning
	milestones.push({
		id: `${baseId}001`,
		title: `${project.name} - Requirements & Planning`,
		description: `Define requirements, scope, and create project plan for ${project.name}`,
		phase: MilestonePhase.FOUNDATION,
		status:
			isCompleted || isActive || isOnHold || isCancelled
				? MilestoneStatus.COMPLETED
				: MilestoneStatus.NOT_STARTED,
		priority: MilestonePriority.CRITICAL,
		progressPercent: isCompleted || isActive || isOnHold || isCancelled ? 100 : isPending ? 20 : 0,
		projectId: project.id,
		completedDate:
			isCompleted || isActive || isOnHold || isCancelled ? new Date(project.startDate) : null,
		startDate: isPending ? null : new Date(project.startDate),
		targetDate: new Date(project.startDate),
	});

	// Milestone 2: Design & Architecture
	milestones.push({
		id: `${baseId}002`,
		title: `${project.name} - Design & Architecture`,
		description: `Create technical design and architecture for ${project.name}`,
		phase: MilestonePhase.CORE_MODULES,
		status:
			isCompleted || isActive
				? MilestoneStatus.COMPLETED
				: isCancelled
					? MilestoneStatus.CANCELLED
					: isOnHold
						? MilestoneStatus.ON_HOLD
						: MilestoneStatus.NOT_STARTED,
		priority: MilestonePriority.HIGH,
		progressPercent: isCompleted || isActive ? 100 : isOnHold ? 60 : isCancelled ? 30 : 0,
		projectId: project.id,
		completedDate:
			isCompleted || isActive
				? new Date(project.startDate.getTime() + 30 * 24 * 60 * 60 * 1000)
				: null,
		startDate:
			isCompleted || isActive || isOnHold || isCancelled ? new Date(project.startDate) : null,
		targetDate: new Date(project.startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
	});

	// Milestone 3: Development/Implementation
	milestones.push({
		id: `${baseId}003`,
		title: `${project.name} - Development & Implementation`,
		description: `Core development and implementation phase for ${project.name}`,
		phase: MilestonePhase.ADVANCED_FEATURES,
		status: isCompleted
			? MilestoneStatus.COMPLETED
			: isActive
				? MilestoneStatus.IN_PROGRESS
				: isCancelled
					? MilestoneStatus.CANCELLED
					: isOnHold
						? MilestoneStatus.ON_HOLD
						: MilestoneStatus.NOT_STARTED,
		priority: MilestonePriority.CRITICAL,
		progressPercent: isCompleted ? 100 : isActive ? 65 : isOnHold ? 45 : isCancelled ? 25 : 0,
		projectId: project.id,
		completedDate: isCompleted
			? new Date(project.endDate.getTime() - 60 * 24 * 60 * 60 * 1000)
			: null,
		startDate:
			isCompleted || isActive || isOnHold || isCancelled
				? new Date(project.startDate.getTime() + 30 * 24 * 60 * 60 * 1000)
				: null,
		targetDate: new Date(project.endDate.getTime() - 60 * 24 * 60 * 60 * 1000),
	});

	// Milestone 4: Testing & QA
	milestones.push({
		id: `${baseId}004`,
		title: `${project.name} - Testing & Quality Assurance`,
		description: `Comprehensive testing and quality assurance for ${project.name}`,
		phase: MilestonePhase.ENHANCED_FEATURES,
		status: isCompleted
			? MilestoneStatus.COMPLETED
			: isActive
				? MilestoneStatus.IN_PROGRESS
				: isCancelled
					? MilestoneStatus.CANCELLED
					: MilestoneStatus.NOT_STARTED,
		priority: MilestonePriority.HIGH,
		progressPercent: isCompleted ? 100 : isActive ? 40 : isCancelled ? 10 : 0,
		projectId: project.id,
		completedDate: isCompleted
			? new Date(project.endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
			: null,
		startDate:
			isCompleted || isActive
				? new Date(project.endDate.getTime() - 60 * 24 * 60 * 60 * 1000)
				: null,
		targetDate: new Date(project.endDate.getTime() - 30 * 24 * 60 * 60 * 1000),
	});

	// Milestone 5: Deployment & Launch
	milestones.push({
		id: `${baseId}005`,
		title: `${project.name} - Deployment & Launch`,
		description: `Final deployment and launch of ${project.name}`,
		phase: MilestonePhase.INTEGRATION_OPTIMIZATION,
		status: isCompleted
			? MilestoneStatus.COMPLETED
			: isCancelled
				? MilestoneStatus.CANCELLED
				: MilestoneStatus.NOT_STARTED,
		priority: MilestonePriority.CRITICAL,
		progressPercent: isCompleted ? 100 : isCancelled ? 5 : 0,
		projectId: project.id,
		completedDate: isCompleted ? new Date(project.endDate) : null,
		startDate: isCompleted
			? new Date(project.endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
			: null,
		targetDate: new Date(project.endDate),
	});

	return milestones;
}

export async function seedMilestone(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting milestone seeding...");

	// Support both single ID and array of IDs
	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	// Get existing projects and estimations to create relationships
	const projects = await prisma.project.findMany({}); // Get ALL projects
	const estimations = await prisma.estimation.findMany({ take: 5 });

	console.log(
		`📊 Found ${projects.length} projects and ${estimations.length} estimations for milestone relationships`,
	);

	if (projects.length === 0) {
		console.log("⚠️  No projects found. Please seed projects first.");
		return;
	}

	// Generate milestones for each project
	const milestoneData: any[] = [];
	let milestoneIdCounter = 1;

	for (const project of projects) {
		const projectMilestones = generateMilestonesForProject(project, milestoneIdCounter);
		milestoneData.push(...projectMilestones);
		milestoneIdCounter += projectMilestones.length;
	}

	// Helper function to distribute projects evenly across system milestones
	const getProjectIdForMilestone = (index: number) => {
		if (projects.length === 0) return undefined;
		return projects[index % projects.length]?.id;
	};

	// Add the original 42 system-wide milestones (for overall platform development)
	// Now distributed evenly across ALL available projects
	const systemMilestones = [
		// Phase 1: Core Foundation (All Completed)
		{
			id: "608f1f77bcf86cd799460001",
			title: "Project scaffolding and architecture setup",
			description: "Set up the foundational project structure and architecture patterns",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "CRITICAL",
			progressPercent: 100,
			completedDate: new Date("2024-01-15"),
			projectId: getProjectIdForMilestone(0),
		},
		{
			id: "608f1f77bcf86cd799460002",
			title: "MongoDB integration with Prisma ORM",
			description: "Integrate MongoDB database with Prisma ORM",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "CRITICAL",
			progressPercent: 100,
			completedDate: new Date("2024-01-20"),
			projectId: getProjectIdForMilestone(1),
		},
		{
			id: "608f1f77bcf86cd799460003",
			title: "Express.js REST API framework",
			description: "Set up Express.js server with REST API endpoints",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "CRITICAL",
			progressPercent: 100,
			completedDate: new Date("2024-01-22"),
			projectId: getProjectIdForMilestone(2),
		},
		{
			id: "608f1f77bcf86cd799460004",
			title: "TypeScript configuration and type safety",
			description: "Configure TypeScript for strict type checking",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "HIGH",
			progressPercent: 100,
			completedDate: new Date("2024-01-18"),
			projectId: getProjectIdForMilestone(3),
		},
		{
			id: "608f1f77bcf86cd799460005",
			title: "Authentication & authorization (JWT)",
			description: "Implement JWT-based authentication and authorization",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "CRITICAL",
			progressPercent: 100,
			completedDate: new Date("2024-01-25"),
			projectId: getProjectIdForMilestone(4),
		},
		{
			id: "608f1f77bcf86cd799460006",
			title: "Logging system (Winston + Logtail)",
			description: "Implement comprehensive logging with Winston and Logtail",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-01-28"),
			projectId: getProjectIdForMilestone(5),
		},
		{
			id: "608f1f77bcf86cd799460007",
			title: "Error handling and validation (Zod)",
			description: "Implement error handling and input validation using Zod",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "HIGH",
			progressPercent: 100,
			completedDate: new Date("2024-01-30"),
			projectId: getProjectIdForMilestone(6),
		},
		{
			id: "608f1f77bcf86cd799460008",
			title: "Redis caching layer",
			description: "Implement Redis caching for improved performance",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-02-02"),
			projectId: getProjectIdForMilestone(7),
		},
		{
			id: "608f1f77bcf86cd799460009",
			title: "Docker containerization",
			description: "Create Docker configuration for containerized deployment",
			phase: "FOUNDATION",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-02-05"),
			projectId: getProjectIdForMilestone(8),
		},

		// Phase 2: Core Modules (All Completed) - Distributed evenly across all projects
		{
			id: "608f1f77bcf86cd799460010",
			title: "Project management module",
			description: "Implement complete project lifecycle management",
			phase: "CORE_MODULES",
			status: "COMPLETED",
			priority: "CRITICAL",
			progressPercent: 100,
			completedDate: new Date("2024-02-15"),
			projectId: getProjectIdForMilestone(9),
		},
		{
			id: "608f1f77bcf86cd799460011",
			title: "Estimation system with financial calculations",
			description: "Build estimation system with automatic financial calculations",
			phase: "CORE_MODULES",
			status: "COMPLETED",
			priority: "CRITICAL",
			progressPercent: 100,
			completedDate: new Date("2024-02-20"),
			projectId: getProjectIdForMilestone(10),
		},
		{
			id: "608f1f77bcf86cd799460012",
			title: "Item management with hierarchies",
			description: "Implement item tracking with parent-child hierarchies",
			phase: "CORE_MODULES",
			status: "COMPLETED",
			priority: "HIGH",
			progressPercent: 100,
			completedDate: new Date("2024-02-25"),
			projectId: getProjectIdForMilestone(11),
		},
		{
			id: "608f1f77bcf86cd799460013",
			title: "Category management",
			description: "Build category system for organizing items and costs",
			phase: "CORE_MODULES",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-03-01"),
			projectId: getProjectIdForMilestone(12),
		},
		{
			id: "608f1f77bcf86cd799460014",
			title: "Vendor management",
			description: "Implement vendor tracking and contact management",
			phase: "CORE_MODULES",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-03-05"),
			projectId: getProjectIdForMilestone(13),
		},
		{
			id: "608f1f77bcf86cd799460015",
			title: "Order processing",
			description: "Build purchase order management system",
			phase: "CORE_MODULES",
			status: "COMPLETED",
			priority: "HIGH",
			progressPercent: 100,
			completedDate: new Date("2024-03-10"),
			projectId: getProjectIdForMilestone(14),
		},
		{
			id: "608f1f77bcf86cd799460016",
			title: "Payslip tracking",
			description: "Implement employee payment tracking system",
			phase: "CORE_MODULES",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-03-15"),
			projectId: getProjectIdForMilestone(15),
		},
		{
			id: "608f1f77bcf86cd799460017",
			title: "Template system",
			description: "Create reusable templates for estimations and projects",
			phase: "CORE_MODULES",
			status: "COMPLETED",
			priority: "LOW",
			progressPercent: 100,
			completedDate: new Date("2024-03-18"),
			projectId: getProjectIdForMilestone(16),
		},
		{
			id: "608f1f77bcf86cd799460018",
			title: "Sequential number generators",
			description: "Build auto-incrementing number system for documents",
			phase: "CORE_MODULES",
			status: "COMPLETED",
			priority: "LOW",
			progressPercent: 100,
			completedDate: new Date("2024-03-20"),
			projectId: getProjectIdForMilestone(17),
		},

		// Phase 3: Advanced Features (All Completed) - Distributed evenly
		{
			id: "608f1f77bcf86cd799460019",
			title: "Dynamic field system (11+ field types)",
			description: "Implement dynamic custom fields with 11+ different types",
			phase: "ADVANCED_FEATURES",
			status: "COMPLETED",
			priority: "HIGH",
			progressPercent: 100,
			completedDate: new Date("2024-04-01"),
			projectId: getProjectIdForMilestone(18),
		},
		{
			id: "608f1f77bcf86cd799460020",
			title: "ItemType categorization system",
			description: "Build item type system for CAPEX/OPEX/MISC categorization",
			phase: "ADVANCED_FEATURES",
			status: "COMPLETED",
			priority: "CRITICAL",
			progressPercent: 100,
			completedDate: new Date("2024-04-10"),
			projectId: getProjectIdForMilestone(19),
		},
		{
			id: "608f1f77bcf86cd799460021",
			title: "CAPEX/OPEX/MISC financial breakdown",
			description: "Implement automatic financial breakdown calculations",
			phase: "ADVANCED_FEATURES",
			status: "COMPLETED",
			priority: "CRITICAL",
			progressPercent: 100,
			completedDate: new Date("2024-04-12"),
			projectId: getProjectIdForMilestone(20),
		},
		{
			id: "608f1f77bcf86cd799460022",
			title: "Automatic metadata calculations",
			description: "Build automatic calculation engine for estimation metadata",
			phase: "ADVANCED_FEATURES",
			status: "COMPLETED",
			priority: "HIGH",
			progressPercent: 100,
			completedDate: new Date("2024-04-15"),
			projectId: getProjectIdForMilestone(21),
		},
		{
			id: "608f1f77bcf86cd799460023",
			title: "Category subtotals",
			description: "Implement automatic category-wise subtotal calculations",
			phase: "ADVANCED_FEATURES",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-04-18"),
			projectId: getProjectIdForMilestone(22),
		},
		{
			id: "608f1f77bcf86cd799460024",
			title: "Item hierarchy (parent-child)",
			description: "Extend item system with parent-child hierarchies",
			phase: "ADVANCED_FEATURES",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-04-20"),
			projectId: getProjectIdForMilestone(23),
		},
		{
			id: "608f1f77bcf86cd799460025",
			title: "Document upload (Cloudinary)",
			description: "Integrate Cloudinary for document uploads and management",
			phase: "ADVANCED_FEATURES",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-04-25"),
			projectId: getProjectIdForMilestone(24),
		},
		{
			id: "608f1f77bcf86cd799460026",
			title: "Comprehensive test suites (25+ tests per module)",
			description: "Build comprehensive test coverage for all modules",
			phase: "ADVANCED_FEATURES",
			status: "COMPLETED",
			priority: "HIGH",
			progressPercent: 100,
			completedDate: new Date("2024-04-28"),
			projectId: getProjectIdForMilestone(25),
		},
		{
			id: "608f1f77bcf86cd799460027",
			title: "Database seeders for all modules",
			description: "Create seeders for all database models",
			phase: "ADVANCED_FEATURES",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-04-30"),
			projectId: getProjectIdForMilestone(26),
		},
		{
			id: "608f1f77bcf86cd799460028",
			title: "OpenAPI/Swagger documentation",
			description: "Generate comprehensive API documentation with Swagger",
			phase: "ADVANCED_FEATURES",
			status: "COMPLETED",
			priority: "MEDIUM",
			progressPercent: 100,
			completedDate: new Date("2024-05-02"),
			projectId: getProjectIdForMilestone(27),
		},

		// Phase 4: Enhanced Features (In Progress)
		{
			id: "608f1f77bcf86cd799460029",
			title: "User management and roles",
			description: "Implement comprehensive user management with role-based access",
			phase: "ENHANCED_FEATURES",
			status: "IN_PROGRESS",
			priority: "HIGH",
			progressPercent: 60,
			startDate: new Date("2024-05-05"),
			targetDate: new Date("2024-06-15"),
			projectId: getProjectIdForMilestone(28),
			estimationId: estimations[0]?.id,
		},
		{
			id: "608f1f77bcf86cd799460030",
			title: "Real-time notifications (Socket.IO)",
			description: "Build real-time notification system using Socket.IO",
			phase: "ENHANCED_FEATURES",
			status: "IN_PROGRESS",
			priority: "MEDIUM",
			progressPercent: 40,
			startDate: new Date("2024-05-10"),
			targetDate: new Date("2024-06-20"),
			projectId: getProjectIdForMilestone(29),
		},
		{
			id: "608f1f77bcf86cd799460031",
			title: "Advanced reporting and analytics",
			description: "Create advanced reporting and analytics dashboard",
			phase: "ENHANCED_FEATURES",
			status: "NOT_STARTED",
			priority: "HIGH",
			progressPercent: 0,
			targetDate: new Date("2024-07-01"),
			projectId: getProjectIdForMilestone(30),
		},
		{
			id: "608f1f77bcf86cd799460032",
			title: "Export functionality (PDF, Excel)",
			description: "Implement PDF and Excel export for reports and data",
			phase: "ENHANCED_FEATURES",
			status: "NOT_STARTED",
			priority: "MEDIUM",
			progressPercent: 0,
			targetDate: new Date("2024-07-15"),
			projectId: getProjectIdForMilestone(31),
		},
		{
			id: "608f1f77bcf86cd799460033",
			title: "Budget vs Actual variance reporting",
			description: "Build variance analysis reporting for budget tracking",
			phase: "ENHANCED_FEATURES",
			status: "NOT_STARTED",
			priority: "HIGH",
			progressPercent: 0,
			targetDate: new Date("2024-07-20"),
			projectId: getProjectIdForMilestone(32),
		},
		{
			id: "608f1f77bcf86cd799460034",
			title: "Timeline and Gantt chart data",
			description: "Implement timeline and Gantt chart data APIs",
			phase: "ENHANCED_FEATURES",
			status: "NOT_STARTED",
			priority: "MEDIUM",
			progressPercent: 0,
			targetDate: new Date("2024-08-01"),
			projectId: getProjectIdForMilestone(33),
		},
		{
			id: "608f1f77bcf86cd799460035",
			title: "Resource management tracking",
			description: "Build resource management and tracking system",
			phase: "ENHANCED_FEATURES",
			status: "NOT_STARTED",
			priority: "MEDIUM",
			progressPercent: 0,
			targetDate: new Date("2024-08-15"),
			projectId: getProjectIdForMilestone(34),
		},
		{
			id: "608f1f77bcf86cd799460036",
			title: "Multi-currency support",
			description: "Implement multi-currency support with exchange rates",
			phase: "ENHANCED_FEATURES",
			status: "NOT_STARTED",
			priority: "LOW",
			progressPercent: 0,
			targetDate: new Date("2024-08-30"),
			projectId: getProjectIdForMilestone(35),
		},

		// Phase 5: Integration & Optimization (Planned) - Distributed evenly
		{
			id: "608f1f77bcf86cd799460037",
			title: "Email notifications",
			description: "Implement email notification system for key events",
			phase: "INTEGRATION_OPTIMIZATION",
			status: "NOT_STARTED",
			priority: "MEDIUM",
			progressPercent: 0,
			targetDate: new Date("2024-09-15"),
			projectId: getProjectIdForMilestone(36),
		},
		{
			id: "608f1f77bcf86cd799460038",
			title: "Webhook support",
			description: "Add webhook support for third-party integrations",
			phase: "INTEGRATION_OPTIMIZATION",
			status: "NOT_STARTED",
			priority: "LOW",
			progressPercent: 0,
			targetDate: new Date("2024-09-30"),
			projectId: getProjectIdForMilestone(37),
		},
		{
			id: "608f1f77bcf86cd799460039",
			title: "API rate limiting per user",
			description: "Implement per-user API rate limiting",
			phase: "INTEGRATION_OPTIMIZATION",
			status: "NOT_STARTED",
			priority: "MEDIUM",
			progressPercent: 0,
			targetDate: new Date("2024-10-10"),
			projectId: getProjectIdForMilestone(38),
		},
		{
			id: "608f1f77bcf86cd799460040",
			title: "Advanced caching strategies",
			description: "Optimize caching with advanced strategies and invalidation",
			phase: "INTEGRATION_OPTIMIZATION",
			status: "NOT_STARTED",
			priority: "MEDIUM",
			progressPercent: 0,
			targetDate: new Date("2024-10-20"),
			projectId: getProjectIdForMilestone(39),
		},

		// Phase 6: Enterprise Features (Future) - Distributed evenly
		{
			id: "608f1f77bcf86cd799460041",
			title: "Multi-tenant architecture",
			description: "Implement multi-tenant support for enterprise clients",
			phase: "ENTERPRISE_FEATURES",
			status: "NOT_STARTED",
			priority: "CRITICAL",
			progressPercent: 0,
			targetDate: new Date("2025-01-15"),
			projectId: getProjectIdForMilestone(40),
		},
		{
			id: "608f1f77bcf86cd799460042",
			title: "AI-powered cost predictions",
			description: "Integrate AI for cost prediction and forecasting",
			phase: "ENTERPRISE_FEATURES",
			status: "NOT_STARTED",
			priority: "HIGH",
			progressPercent: 0,
			targetDate: new Date("2025-03-01"),
			projectId: getProjectIdForMilestone(41),
		},
	];

	// Combine project-specific milestones with system-wide milestones
	milestoneData.push(...systemMilestones);

	console.log(
		`📊 Generated ${milestoneData.length} total milestones for ${projects.length} projects:`,
	);
	console.log(
		`   - Project-specific (5 per project): ${milestoneData.length - systemMilestones.length}`,
	);
	console.log(`   - System-wide (distributed across all projects): ${systemMilestones.length}`);

	try {
		// Clear existing milestones
		console.log("\n🗑️  Clearing existing milestones...");
		await prisma.milestone.deleteMany({});
		console.log("   ✓ Milestones deleted");

		// Create milestones
		console.log("📝 Creating milestone records...");
		await prisma.milestone.createMany({
			data: milestoneData.map((m, index) => {
				const orgId = orgIds[index % orgIds.length];
				return { ...m, workspaceId: orgId, organizationId: orgId };
			}),
		});

		console.log(`✅ Successfully created ${milestoneData.length} milestone records`);

		// Display summary
		const completedMilestones = milestoneData.filter((m) => m.status === "COMPLETED").length;
		const inProgressMilestones = milestoneData.filter((m) => m.status === "IN_PROGRESS").length;
		const notStartedMilestones = milestoneData.filter((m) => m.status === "NOT_STARTED").length;
		const cancelledMilestones = milestoneData.filter((m) => m.status === "CANCELLED").length;
		const onHoldMilestones = milestoneData.filter((m) => m.status === "ON_HOLD").length;

		const milestonesByPhase = milestoneData.reduce(
			(acc, m) => {
				acc[m.phase] = (acc[m.phase] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		);

		const milestonesByProject = milestoneData.reduce(
			(acc, m) => {
				const projectKey = m.projectId || "unassigned";
				acc[projectKey] = (acc[projectKey] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		);

		console.log("\n📊 Milestone Summary:");
		console.log(`   ✅ Completed: ${completedMilestones}`);
		console.log(`   🚧 In Progress: ${inProgressMilestones}`);
		console.log(`   📋 Not Started: ${notStartedMilestones}`);
		console.log(`   ❌ Cancelled: ${cancelledMilestones}`);
		console.log(`   ⏸️  On Hold: ${onHoldMilestones}`);
		console.log("\n   📈 Milestones by Phase:");
		Object.entries(milestonesByPhase).forEach(([phase, count]) => {
			console.log(`      - ${phase}: ${count}`);
		});
		console.log("\n   🔗 Milestones by Project:");
		Object.entries(milestonesByProject).forEach(([projectId, count]) => {
			if (projectId === "unassigned") {
				console.log(`      - Unassigned: ${count}`);
			} else {
				const project = projects.find((p) => p.id === projectId);
				console.log(`      - ${project?.name || projectId}: ${count}`);
			}
		});
		console.log(`\n   🎯 Total Milestones: ${milestoneData.length}`);

		console.log("\n🎉 Milestone seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during milestone seeding:", error);
		throw error;
	}
}
