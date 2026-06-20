/**
 * Payment Schedule Service
 *
 * Business logic for generating payment schedules from POs,
 * releasing individual payments, and detecting overdue items.
 */

import { PrismaClient, TransactionType, PaymentMethod } from "../../generated/prisma";
import { createLogger } from "../../helper/logger";
import { createTransactionService } from "../transaction/transaction.service";
import { paymentScheduleRepository } from "./paymentSchedule.repository";

const logger = createLogger("payment-schedule-service");

export const createPaymentScheduleService = (prisma: PrismaClient) => {
	const repository = paymentScheduleRepository(prisma);
	const transactionService = createTransactionService(prisma);

	/**
	 * Generate a PaymentSchedule from a PO and its linked PaymentTerm.
	 * Called when PO status transitions to APPROVED.
	 * Idempotent: if a schedule already exists for the PO, returns it.
	 */
	const generateScheduleFromPO = async (
		purchaseOrderId: string,
		workspaceId: string,
	) => {
		// 1. Load PO with paymentTerm
		const po = await prisma.purchaseOrder.findFirst({
			where: { id: purchaseOrderId, isDeleted: false },
			include: { paymentTerm: true },
		});
		if (!po) throw new Error(`Purchase order not found: ${purchaseOrderId}`);

		// 2. Check if schedule already exists (idempotent via @unique on purchaseOrderId)
		const existing = await repository.getByPurchaseOrderId(purchaseOrderId, workspaceId);
		if (existing) {
			logger.info(`Schedule already exists for PO ${purchaseOrderId}, skipping generation`);
			return existing;
		}

		// 3. Build schedule items from PaymentTerm installments or fallback to single payment
		const approvalDate = po.approvalDate || new Date();
		const paymentTerm = po.paymentTerm as any;
		let scheduleItems;

		if (paymentTerm && paymentTerm.installments && paymentTerm.installments.length > 0) {
			// Use installment definitions from the payment term
			scheduleItems = paymentTerm.installments.map((inst: any) => {
				const dueDate = new Date(approvalDate);
				dueDate.setDate(dueDate.getDate() + inst.dueDaysFromApproval);
				const amount = Math.round((inst.percentage / 100) * po.totalAmount * 100) / 100;
				return {
					sequence: inst.sequence,
					description: inst.description,
					percentage: inst.percentage,
					amount,
					dueDate,
					status: inst.dueDaysFromApproval === 0 ? "DUE" : "UPCOMING",
					paidAmount: 0,
					balance: amount,
					transactionIds: [],
				};
			});
		} else {
			// Default: single payment for the full amount
			const dueDays = paymentTerm?.dueDays ?? 0;
			const dueDate = new Date(approvalDate);
			dueDate.setDate(dueDate.getDate() + dueDays);
			scheduleItems = [
				{
					sequence: 1,
					description: "Full Payment",
					percentage: 100,
					amount: po.totalAmount,
					dueDate,
					status: dueDays === 0 ? "DUE" : "UPCOMING",
					paidAmount: 0,
					balance: po.totalAmount,
					transactionIds: [],
				},
			];
		}

		// 4. Create the schedule
		const schedule = await prisma.paymentSchedule.create({
			data: {
				workspaceId,
				organizationId: po.organizationId,
				purchaseOrderId,
				paymentTermId: po.paymentTermId || null,
				items: scheduleItems,
				totalScheduled: po.totalAmount,
				totalPaid: 0,
				balance: po.totalAmount,
				status: "ACTIVE",
			},
		});

		logger.info(
			`Payment schedule created for PO ${po.poNumber}: ${scheduleItems.length} installment(s), total: ${po.totalAmount}`,
		);
		return schedule;
	};

	/**
	 * Release a payment against a specific schedule item.
	 * Creates a Transaction and updates the schedule.
	 */
	const releasePayment = async (params: {
		scheduleId: string;
		workspaceId: string;
		itemIndex: number;
		amount: number;
		paymentMethod?: string;
		payeeName?: string;
		checkDetails?: any;
		cashDetails?: any;
		bankTransferDetails?: any;
		onlineDetails?: any;
		documentUrls?: string[];
		userId?: string;
	}) => {
		const { scheduleId, workspaceId, itemIndex, amount } = params;

		// 1. Load and validate schedule
		const schedule = await prisma.paymentSchedule.findFirst({
			where: { id: scheduleId, isDeleted: false, workspaceId },
		});
		if (!schedule) throw new Error("Payment schedule not found");
		if (schedule.status !== "ACTIVE") throw new Error(`Schedule is ${schedule.status}, cannot release payment`);

		// 2. Validate the target item
		const item = schedule.items[itemIndex];
		if (!item) throw new Error(`Schedule item at index ${itemIndex} not found`);

		const validStatuses = ["DUE", "PARTIAL", "OVERDUE"];
		if (!validStatuses.includes(item.status)) {
			throw new Error(`Item status is ${item.status}, must be DUE, PARTIAL, or OVERDUE to release payment`);
		}
		if (amount > item.balance) {
			throw new Error(`Amount ${amount} exceeds item balance ${item.balance}`);
		}
		if (amount <= 0) {
			throw new Error("Amount must be positive");
		}

		// 3. Load PO for transaction creation context
		const po = await prisma.purchaseOrder.findFirst({
			where: { id: schedule.purchaseOrderId, isDeleted: false },
			include: { vendor: { select: { name: true } } },
		});
		if (!po) throw new Error("Linked purchase order not found");
		if (!po.projectId) throw new Error("Purchase order has no projectId, cannot create transaction");

		// 4. Create transaction via service
		const idempotencyKey = `ps-${scheduleId}-item-${itemIndex}-${Date.now()}`;
		const { transaction } = await transactionService.createTransaction({
			workspaceId,
			projectId: po.projectId,
			purchaseOrderId: po.id,
			transactionDate: new Date(),
			transactionType: TransactionType.OUTGOING,
			paymentMethod: (params.paymentMethod as PaymentMethod) || PaymentMethod.OTHER,
			payeeName: params.payeeName || po.vendor?.name || "Unknown Vendor",
			amount,
			idempotencyKey,
			checkDetails: params.checkDetails,
			cashDetails: params.cashDetails,
			bankTransferDetails: params.bankTransferDetails,
			onlineDetails: params.onlineDetails,
			documentUrls: params.documentUrls || [],
			userId: params.userId,
		});

		// 5. Update transaction with schedule link fields
		await prisma.transaction.update({
			where: { id: transaction.id },
			data: {
				paymentScheduleId: scheduleId,
				paymentScheduleItemIndex: itemIndex,
			},
		});

		// 6. Update schedule item
		const updatedItems = schedule.items.map((i, idx) => {
			if (idx !== itemIndex) return i;
			const newPaidAmount = i.paidAmount + amount;
			const newBalance = Math.round((i.amount - newPaidAmount) * 100) / 100;
			return {
				...i,
				paidAmount: newPaidAmount,
				balance: Math.max(newBalance, 0),
				status: newBalance <= 0 ? "PAID" : "PARTIAL",
				transactionIds: [...i.transactionIds, transaction.id],
			};
		});

		// 7. Update schedule totals
		const newTotalPaid = Math.round((schedule.totalPaid + amount) * 100) / 100;
		const newBalance = Math.max(Math.round((schedule.totalScheduled - newTotalPaid) * 100) / 100, 0);
		const allItemsPaid = updatedItems.every((i) => i.status === "PAID" || i.status === "CANCELLED");
		const newStatus = allItemsPaid ? "COMPLETED" : "ACTIVE";

		const updatedSchedule = await prisma.paymentSchedule.update({
			where: { id: scheduleId },
			data: {
				items: updatedItems,
				totalPaid: newTotalPaid,
				balance: newBalance,
				status: newStatus,
			},
		});

		// 8. If schedule completed, auto-update PO to COMPLETED
		if (newStatus === "COMPLETED" && po.status !== "COMPLETED") {
			await prisma.purchaseOrder.update({
				where: { id: po.id },
				data: { status: "COMPLETED" },
			});
			logger.info(
				`PO ${po.poNumber} auto-marked as COMPLETED (all payments completed)`,
			);
		}

		logger.info(
			`Payment released: ${amount} for schedule ${scheduleId} item ${itemIndex}, txn ${transaction.transactionNumber}`,
		);

		return { schedule: updatedSchedule, transaction };
	};

	/**
	 * Mark overdue and due items. Called by cron job daily.
	 * - UPCOMING items past dueDate → DUE (if dueDate is today) or OVERDUE (if past)
	 * - DUE items past dueDate → OVERDUE
	 */
	const markOverdueItems = async () => {
		const now = new Date();
		now.setHours(0, 0, 0, 0); // Start of today

		const activeSchedules = await prisma.paymentSchedule.findMany({
			where: { status: "ACTIVE", isDeleted: false },
		});

		let updatedCount = 0;

		for (const schedule of activeSchedules) {
			let changed = false;
			const updatedItems = schedule.items.map((item) => {
				const dueDate = new Date(item.dueDate);
				dueDate.setHours(0, 0, 0, 0);

				if (item.status === "UPCOMING" && dueDate <= now) {
					changed = true;
					// If past due, mark as OVERDUE; if today, mark as DUE
					return { ...item, status: dueDate < now ? "OVERDUE" : "DUE" };
				}
				if (item.status === "DUE" && dueDate < now) {
					changed = true;
					return { ...item, status: "OVERDUE" };
				}
				return item;
			});

			if (changed) {
				await prisma.paymentSchedule.update({
					where: { id: schedule.id },
					data: { items: updatedItems },
				});
				updatedCount++;
			}
		}

		logger.info(`Overdue check complete: ${updatedCount} schedule(s) updated`);
		return updatedCount;
	};

	return {
		generateScheduleFromPO,
		releasePayment,
		markOverdueItems,
	};
};

export type PaymentScheduleService = ReturnType<typeof createPaymentScheduleService>;
