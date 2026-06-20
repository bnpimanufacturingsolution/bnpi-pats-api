import { PrismaClient, Prisma, PaymentSchedule } from "../../generated/prisma";
import { CreatePaymentSchedule, UpdatePaymentSchedule } from "../../zod/paymentSchedule.zod";

export const paymentScheduleRepository = (prisma: PrismaClient) => {
	const create = async (data: CreatePaymentSchedule): Promise<PaymentSchedule> => {
		return await prisma.paymentSchedule.create({ data: data as Prisma.PaymentScheduleUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.PaymentScheduleFindManyArgs,
		whereClause: Prisma.PaymentScheduleWhereInput,
		options: { document: boolean; count: boolean },
	): Promise<[PaymentSchedule[], number]> => {
		return await Promise.all([
			options.document ? prisma.paymentSchedule.findMany(findManyQuery) : [],
			options.count ? prisma.paymentSchedule.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.PaymentScheduleFindFirstArgs): Promise<PaymentSchedule | null> => {
		return await prisma.paymentSchedule.findFirst(query);
	};

	const getByPurchaseOrderId = async (purchaseOrderId: string, workspaceId: string): Promise<PaymentSchedule | null> => {
		return await prisma.paymentSchedule.findFirst({
			where: { purchaseOrderId, workspaceId, isDeleted: false },
		});
	};

	const update = async (
		id: string,
		data: UpdatePaymentSchedule,
		workspaceId: string,
	): Promise<{ existingSchedule: PaymentSchedule | null; updatedSchedule: PaymentSchedule | null }> => {
		const existingSchedule = await prisma.paymentSchedule.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingSchedule) {
			return { existingSchedule: null, updatedSchedule: null };
		}

		const updatedSchedule = await prisma.paymentSchedule.update({
			where: { id },
			data: data as Prisma.PaymentScheduleUpdateInput,
		});

		return { existingSchedule, updatedSchedule };
	};

	const remove = async (id: string, workspaceId: string): Promise<PaymentSchedule | null> => {
		const existingSchedule = await prisma.paymentSchedule.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingSchedule) {
			return null;
		}

		await prisma.paymentSchedule.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingSchedule;
	};

	return {
		create,
		getAll,
		getById,
		getByPurchaseOrderId,
		update,
		remove,
	};
};
