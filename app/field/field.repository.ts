import { PrismaClient, Prisma, Field } from "../../generated/prisma";
import { CreateField, UpdateField } from "../../zod/field.zod";

export const fieldRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateField): Promise<Field> => {
		return await prisma.field.create({
			data: data as Prisma.FieldUncheckedCreateInput,
		});
	};

	const findMany = async (params?: {
		skip?: number;
		take?: number;
		where?: Prisma.FieldWhereInput;
		orderBy?: Prisma.FieldOrderByWithRelationInput;
	}): Promise<Field[]> => {
		return await prisma.field.findMany({
			...params,
			where: {
				...params?.where,
				isDeleted: false,
			},
		});
	};

	const getById = async (params: { where: Prisma.FieldWhereInput }): Promise<Field | null> => {
		return await prisma.field.findFirst({
			where: {
				...params.where,
				isDeleted: false,
			},
		});
	};

	const update = async (
		id: string,
		data: UpdateField,
		workspaceId: string,
	): Promise<{ existingField: Field | null; updatedField: Field | null }> => {
		const existingField = await prisma.field.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingField) {
			return { existingField: null, updatedField: null };
		}

		const updatedField = await prisma.field.update({
			where: { id },
			data: data as Prisma.FieldUpdateInput,
		});

		return { existingField, updatedField };
	};

	const remove = async (id: string, workspaceId: string): Promise<Field | null> => {
		const existingField = await prisma.field.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingField) {
			return null;
		}

		return await prisma.field.update({
			where: { id },
			data: { isDeleted: true },
		});
	};

	const count = async (params?: { where?: Prisma.FieldWhereInput }): Promise<number> => {
		return await prisma.field.count({
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
