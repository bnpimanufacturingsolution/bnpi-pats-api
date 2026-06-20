import { PrismaClient, Prisma, Invoice } from "../../generated/prisma";
import { CreateInvoice, UpdateInvoice } from "../../zod/invoice.zod";

export const invoiceRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateInvoice): Promise<Invoice> => {
		return await prisma.invoice.create({ data: data as Prisma.InvoiceUncheckedCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.InvoiceFindManyArgs,
		whereClause: Prisma.InvoiceWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[Invoice[], number]> => {
		return await Promise.all([
			options.document ? prisma.invoice.findMany(findManyQuery) : [],
			options.count ? prisma.invoice.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.InvoiceFindFirstArgs): Promise<Invoice | null> => {
		return await prisma.invoice.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdateInvoice,
		workspaceId: string,
	): Promise<{ existingInvoice: Invoice | null; updatedInvoice: Invoice | null }> => {
		const existingInvoice = await prisma.invoice.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingInvoice) {
			return { existingInvoice: null, updatedInvoice: null };
		}

		const updatedInvoice = await prisma.invoice.update({
			where: { id },
			data: data as Prisma.InvoiceUpdateInput,
		});

		return { existingInvoice, updatedInvoice };
	};

	const remove = async (id: string, workspaceId: string): Promise<Invoice | null> => {
		const existingInvoice = await prisma.invoice.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingInvoice) {
			return null;
		}

		await prisma.invoice.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingInvoice;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
