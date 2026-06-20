import { PrismaClient, Prisma, POType } from "../../generated/prisma";
import { CreatePOType, UpdatePOType } from "../../zod/poType.zod";

export const poTypeRepository = (prisma: PrismaClient) => {
	const create = async (data: CreatePOType): Promise<POType> => {
		return await prisma.pOType.create({ data: data as Prisma.POTypeUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.POTypeFindManyArgs,
		whereClause: Prisma.POTypeWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[POType[], number]> => {
		return await Promise.all([
			options.document ? prisma.pOType.findMany(findManyQuery) : [],
			options.count ? prisma.pOType.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.POTypeFindFirstArgs): Promise<POType | null> => {
		return await prisma.pOType.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdatePOType,
		workspaceId: string,
	): Promise<{ existingPOType: POType | null; updatedPOType: POType | null }> => {
		const existingPOType = await prisma.pOType.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingPOType) {
			return { existingPOType: null, updatedPOType: null };
		}

		const updatedPOType = await prisma.pOType.update({
			where: { id },
			data: data as Prisma.POTypeUpdateInput,
		});

		return { existingPOType, updatedPOType };
	};

	const remove = async (id: string, workspaceId: string): Promise<POType | null> => {
		const existingPOType = await prisma.pOType.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingPOType) {
			return null;
		}

		await prisma.pOType.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingPOType;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
