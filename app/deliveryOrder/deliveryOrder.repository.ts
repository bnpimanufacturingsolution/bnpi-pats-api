import { PrismaClient, Prisma, DeliveryOrder } from "../../generated/prisma";
import { CreateDeliveryOrder, UpdateDeliveryOrder } from "../../zod/deliveryOrder.zod";

export const deliveryOrderRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateDeliveryOrder): Promise<DeliveryOrder> => {
		return await prisma.deliveryOrder.create({ data: data as Prisma.DeliveryOrderUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.DeliveryOrderFindManyArgs,
		whereClause: Prisma.DeliveryOrderWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[DeliveryOrder[], number]> => {
		return await Promise.all([
			options.document ? prisma.deliveryOrder.findMany(findManyQuery) : [],
			options.count ? prisma.deliveryOrder.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.DeliveryOrderFindFirstArgs): Promise<DeliveryOrder | null> => {
		return await prisma.deliveryOrder.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdateDeliveryOrder,
		workspaceId: string,
	): Promise<{ existingDeliveryOrder: DeliveryOrder | null; updatedDeliveryOrder: DeliveryOrder | null }> => {
		const existingDeliveryOrder = await prisma.deliveryOrder.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingDeliveryOrder) {
			return { existingDeliveryOrder: null, updatedDeliveryOrder: null };
		}

		const updatedDeliveryOrder = await prisma.deliveryOrder.update({
			where: { id },
			data: data as Prisma.DeliveryOrderUpdateInput,
		});

		return { existingDeliveryOrder, updatedDeliveryOrder };
	};

	const remove = async (id: string, workspaceId: string): Promise<DeliveryOrder | null> => {
		const existingDeliveryOrder = await prisma.deliveryOrder.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingDeliveryOrder) {
			return null;
		}

		await prisma.deliveryOrder.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingDeliveryOrder;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
