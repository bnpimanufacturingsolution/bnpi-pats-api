import { PrismaClient, Prisma, UsageCode } from "../../generated/prisma";
import { CreateUsageCode, UpdateUsageCode } from "../../zod/usageCode.zod";

export const usageCodeRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateUsageCode): Promise<UsageCode> => {
		return await prisma.usageCode.create({ data: data as Prisma.UsageCodeUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.UsageCodeFindManyArgs,
		whereClause: Prisma.UsageCodeWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[UsageCode[], number]> => {
		return await Promise.all([
			options.document ? prisma.usageCode.findMany(findManyQuery) : [],
			options.count ? prisma.usageCode.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.UsageCodeFindFirstArgs): Promise<UsageCode | null> => {
		return await prisma.usageCode.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdateUsageCode,
		workspaceId: string,
	): Promise<{ existingUsageCode: UsageCode | null; updatedUsageCode: UsageCode | null }> => {
		const existingUsageCode = await prisma.usageCode.findFirst({
			where: { id, isDeleted: false, workspaceId: workspaceId },
		});

		if (!existingUsageCode) {
			return { existingUsageCode: null, updatedUsageCode: null };
		}

		const updatedUsageCode = await prisma.usageCode.update({
			where: { id },
			data: data as Prisma.UsageCodeUpdateInput,
		});

		return { existingUsageCode, updatedUsageCode };
	};

	const remove = async (id: string, workspaceId: string): Promise<UsageCode | null> => {
		const existingUsageCode = await prisma.usageCode.findFirst({
			where: { id, isDeleted: false, workspaceId: workspaceId },
		});

		if (!existingUsageCode) {
			return null;
		}

		// Soft delete the usageCode
		await prisma.usageCode.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingUsageCode;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};

export type UsageCodeRepository = ReturnType<typeof usageCodeRepository>;
