import { PrismaClient, Prisma, Item } from "../../generated/prisma";
import { CreateItem, UpdateItem } from "../../zod/item.zod";

export const itemRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateItem & { workspaceId: string; estimatedTotal: number; actualTotal?: number | null }): Promise<Item> => {
		// Type assertion: Controller ensures all required fields are present
		return await prisma.item.create({ data: data as Prisma.ItemUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.ItemFindManyArgs,
		whereClause: Prisma.ItemWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[Item[], number]> => {
		return await Promise.all([
			options.document ? prisma.item.findMany(findManyQuery) : [],
			options.count ? prisma.item.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.ItemFindFirstArgs): Promise<Item | null> => {
		return await prisma.item.findFirst(query);
	};

	const findEstimationById = async (estimationId: string) => {
		return await prisma.estimation.findFirst({
			where: { id: estimationId, isDeleted: false },
		});
	};

	const update = async (
		id: string,
		data: UpdateItem & { estimatedTotal: number; actualTotal?: number | null },
		workspaceId: string,
	): Promise<{ existingItem: Item | null; updatedItem: Item | null }> => {
		const existingItem = await prisma.item.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingItem) {
			return { existingItem: null, updatedItem: null };
		}

		// Type assertion: Zod validates data structure
		const updatedItem = await prisma.item.update({
			where: { id },
			data: data as Prisma.ItemUpdateInput,
		});

		return { existingItem, updatedItem };
	};

	const remove = async (id: string, workspaceId: string): Promise<Item | null> => {
		const existingItem = await prisma.item.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingItem) {
			return null;
		}

		// CASCADING SOFT DELETE IMPLEMENTATION
		// Step 1: Soft delete the related order if it exists
		if (existingItem.orderId) {
			await prisma.order.update({
				where: { id: existingItem.orderId },
				data: { isDeleted: true },
			});
		}

		// Step 2: Soft delete the item itself
		await prisma.item.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingItem;
	};

	return {
		create,
		getAll,
		getById,
		findEstimationById,
		update,
		remove,
	};
};
