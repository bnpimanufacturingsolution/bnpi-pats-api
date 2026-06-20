import { PrismaClient, Prisma, Category } from "../../generated/prisma";
import { CreateCategory, UpdateCategory } from "../../zod/category.zod";

export const categoryRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateCategory): Promise<Category> => {
		return await prisma.category.create({ data: data as Prisma.CategoryUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.CategoryFindManyArgs,
		whereClause: Prisma.CategoryWhereInput,
		options: { document: boolean; count: boolean },
	): Promise<[Category[], number]> => {
		return await Promise.all([
			options.document ? prisma.category.findMany(findManyQuery) : [],
			options.count ? prisma.category.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.CategoryFindFirstArgs): Promise<Category | null> => {
		return await prisma.category.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdateCategory,
		workspaceId: string,
	): Promise<{ existingCategory: Category | null; updatedCategory: Category | null }> => {
		const existingCategory = await prisma.category.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingCategory) {
			return { existingCategory: null, updatedCategory: null };
		}

		const updatedCategory = await prisma.category.update({
			where: { id },
			data: data as Prisma.CategoryUpdateInput,
		});

		return { existingCategory, updatedCategory };
	};

	const remove = async (id: string, workspaceId: string): Promise<Category | null> => {
		const existingCategory = await prisma.category.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingCategory) {
			return null;
		}

		// Soft delete the category
		await prisma.category.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingCategory;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};

export type CategoryRepository = ReturnType<typeof categoryRepository>;
