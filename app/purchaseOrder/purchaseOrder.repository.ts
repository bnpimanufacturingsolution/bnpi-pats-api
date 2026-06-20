import { PrismaClient, Prisma, PurchaseOrder } from "../../generated/prisma";
import { CreatePurchaseOrder, UpdatePurchaseOrder } from "../../zod/purchaseOrder.zod";

export const purchaseOrderRepository = (prisma: PrismaClient) => {
	const create = async (data: CreatePurchaseOrder): Promise<PurchaseOrder> => {
		return await prisma.purchaseOrder.create({ data: data as Prisma.PurchaseOrderUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.PurchaseOrderFindManyArgs,
		whereClause: Prisma.PurchaseOrderWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[PurchaseOrder[], number]> => {
		return await Promise.all([
			options.document ? prisma.purchaseOrder.findMany(findManyQuery) : [],
			options.count ? prisma.purchaseOrder.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.PurchaseOrderFindFirstArgs): Promise<PurchaseOrder | null> => {
		return await prisma.purchaseOrder.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdatePurchaseOrder,
		workspaceId: string,
	): Promise<{ existingPurchaseOrder: PurchaseOrder | null; updatedPurchaseOrder: PurchaseOrder | null }> => {
		const existingPurchaseOrder = await prisma.purchaseOrder.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingPurchaseOrder) {
			return { existingPurchaseOrder: null, updatedPurchaseOrder: null };
		}

		const updatedPurchaseOrder = await prisma.purchaseOrder.update({
			where: { id },
			data: data as Prisma.PurchaseOrderUpdateInput,
		});

		return { existingPurchaseOrder, updatedPurchaseOrder };
	};

	const remove = async (id: string, workspaceId: string): Promise<PurchaseOrder | null> => {
		const existingPurchaseOrder = await prisma.purchaseOrder.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingPurchaseOrder) {
			return null;
		}

		await prisma.purchaseOrder.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingPurchaseOrder;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
