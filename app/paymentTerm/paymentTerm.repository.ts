import { PrismaClient, Prisma, PaymentTerm } from "../../generated/prisma";
import { CreatePaymentTerm, UpdatePaymentTerm } from "../../zod/paymentTerm.zod";

export const paymentTermRepository = (prisma: PrismaClient) => {
	const create = async (data: CreatePaymentTerm): Promise<PaymentTerm> => {
		return await prisma.paymentTerm.create({ data: data as Prisma.PaymentTermUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.PaymentTermFindManyArgs,
		whereClause: Prisma.PaymentTermWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[PaymentTerm[], number]> => {
		return await Promise.all([
			options.document ? prisma.paymentTerm.findMany(findManyQuery) : [],
			options.count ? prisma.paymentTerm.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.PaymentTermFindFirstArgs): Promise<PaymentTerm | null> => {
		return await prisma.paymentTerm.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdatePaymentTerm,
		workspaceId: string,
	): Promise<{ existingPaymentTerm: PaymentTerm | null; updatedPaymentTerm: PaymentTerm | null }> => {
		const existingPaymentTerm = await prisma.paymentTerm.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingPaymentTerm) {
			return { existingPaymentTerm: null, updatedPaymentTerm: null };
		}

		const updatedPaymentTerm = await prisma.paymentTerm.update({
			where: { id },
			data: data as Prisma.PaymentTermUpdateInput,
		});

		return { existingPaymentTerm, updatedPaymentTerm };
	};

	const remove = async (id: string, workspaceId: string): Promise<PaymentTerm | null> => {
		const existingPaymentTerm = await prisma.paymentTerm.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingPaymentTerm) {
			return null;
		}

		await prisma.paymentTerm.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingPaymentTerm;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
