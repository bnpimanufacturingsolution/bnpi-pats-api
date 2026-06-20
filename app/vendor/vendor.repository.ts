import { PrismaClient, Prisma, Vendor } from "../../generated/prisma";
import { CreateVendor, UpdateVendor } from "../../zod/vendor.zod";

export const vendorRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateVendor): Promise<Vendor> => {
		// Type assertion: Controller ensures all required fields are present
		return await prisma.vendor.create({ data: data as Prisma.VendorCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.VendorFindManyArgs,
		whereClause: Prisma.VendorWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[Vendor[], number]> => {
		return await Promise.all([
			options.document ? prisma.vendor.findMany(findManyQuery) : [],
			options.count ? prisma.vendor.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.VendorFindFirstArgs): Promise<Vendor | null> => {
		return await prisma.vendor.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdateVendor,
		workspaceId: string,
	): Promise<{ existingVendor: Vendor | null; updatedVendor: Vendor | null }> => {
		const existingVendor = await prisma.vendor.findFirst({
			where: { id, workspaceId: workspaceId },
		});

		if (!existingVendor) {
			return { existingVendor: null, updatedVendor: null };
		}

		// Type assertion: Zod validates data structure
		const updatedVendor = await prisma.vendor.update({
			where: { id },
			data: data as Prisma.VendorUpdateInput,
		});

		return { existingVendor, updatedVendor };
	};

	const remove = async (id: string, workspaceId: string): Promise<Vendor | null> => {
		const existingVendor = await prisma.vendor.findFirst({
			where: { id, workspaceId: workspaceId },
		});

		if (!existingVendor) {
			return null;
		}

		await prisma.vendor.delete({
			where: { id },
		});

		return existingVendor;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
