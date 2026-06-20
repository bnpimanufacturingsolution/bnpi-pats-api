/**
 * Transaction Service
 *
 * Business logic layer for transaction operations.
 */

import {
	PrismaClient,
	Prisma,
	Transaction,
	TransactionStatus,
	TransactionType,
	PaymentMethod,
} from "../../generated/prisma";
import { createLogger } from "../../helper/logger";
import { updateEstimationTotalsAndMetadata } from "../../utils/calculations";
import type {
	CreateTransactionDto,
	CreateTransactionResult,
} from "./transaction.types";

// Re-export types for consumers
export type {
	CreateTransactionDto,
	CreateTransactionResult,
} from "./transaction.types";

const logger = createLogger("transaction-service");

// ============================================================================
// HELPER FUNCTIONS (private to module)
// ============================================================================

const validateProjectRules = (project: { status: string; startDate?: Date | null; endDate?: Date | null }, transactionDate: Date) => {
	if (project.status !== "ACTIVE") {
		throw new Error(`Cannot create transaction for ${project.status} project`);
	}

	if (project.startDate && transactionDate < project.startDate) {
		logger.warn(
			`Transaction date (${transactionDate.toISOString()}) is before project start date (${project.startDate.toISOString()})`,
		);
	}
	if (project.endDate && transactionDate > project.endDate) {
		logger.warn(
			`Transaction date (${transactionDate.toISOString()}) is after project end date (${project.endDate.toISOString()})`,
		);
	}
};

// ============================================================================
// SERVICE FACTORY
// ============================================================================

export const createTransactionService = (prisma: PrismaClient) => {
	const generateTransactionNumber = async (
		projectId: string,
		type: TransactionType,
		date: Date,
		tx?: Prisma.TransactionClient,
	): Promise<string> => {
		const client = tx || prisma;
		const year = date.getFullYear();
		const prefix = type === TransactionType.INCOMING ? "TIN" : "TOUT";

		const project = await client.project.findUnique({
			where: { id: projectId },
			select: { code: true, workspaceId: true },
		});

		if (!project) throw new Error(`Project not found for ID: ${projectId}`);

		const projectCode = project.code;
		const sequentialName = `transaction-${projectCode}-${type}-${year}`;
		const numberPrefix = `${projectCode}-${prefix}-${year}-`;

		// Find the highest existing transaction number for this pattern
		const existingMax = await client.transaction.findFirst({
			where: {
				transactionNumber: { startsWith: numberPrefix },
				workspaceId: project.workspaceId,
			},
			orderBy: { transactionNumber: "desc" },
			select: { transactionNumber: true },
		});

		let nextNumber = 1;
		if (existingMax?.transactionNumber) {
			const lastPart = existingMax.transactionNumber.replace(numberPrefix, "");
			const parsed = parseInt(lastPart, 10);
			if (!isNaN(parsed)) {
				nextNumber = parsed + 1;
			}
		}

		// Upsert the sequential counter to keep it in sync
		await client.sequential.upsert({
			where: {
				name_workspaceId: {
					name: sequentialName,
					workspaceId: project.workspaceId,
				},
			},
			update: { current: nextNumber },
			create: {
				name: sequentialName,
				code: sequentialName,
				pattern: `${numberPrefix}####`,
				current: nextNumber,
				workspaceId: project.workspaceId,
			},
		});

		const transactionNumber = `${numberPrefix}${nextNumber.toString().padStart(4, "0")}`;
		logger.debug(`Generated transaction number: ${transactionNumber}`, {
			projectId,
			type,
			year,
			sequence: nextNumber,
		});
		return transactionNumber;
	};

	const syncEstimationMetadata = async (itemIds: string[]): Promise<void> => {
		if (itemIds.length === 0) return;

		const items = await prisma.item.findMany({
			where: { id: { in: itemIds } },
			select: { estimationId: true },
		});

		const estimationIds = [...new Set(items.map((i) => i.estimationId))];
		await Promise.all(estimationIds.map((id) => updateEstimationTotalsAndMetadata(prisma, id)));
	};

	// ============================================================================
	// PUBLIC METHODS
	// ============================================================================

	const createTransaction = async (
		dto: CreateTransactionDto,
		retryCount = 0,
	): Promise<CreateTransactionResult> => {
		const MAX_RETRIES = 3;
		if (!dto.projectId) throw new Error("projectId is required");
		if (!dto.payeeName) throw new Error("payeeName is required");
		if (!dto.transactionType) throw new Error("transactionType is required");
		if (dto.amount === undefined || dto.amount === null) throw new Error("amount is required");
		if (dto.amount <= 0) throw new Error("Transaction amount must be greater than 0");

		try {
			const transaction = await prisma.$transaction(async (tx) => {
				if (dto.idempotencyKey) {
					const existing = await tx.transaction.findUnique({
						where: { idempotencyKey: dto.idempotencyKey },
					});
					if (existing) {
						logger.info(`Idempotent request: returning existing transaction ${existing.id}`);
						return existing;
					}
				}

				const project = await tx.project.findUnique({
					where: { id: dto.projectId, isDeleted: false },
				});
				if (!project) throw new Error(`Project not found: ${dto.projectId}`);
				validateProjectRules(project, dto.transactionDate);

				const transactionNumber =
					dto.transactionNumber ||
					(await generateTransactionNumber(
						dto.projectId,
						dto.transactionType,
						dto.transactionDate,
						tx,
					));

				return await tx.transaction.create({
					data: {
						workspaceId: dto.workspaceId!,
						projectId: dto.projectId,
						transactionNumber,
						transactionDate: dto.transactionDate,
						payeeName: dto.payeeName,
						amount: dto.amount,
						itemId: dto.itemId || null,
						purchaseOrderId: dto.purchaseOrderId || null,
						transactionType: dto.transactionType,
						status: dto.status || TransactionStatus.PENDING,
						paymentMethod: dto.paymentMethod || PaymentMethod.CHECK,
						documentUrls: dto.documentUrls || [],
						idempotencyKey: dto.idempotencyKey,
						checkDetails: dto.checkDetails,
						cashDetails: dto.cashDetails,
						bankTransferDetails: dto.bankTransferDetails,
						onlineDetails: dto.onlineDetails,
					},
				});
			});

			logger.info(`Transaction created: ${transaction.id} (${transaction.transactionNumber})`);
			return { transaction };
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
				const target = (error.meta?.target as string[]) || [];
				if (target.includes("idempotencyKey") && dto.idempotencyKey) {
					const existing = await prisma.transaction.findUnique({
						where: { idempotencyKey: dto.idempotencyKey },
					});
					if (existing) return { transaction: existing };
				}
				// Transaction number collision - retry with a new number
				if (target.includes("transactionNumber") && retryCount < MAX_RETRIES) {
					logger.warn(`Transaction number collision, retrying (attempt ${retryCount + 1}/${MAX_RETRIES})`);
					return createTransaction(dto, retryCount + 1);
				}
			}
			throw error;
		}
	};

	const syncFinancialsForNewTransaction = async (transaction: Transaction): Promise<void> => {
		if (transaction.itemId) {
			await syncEstimationMetadata([transaction.itemId]);
		}
	};

	const syncFinancialsForModifiedTransaction = async (
		oldTransaction: Transaction | null,
		newTransaction: Transaction | null,
	): Promise<void> => {
		const itemIds = new Set<string>();

		if (oldTransaction?.itemId) itemIds.add(oldTransaction.itemId);
		if (newTransaction?.itemId) itemIds.add(newTransaction.itemId);

		if (itemIds.size === 0) return;

		await syncEstimationMetadata(Array.from(itemIds));
	};

	return {
		createTransaction,
		syncFinancialsForNewTransaction,
		syncFinancialsForModifiedTransaction,
		generateTransactionNumber,
	};
};

export type TransactionService = ReturnType<typeof createTransactionService>;
