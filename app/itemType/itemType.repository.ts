import { PrismaClient, Prisma, ItemType } from "../../generated/prisma";
import { CreateItemType, UpdateItemType } from "../../zod/itemType.zod";

export const itemTypeRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateItemType): Promise<ItemType> => {
		return await prisma.itemType.create({
			data: data as Prisma.ItemTypeUncheckedCreateInput,
		});
	};

	const findMany = async (params?: {
		skip?: number;
		take?: number;
		where?: Prisma.ItemTypeWhereInput;
		orderBy?: Prisma.ItemTypeOrderByWithRelationInput;
	}): Promise<ItemType[]> => {
		return await prisma.itemType.findMany({
			...params,
			where: {
				...params?.where,
				isDeleted: false,
			},
		});
	};

	const getById = async (params: { where: Prisma.ItemTypeWhereInput }): Promise<ItemType | null> => {
		return await prisma.itemType.findFirst({
			where: {
				...params.where,
				isDeleted: false,
			},
		});
	};

	const update = async (
		id: string,
		data: UpdateItemType,
		workspaceId: string,
	): Promise<{ existingItemType: ItemType | null; updatedItemType: ItemType | null }> => {
		const existingItemType = await prisma.itemType.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingItemType) {
			return { existingItemType: null, updatedItemType: null };
		}

		const updatedItemType = await prisma.itemType.update({
			where: { id },
			data: data as Prisma.ItemTypeUpdateInput,
		});

		return { existingItemType, updatedItemType };
	};

	const remove = async (id: string, workspaceId: string): Promise<ItemType | null> => {
		const existingItemType = await prisma.itemType.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingItemType) {
			return null;
		}

		return await prisma.itemType.update({
			where: { id },
			data: { isDeleted: true },
		});
	};

	const count = async (params?: { where?: Prisma.ItemTypeWhereInput }): Promise<number> => {
		return await prisma.itemType.count({
			where: {
				...params?.where,
				isDeleted: false,
			},
		});
	};

	return {
		create,
		findMany,
		getById,
		update,
		remove,
		count,
	};
};
