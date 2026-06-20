import { PrismaClient, Prisma, Milestone } from "../../generated/prisma";
import { CreateMilestone, UpdateMilestone } from "../../zod/milestone.zod";

export const milestoneRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateMilestone): Promise<Milestone> => {
		return await prisma.milestone.create({
			data: data as Prisma.MilestoneUncheckedCreateInput,
		});
	};

	const findMany = async (params?: {
		skip?: number;
		take?: number;
		where?: Prisma.MilestoneWhereInput;
		orderBy?: Prisma.MilestoneOrderByWithRelationInput;
	}): Promise<Milestone[]> => {
		return await prisma.milestone.findMany({
			...params,
			where: {
				...params?.where,
				isDeleted: false,
			},
		});
	};

	const getById = async (params: { where: Prisma.MilestoneWhereInput }): Promise<Milestone | null> => {
		return await prisma.milestone.findFirst({
			where: {
				...params.where,
				isDeleted: false,
			},
		});
	};

	const update = async (
		id: string,
		data: UpdateMilestone,
		workspaceId: string,
	): Promise<{ existingMilestone: Milestone | null; updatedMilestone: Milestone | null }> => {
		const existingMilestone = await prisma.milestone.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingMilestone) {
			return { existingMilestone: null, updatedMilestone: null };
		}

		const updatedMilestone = await prisma.milestone.update({
			where: { id },
			data: data as Prisma.MilestoneUpdateInput,
		});

		return { existingMilestone, updatedMilestone };
	};

	const remove = async (id: string, workspaceId: string): Promise<Milestone | null> => {
		const existingMilestone = await prisma.milestone.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingMilestone) {
			return null;
		}

		return await prisma.milestone.update({
			where: { id },
			data: { isDeleted: true },
		});
	};

	const count = async (params?: { where?: Prisma.MilestoneWhereInput }): Promise<number> => {
		return await prisma.milestone.count({
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
