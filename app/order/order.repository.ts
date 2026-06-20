import { PrismaClient, Prisma, Order } from "../../generated/prisma";
import { CreateOrder, UpdateOrder } from "../../zod/order.zod";

export const orderRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateOrder): Promise<Order> => {
		// Type assertion: Controller ensures all required fields are present
		return await prisma.order.create({ data: data as Prisma.OrderUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.OrderFindManyArgs,
		whereClause: Prisma.OrderWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[Order[], number]> => {
		return await Promise.all([
			options.document ? prisma.order.findMany(findManyQuery) : [],
			options.count ? prisma.order.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.OrderFindFirstArgs): Promise<Order | null> => {
		return await prisma.order.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdateOrder,
		workspaceId: string,
	): Promise<{ existingOrder: Order | null; updatedOrder: Order | null }> => {
		const existingOrder = await prisma.order.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingOrder) {
			return { existingOrder: null, updatedOrder: null };
		}

		// Type assertion: Zod validates data structure
		const updatedOrder = await prisma.order.update({
			where: { id },
			data: data as Prisma.OrderUpdateInput,
		});

		return { existingOrder, updatedOrder };
	};

	const remove = async (id: string, workspaceId: string): Promise<Order | null> => {
		const existingOrder = await prisma.order.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingOrder) {
			return null;
		}

		await prisma.order.delete({
			where: { id },
		});

		return existingOrder;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
