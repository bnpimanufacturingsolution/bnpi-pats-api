import { PrismaClient, PurchaseOrder } from "../../generated/prisma";
import { createLogger } from "../../helper/logger";
import { updateEstimationTotalsAndMetadata } from "../../utils/calculations";
import { createPaymentScheduleService } from "../paymentSchedule/paymentSchedule.service";

const logger = createLogger("purchaseOrder.service");

export const createPurchaseOrderService = (prisma: PrismaClient) => {
	const paymentScheduleService = createPaymentScheduleService(prisma);

	/**
	 * Handle all side effects when a PO status changes.
	 * Called after the PO has been updated in the database.
	 */
	const handleStatusChange = async (
		existingPO: PurchaseOrder,
		updatedPO: PurchaseOrder,
		workspaceId: string,
	): Promise<void> => {
		const wasJustApproved =
			existingPO.status !== "APPROVED" && updatedPO.status === "APPROVED";

		const wasJustCancelled =
			existingPO.status !== "CANCELLED" && updatedPO.status === "CANCELLED";

		const syncStatuses = ["APPROVED", "COMPLETED"];
		const shouldSyncItems =
			!syncStatuses.includes(existingPO.status) &&
			syncStatuses.includes(updatedPO.status);

		// Run independent side effects in parallel where possible
		const tasks: Promise<void>[] = [];

		if (wasJustApproved && updatedPO.projectId) {
			tasks.push(generatePaymentScheduleOnApproval(updatedPO.id, workspaceId));
		}

		if (wasJustCancelled) {
			tasks.push(cancelPaymentSchedule(updatedPO.id));
		}

		if (shouldSyncItems) {
			tasks.push(syncItemActualsFromPO(updatedPO));
		}

		await Promise.allSettled(tasks);
	};

	/**
	 * Generate a payment schedule when PO is approved.
	 */
	const generatePaymentScheduleOnApproval = async (
		poId: string,
		workspaceId: string,
	): Promise<void> => {
		try {
			await paymentScheduleService.generateScheduleFromPO(poId, workspaceId);
			logger.info(`Payment schedule generated for PO ${poId}`);
		} catch (err) {
			logger.error(`Failed to generate payment schedule for PO ${poId}:`, err);
		}
	};

	/**
	 * Cancel the payment schedule when PO is cancelled.
	 * Already-paid items remain PAID; others become CANCELLED.
	 */
	const cancelPaymentSchedule = async (poId: string): Promise<void> => {
		try {
			const schedule = await prisma.paymentSchedule.findFirst({
				where: { purchaseOrderId: poId, isDeleted: false },
			});

			if (!schedule || schedule.status !== "ACTIVE") return;

			const cancelledItems = schedule.items.map((item) => ({
				...item,
				status: item.status === "PAID" ? "PAID" : "CANCELLED",
			}));

			await prisma.paymentSchedule.update({
				where: { id: schedule.id },
				data: { status: "CANCELLED", items: cancelledItems },
			});

			logger.info(`Payment schedule cancelled for PO ${poId}`);
		} catch (err) {
			logger.error(`Failed to cancel payment schedule for PO ${poId}:`, err);
		}
	};

	/**
	 * Sync item actuals from PO line items.
	 * Fixes N+1 by batch-fetching all linked items upfront.
	 */
	const syncItemActualsFromPO = async (updatedPO: PurchaseOrder): Promise<void> => {
		try {
			const poItems = updatedPO.items as {
				description: string;
				quantity: number;
				unitPrice: number;
				totalPrice: number;
			}[];

			if (!poItems?.length) return;

			// Batch fetch: get all linked items with their current actuals in one query
			const linkedItems = await prisma.item.findMany({
				where: { purchaseOrderId: updatedPO.id, isDeleted: false },
				select: {
					id: true,
					itemName: true,
					estimationId: true,
					actualQuantity: true,
					actualTotal: true,
				},
			});

			if (!linkedItems.length) return;

			const estimationIds = new Set<string>();
			const updatePromises: Promise<unknown>[] = [];

			for (const item of linkedItems) {
				if (item.estimationId) estimationIds.add(item.estimationId);

				const matchingPoItem = poItems.find(
					(poItem) =>
						poItem.description.toLowerCase().includes(item.itemName.toLowerCase()) ||
						item.itemName.toLowerCase().includes(poItem.description.toLowerCase()),
				);

				if (!matchingPoItem) {
					logger.warn(`No matching PO item found for Item ${item.id} (${item.itemName}), skipping`);
					continue;
				}

				// Accumulate actuals (current values already fetched in the batch query)
				const existingQty = item.actualQuantity || 0;
				const existingTotal = item.actualTotal || 0;
				const newActualQuantity = existingQty + matchingPoItem.quantity;
				const newActualTotal = existingTotal + matchingPoItem.totalPrice;
				const newActualUnitPrice =
					newActualQuantity > 0 ? newActualTotal / newActualQuantity : matchingPoItem.unitPrice;

				updatePromises.push(
					prisma.item.update({
						where: { id: item.id },
						data: {
							actualQuantity: newActualQuantity,
							actualUnitPrice: newActualUnitPrice,
							actualTotal: newActualTotal,
						},
					}),
				);

				logger.info(
					`Item ${item.id} (${item.itemName}) actuals accumulated from PO: qty=${existingQty}+${matchingPoItem.quantity}=${newActualQuantity}, total=${existingTotal}+${matchingPoItem.totalPrice}=${newActualTotal}`,
				);
			}

			// Parallel item updates instead of sequential
			await Promise.all(updatePromises);
			logger.info(`Synced ${linkedItems.length} item(s) actuals from PO ${updatedPO.id}`);

			// Recalculate estimation totals for all affected estimations in parallel
			await Promise.all(
				[...estimationIds].map(async (estimationId) => {
					try {
						await updateEstimationTotalsAndMetadata(prisma, estimationId);
						logger.info(`Recalculated estimation totals for estimation ${estimationId}`);
					} catch (err) {
						logger.error(`Failed to recalculate estimation ${estimationId}:`, err);
					}
				}),
			);
		} catch (err) {
			logger.error(`Failed to sync item actuals from PO ${updatedPO.id}:`, err);
		}
	};

	return { handleStatusChange };
};

export type PurchaseOrderService = ReturnType<typeof createPurchaseOrderService>;
