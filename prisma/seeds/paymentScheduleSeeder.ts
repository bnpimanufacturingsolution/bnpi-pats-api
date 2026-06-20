import { PrismaClient } from "../../generated/prisma";

export async function seedPaymentSchedule(prisma: PrismaClient, workspaceIds: string | string[]) {
	console.log("🌱 Starting payment schedule seeding...");

	const orgIds = Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds];

	try {
		// Clear existing payment schedules
		console.log("🗑️  Clearing existing payment schedules...");
		await prisma.paymentSchedule.deleteMany({});
		console.log("   ✓ Payment schedules deleted");

		// Get all POs that should have schedules (APPROVED or COMPLETED)
		const statusesWithSchedule = ["APPROVED", "COMPLETED"];
		const purchaseOrders = await prisma.purchaseOrder.findMany({
			where: {
				status: { in: statusesWithSchedule as any },
				isDeleted: false,
			},
			include: { paymentTerm: true },
		});

		if (purchaseOrders.length === 0) {
			console.log("⚠️  No approved/sent/partial/received POs found. Skipping schedule seeding.");
			return;
		}

		console.log(`📝 Creating payment schedules for ${purchaseOrders.length} PO(s)...`);

		let createdCount = 0;

		for (const po of purchaseOrders) {
			const approvalDate = po.approvalDate || new Date();
			const paymentTerm = po.paymentTerm as any;
			let scheduleItems: any[];

			if (paymentTerm && paymentTerm.installments && paymentTerm.installments.length > 0) {
				// Build items from payment term installments
				scheduleItems = paymentTerm.installments.map((inst: any) => {
					const dueDate = new Date(approvalDate);
					dueDate.setDate(dueDate.getDate() + inst.dueDaysFromApproval);
					const amount = Math.round((inst.percentage / 100) * po.totalAmount * 100) / 100;

					// Determine status based on PO status and due date
					let status = "UPCOMING";
					const now = new Date();
					now.setHours(0, 0, 0, 0);
					const dueDateNorm = new Date(dueDate);
					dueDateNorm.setHours(0, 0, 0, 0);

					if (po.status === "COMPLETED") {
						status = "PAID";
					} else if (dueDateNorm < now) {
						status = "OVERDUE";
					} else if (dueDateNorm.getTime() === now.getTime() || inst.dueDaysFromApproval === 0) {
						status = "DUE";
					}

					const paidAmount = status === "PAID" ? amount : 0;
					const balance = status === "PAID" ? 0 : amount;

					return {
						sequence: inst.sequence,
						description: inst.description,
						percentage: inst.percentage,
						amount,
						dueDate,
						status,
						paidAmount,
						balance,
						transactionIds: [] as string[],
					};
				});
			} else {
				// Default: single payment for full amount
				const dueDays = paymentTerm?.dueDays ?? 0;
				const dueDate = new Date(approvalDate);
				dueDate.setDate(dueDate.getDate() + dueDays);

				let status = "UPCOMING";
				const now = new Date();
				now.setHours(0, 0, 0, 0);
				const dueDateNorm = new Date(dueDate);
				dueDateNorm.setHours(0, 0, 0, 0);

				if (po.status === "COMPLETED") {
					status = "PAID";
				} else if (dueDateNorm < now) {
					status = "OVERDUE";
				} else if (dueDateNorm.getTime() === now.getTime() || dueDays === 0) {
					status = "DUE";
				}

				const paidAmount = status === "PAID" ? po.totalAmount : 0;
				const balance = status === "PAID" ? 0 : po.totalAmount;

				scheduleItems = [{
					sequence: 1,
					description: "Full Payment",
					percentage: 100,
					amount: po.totalAmount,
					dueDate,
					status,
					paidAmount,
					balance,
					transactionIds: [] as string[],
				}];
			}

			const totalPaid = scheduleItems.reduce((sum: number, item: any) => sum + item.paidAmount, 0);
			const scheduleBalance = po.totalAmount - totalPaid;
			const allPaid = scheduleItems.every((item: any) => item.status === "PAID");
			const scheduleStatus = allPaid ? "COMPLETED" : "ACTIVE";

			await prisma.paymentSchedule.create({
				data: {
					workspaceId: po.workspaceId,
					organizationId: po.organizationId,
					purchaseOrderId: po.id,
					paymentTermId: po.paymentTermId || null,
					items: scheduleItems,
					totalScheduled: po.totalAmount,
					totalPaid,
					balance: scheduleBalance,
					status: scheduleStatus,
				},
			});

			createdCount++;
			console.log(`   ✓ Schedule for ${po.poNumber} (${scheduleItems.length} item(s), status: ${scheduleStatus})`);
		}

		console.log(`\n✅ Successfully created ${createdCount} payment schedule records`);

		// Display summary
		const activeCount = (await prisma.paymentSchedule.count({ where: { status: "ACTIVE" } }));
		const completedCount = (await prisma.paymentSchedule.count({ where: { status: "COMPLETED" } }));

		console.log("\n📊 Payment Schedule Summary:");
		console.log(`   ✅ Active: ${activeCount}`);
		console.log(`   ✔️  Completed: ${completedCount}`);
		console.log(`\n   📈 Total Payment Schedules: ${createdCount}`);

		console.log("\n🎉 Payment schedule seeding completed successfully!");
	} catch (error) {
		console.error("❌ Error during payment schedule seeding:", error);
		throw error;
	}
}
