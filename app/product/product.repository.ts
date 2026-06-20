import { PrismaClient, Prisma, Product } from "../../generated/prisma";
import { CreateProduct, UpdateProduct } from "../../zod/product.zod";

export const productRepository = (prisma: PrismaClient | Prisma.TransactionClient) => {
	const create = async (data: CreateProduct): Promise<Product> => {
		return await prisma.product.create({
			data: data as Prisma.ProductUncheckedCreateInput,
		});
	};

	const findMany = async (params?: {
		skip?: number;
		take?: number;
		where?: Prisma.ProductWhereInput;
		orderBy?: Prisma.ProductOrderByWithRelationInput;
		select?: Prisma.ProductSelect;
		include?: Prisma.ProductInclude;
	}): Promise<any[]> => {
		return await prisma.product.findMany({
			...params,
			where: {
				...params?.where,
				isDeleted: false,
			},
		});
	};

	const getById = async (params: {
		where: Prisma.ProductWhereInput;
		select?: Prisma.ProductSelect;
		include?: Prisma.ProductInclude;
	}): Promise<any | null> => {
		return await prisma.product.findFirst({
			...params,
			where: {
				...params.where,
				isDeleted: false,
			},
		});
	};

	const update = async (
		id: string,
		data: UpdateProduct,
		workspaceId: string,
	): Promise<{ existingProduct: Product | null; updatedProduct: Product | null }> => {
		const existingProduct = await prisma.product.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingProduct) {
			return { existingProduct: null, updatedProduct: null };
		}

		const updatedProduct = await prisma.product.update({
			where: { id },
			data: data as Prisma.ProductUpdateInput,
		});

		return { existingProduct, updatedProduct };
	};

	const remove = async (id: string, workspaceId: string): Promise<Product | null> => {
		const existingProduct = await prisma.product.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingProduct) {
			return null;
		}

		return await prisma.product.update({
			where: { id },
			data: { isDeleted: true },
		});
	};

	const count = async (params?: { where?: Prisma.ProductWhereInput }): Promise<number> => {
		return await prisma.product.count({
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
