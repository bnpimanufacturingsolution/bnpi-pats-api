import { PrismaClient, Prisma, Sequential } from "../../generated/prisma";
import { CreateSequential, UpdateSequential } from "../../zod/sequential.zod";

export const sequentialRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateSequential): Promise<Sequential> => {
		// Type assertion: Controller ensures all required fields are present
		return await prisma.sequential.create({ data: data as Prisma.SequentialCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.SequentialFindManyArgs,
		whereClause: Prisma.SequentialWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[Sequential[], number]> => {
		return await Promise.all([
			options.document ? prisma.sequential.findMany(findManyQuery) : [],
			options.count ? prisma.sequential.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.SequentialFindFirstArgs): Promise<Sequential | null> => {
		return await prisma.sequential.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdateSequential,
		workspaceId: string,
	): Promise<{ existingSequential: Sequential | null; updatedSequential: Sequential | null }> => {
		const existingSequential = await prisma.sequential.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingSequential) {
			return { existingSequential: null, updatedSequential: null };
		}

		// Type assertion: Zod validates data structure
		const updatedSequential = await prisma.sequential.update({
			where: { id },
			data: data as Prisma.SequentialUpdateInput,
		});

		return { existingSequential, updatedSequential };
	};

	const remove = async (id: string, workspaceId: string): Promise<Sequential | null> => {
		const existingSequential = await prisma.sequential.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingSequential) {
			return null;
		}

		// Soft delete
		const deletedSequential = await prisma.sequential.update({
			where: { id },
			data: { isDeleted: true },
		});

		return deletedSequential;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
