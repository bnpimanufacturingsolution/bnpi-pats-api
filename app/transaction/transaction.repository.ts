import { PrismaClient, Prisma, Transaction } from "../../generated/prisma";
import { CreateTransaction, UpdateTransaction } from "../../zod/transaction.zod";

export const transactionRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateTransaction & { workspaceId: string }): Promise<Transaction> => {
		return await prisma.transaction.create({
			data: data as Prisma.TransactionUncheckedCreateInput,
		});
	};

	const getAll = async (
		findManyQuery: Prisma.TransactionFindManyArgs,
		whereClause: Prisma.TransactionWhereInput,
		options: { document: boolean; count: boolean },
	): Promise<[any[], number]> => {
		const [transactions, count] = await Promise.all([
			options.document ? prisma.transaction.findMany(findManyQuery) : [],
			options.count ? prisma.transaction.count({ where: whereClause }) : 0,
		]);

		return [transactions, count];
	};

	const getById = async (query: Prisma.TransactionFindFirstArgs): Promise<Transaction | null> => {
		const transaction = await prisma.transaction.findFirst(query);
		return transaction;
	};

	const update = async (
		id: string,
		data: UpdateTransaction,
		workspaceId: string,
	): Promise<{
		existingTransaction: Transaction | null;
		updatedTransaction: Transaction | null;
	}> => {
		const existingTransaction = await prisma.transaction.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingTransaction) {
			return { existingTransaction: null, updatedTransaction: null };
		}

		const updatedTransaction = await prisma.transaction.update({
			where: { id },
			data: data as Prisma.TransactionUpdateInput,
		});

		return { existingTransaction, updatedTransaction };
	};

	const remove = async (id: string, workspaceId: string): Promise<Transaction | null> => {
		const existingTransaction = await prisma.transaction.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingTransaction) {
			return null;
		}

		// Soft delete - set isDeleted to true
		const deletedTransaction = await prisma.transaction.update({
			where: { id },
			data: { isDeleted: true },
		});

		return deletedTransaction;
	};

	const getMetric = async (projectId: string) => {
		const transactions = await prisma.transaction.findMany({
			where: {
				projectId,
				isDeleted: false,
			},
			select: {
				amount: true,
				transactionType: true,
				status: true,
			},
		});

		// Calculate metrics by status
		const metrics = transactions.reduce(
			(acc, transaction) => {
				const amount = transaction.amount;
				const type = transaction.transactionType;
				const status = transaction.status;

				// Totals by type
				if (type === "INCOMING") {
					acc.totalIncoming += amount;
				} else if (type === "OUTGOING") {
					acc.totalOutgoing += amount;
				}

				// Totals by status and type
				if (status === "CLEARED") {
					if (type === "INCOMING") {
						acc.clearedIncoming += amount;
					} else {
						acc.clearedOutgoing += amount;
					}
				} else if (status === "PENDING") {
					if (type === "INCOMING") {
						acc.pendingIncoming += amount;
					} else {
						acc.pendingOutgoing += amount;
					}
				} else if (status === "BOUNCED") {
					acc.bouncedCount += 1;
					acc.bouncedAmount += amount;
				}

				return acc;
			},
			{
				totalIncoming: 0,
				totalOutgoing: 0,
				clearedIncoming: 0,
				clearedOutgoing: 0,
				pendingIncoming: 0,
				pendingOutgoing: 0,
				bouncedCount: 0,
				bouncedAmount: 0,
			},
		);

		// Calculate net balances
		const netBalance = metrics.totalIncoming - metrics.totalOutgoing;
		const clearedBalance = metrics.clearedIncoming - metrics.clearedOutgoing;
		const pendingBalance = metrics.pendingIncoming - metrics.pendingOutgoing;

		return {
			...metrics,
			netBalance,
			clearedBalance,
			pendingBalance,
		};
	};

	const getRunningBalance = async (findManyQuery: Prisma.TransactionFindManyArgs) => {
		const transactions = await prisma.transaction.findMany(findManyQuery);

		if (transactions.length === 0) {
			return [];
		}

		// Collect all unique itemIds
		const itemIds = new Set<string>();
		transactions.forEach((transaction: any) => {
			if (transaction.itemId) {
				itemIds.add(transaction.itemId);
			}
		});

		// Fetch item names for all referenced items
		const itemMap = new Map<string, { id: string; itemName: string }>();
		if (itemIds.size > 0) {
			const items = await prisma.item.findMany({
				where: {
					id: { in: Array.from(itemIds) },
					isDeleted: false,
				},
				select: {
					id: true,
					itemName: true,
				},
			});
			items.forEach((item) => {
				itemMap.set(item.id, item);
			});
		}

		// Sort by transactionDate ascending (oldest first) for accurate running balance calculation
		const sortedTransactions = [...transactions].sort((a: any, b: any) => {
			const dateA = new Date(a.transactionDate).getTime();
			const dateB = new Date(b.transactionDate).getTime();
			return dateA - dateB;
		});

		// Calculate running balance
		let runningBalance = 0;
		const balanceMap = new Map<string, number>();
		sortedTransactions.forEach((transaction: any) => {
			if (transaction.transactionType === "INCOMING") {
				runningBalance += transaction.amount;
			} else if (transaction.transactionType === "OUTGOING") {
				runningBalance -= transaction.amount;
			}
			balanceMap.set(transaction.id, runningBalance);
		});

		// Apply running balance and populate item details
		const transactionsWithBalance = transactions.map((transaction: any) => {
			return {
				...transaction,
				runningBalance: balanceMap.get(transaction.id) ?? 0,
				item:
					transaction.item ||
					(transaction.itemId ? itemMap.get(transaction.itemId) : null),
			};
		});

		return transactionsWithBalance;
	};

	const setCleared = async (
		id: string,
		clearedDate: Date | null,
	): Promise<Transaction | null> => {
		return await prisma.transaction.update({
			where: { id },
			data: {
				status: clearedDate ? "CLEARED" : "PENDING",
				clearedDate,
			},
		});
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
		getMetric,
		getRunningBalance,
		setCleared,
	};
};
