import { PrismaClient } from "../generated/prisma";
import * as argon2 from "argon2";
import { seedWorkspace } from "./seeds/workspaceSeeder";
import { seedTemplates } from "./seeds/templateSeeder";
import { seedProject } from "./seeds/projectSeeder";
import { seedEstimation } from "./seeds/estimationSeeder";
import { seedSequential } from "./seeds/sequentialSeeder";
import { seedVendor } from "./seeds/vendorSeeder";
import { seedOrder } from "./seeds/orderSeeder";
import { seedItem } from "./seeds/itemSeeder";
import { seedPayslip } from "./seeds/payslipSeeder";
import { seedTransaction } from "./seeds/transactionSeeder";
import { seedCategory } from "./seeds/categorySeeder";
import { seedField } from "./seeds/fieldSeeder";
import { seedItemType } from "./seeds/itemTypeSeeder";
import { seedProduct } from "./seeds/productSeeder";
import { seedMilestone } from "./seeds/milestoneSeeder";
import { seedUsageCode } from "./seeds/usageCodeSeeder";
import { seedEmployee } from "./seeds/employeeSeeder";
import { seedPurchaseOrder } from "./seeds/purchaseOrderSeeder";
import { seedDeliveryOrder } from "./seeds/deliveryOrderSeeder";
import { seedInvoice } from "./seeds/invoiceSeeder";
import { seedPaymentTerm } from "./seeds/paymentTermSeeder";
import { seedPOType } from "./seeds/poTypeSeeder";
import { seedPaymentSchedule } from "./seeds/paymentScheduleSeeder";
import { seedWorkspaceMember } from "./seeds/workspaceMemberSeeder";
import { seedProjectMember } from "./seeds/projectMemberSeeder";
import { seedDemand } from "./seeds/demandSeeder";

const prisma = new PrismaClient();

async function main() {
	console.log(`\n🏢 Seeding data distributed across ALL workspaces\n`);

	// Seed workspaces first
	await seedWorkspace(prisma);

	// Get ALL workspace IDs
	const workspaces = await prisma.workspace.findMany({
		where: { isDeleted: false },
		select: { id: true, name: true },
	});
	const workspaceIds = workspaces.map((ws) => ws.id);

	console.log(`\n📍 Found ${workspaceIds.length} workspaces:`);
	workspaces.forEach((ws) => console.log(`   - ${ws.name} (${ws.id})`));
	console.log(`\n📦 Data will be distributed across all workspaces\n`);

	// Seed data in order (respecting dependencies)
	// Pass all workspace IDs - seeders will distribute data across them
	await seedTemplates(prisma, workspaceIds);
	await seedSequential(prisma, workspaceIds);
	await seedUsageCode(prisma, workspaceIds);
	await seedEmployee(prisma, workspaceIds);
	await seedWorkspaceMember(prisma, workspaceIds);
	await seedProject(prisma, workspaceIds);
	await seedProjectMember(prisma, workspaceIds);
	await seedCategory(prisma, workspaceIds);
	await seedField(prisma, workspaceIds);
	await seedItemType(prisma, workspaceIds);
	await seedProduct(prisma, workspaceIds);
	await seedMilestone(prisma, workspaceIds);
	await seedEstimation(prisma, workspaceIds);
	await seedVendor(prisma, workspaceIds);
	await seedPaymentTerm(prisma, workspaceIds);
	await seedPOType(prisma, workspaceIds);
	await seedOrder(prisma, workspaceIds);
	await seedItem(prisma, workspaceIds);
	await seedPayslip(prisma, workspaceIds);
	await seedTransaction(prisma, workspaceIds);
	await seedPurchaseOrder(prisma, workspaceIds);
	await seedPaymentSchedule(prisma, workspaceIds);
	await seedDeliveryOrder(prisma, workspaceIds);
	await seedInvoice(prisma, workspaceIds);
	await seedDemand(prisma, workspaceIds);

	console.log("Seeding completed successfully!");
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error("Error during seeding:", e);
		await prisma.$disconnect();
		process.exit(1);
	});
