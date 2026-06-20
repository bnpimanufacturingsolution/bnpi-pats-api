import { PrismaClient, Prisma, Payslip } from "../../generated/prisma";
import { CreatePayslip, UpdatePayslip } from "../../zod/payslip.zod";

export const payslipRepository = (prisma: PrismaClient) => {
	const create = async (data: CreatePayslip): Promise<Payslip> => {
		// Type assertion: Controller ensures all required fields are present
		return await prisma.payslip.create({ data: data as Prisma.PayslipUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.PayslipFindManyArgs,
		whereClause: Prisma.PayslipWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[Payslip[], number]> => {
		return await Promise.all([
			options.document ? prisma.payslip.findMany(findManyQuery) : [],
			options.count ? prisma.payslip.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.PayslipFindFirstArgs): Promise<Payslip | null> => {
		return await prisma.payslip.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdatePayslip,
		workspaceId: string,
	): Promise<{ existingPayslip: Payslip | null; updatedPayslip: Payslip | null }> => {
		const existingPayslip = await prisma.payslip.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingPayslip) {
			return { existingPayslip: null, updatedPayslip: null };
		}

		// Type assertion: Zod validates data structure
		const updatedPayslip = await prisma.payslip.update({
			where: { id },
			data: data as Prisma.PayslipUpdateInput,
		});

		return { existingPayslip, updatedPayslip };
	};

	const remove = async (id: string, workspaceId: string): Promise<Payslip | null> => {
		const existingPayslip = await prisma.payslip.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingPayslip) {
			return null;
		}

		await prisma.payslip.delete({
			where: { id },
		});

		return existingPayslip;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
