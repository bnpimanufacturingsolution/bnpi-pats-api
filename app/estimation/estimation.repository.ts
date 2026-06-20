import { PrismaClient, Prisma, Estimation } from "../../generated/prisma";
import { CreateEstimation, UpdateEstimation } from "../../zod/estimation.zod";

export const estimationRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateEstimation): Promise<Estimation> => {
		// Get the latest version for this project
		const latestEstimation = await prisma.estimation.findFirst({
			where: {
				projectId: data.projectId,
				isDeleted: false,
			},
			orderBy: { version: 'desc' },
			select: { version: true },
		});

		// Calculate the next version number
		const nextVersion = (latestEstimation?.version ?? 0) + 1;

		// Type assertion: Controller ensures all required fields are present
		return await prisma.estimation.create({
			data: {
				...data,
				version: nextVersion,
			} as Prisma.EstimationUncheckedCreateInput,
		});
	};

	const getAll = async (
		findManyQuery: Prisma.EstimationFindManyArgs,
		whereClause: Prisma.EstimationWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[Estimation[], number]> => {
		return await Promise.all([
			options.document ? prisma.estimation.findMany(findManyQuery) : [],
			options.count ? prisma.estimation.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.EstimationFindFirstArgs): Promise<Estimation | null> => {
		return await prisma.estimation.findFirst(query);
	};

	const findProjectById = async (projectId: string) => {
		return await prisma.project.findFirst({
			where: { id: projectId, isDeleted: false },
		});
	};

	const update = async (
		id: string,
		data: UpdateEstimation,
		workspaceId: string,
	): Promise<{ existingEstimation: Estimation | null; updatedEstimation: Estimation | null }> => {
		const existingEstimation = await prisma.estimation.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingEstimation) {
			return { existingEstimation: null, updatedEstimation: null };
		}

		// Type assertion: Zod validates data structure
		const updatedEstimation = await prisma.estimation.update({
			where: { id },
			data: data as Prisma.EstimationUpdateInput,
		});

		return { existingEstimation, updatedEstimation };
	};

	const remove = async (id: string, workspaceId: string): Promise<Estimation | null> => {
		const existingEstimation = await prisma.estimation.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingEstimation) {
			return null;
		}

		// CASCADING SOFT DELETE IMPLEMENTATION
		// Step 1: Soft delete all items for this estimation
		await prisma.item.updateMany({
			where: {
				estimationId: id,
				isDeleted: false,
			},
			data: { isDeleted: true },
		});

		// Step 2: Soft delete all orders for this estimation
		await prisma.order.updateMany({
			where: {
				estimationId: id,
				isDeleted: false,
			},
			data: { isDeleted: true },
		});

		// Step 3: Soft delete all payslips for this estimation
		await prisma.payslip.updateMany({
			where: {
				estimationId: id,
				isDeleted: false,
			},
			data: { isDeleted: true },
		});

		// Step 4: Soft delete the estimation itself
		await prisma.estimation.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingEstimation;
	};

	return {
		create,
		getAll,
		getById,
		findProjectById,
		update,
		remove,
	};
};
