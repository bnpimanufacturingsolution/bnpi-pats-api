import { PrismaClient, Prisma, Project } from "../../generated/prisma";
import { CreateProject, UpdateProject } from "../../zod/project.zod";

export const projectRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateProject): Promise<Project> => {
		// Type assertion: Controller ensures all required fields are present
		return await prisma.project.create({ data: data as Prisma.ProjectCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.ProjectFindManyArgs,
		whereClause: Prisma.ProjectWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[Project[], number]> => {
		return await Promise.all([
			options.document ? prisma.project.findMany(findManyQuery) : [],
			options.count ? prisma.project.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.ProjectFindFirstArgs): Promise<Project | null> => {
		return await prisma.project.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdateProject,
		workspaceId: string,
	): Promise<{ existingProject: Project | null; updatedProject: Project | null }> => {
		const existingProject = await prisma.project.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingProject) {
			return { existingProject: null, updatedProject: null };
		}

		// Type assertion: Zod validates data structure
		const updatedProject = await prisma.project.update({
			where: { id },
			data: data as Prisma.ProjectUpdateInput,
		});

		return { existingProject, updatedProject };
	};

	const remove = async (id: string, workspaceId: string): Promise<Project | null> => {
		const existingProject = await prisma.project.findFirst({
			where: { id, isDeleted: false, workspaceId },
		});

		if (!existingProject) {
			return null;
		}

		// Get all estimations for this project
		const estimations = await prisma.estimation.findMany({
			where: { projectId: id, isDeleted: false },
			select: { id: true },
		});

		const estimationIds = estimations.map((est: { id: string }) => est.id);

		if (estimationIds.length > 0) {
			// Soft delete all related entities in parallel (4x faster)
			await Promise.all([
				prisma.item.updateMany({
					where: {
						estimationId: { in: estimationIds },
						isDeleted: false,
					},
					data: { isDeleted: true },
				}),
				prisma.order.updateMany({
					where: {
						estimationId: { in: estimationIds },
						isDeleted: false,
					},
					data: { isDeleted: true },
				}),
				prisma.payslip.updateMany({
					where: {
						estimationId: { in: estimationIds },
						isDeleted: false,
					},
					data: { isDeleted: true },
				}),
				prisma.estimation.updateMany({
					where: {
						id: { in: estimationIds },
						isDeleted: false,
					},
					data: { isDeleted: true },
				}),
			]);
		}

		// Soft delete the project itself
		await prisma.project.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existingProject;
	};

	const checkCodeExists = async (code: string, workspaceId: string): Promise<boolean> => {
		const project = await prisma.project.findFirst({
			where: { code, workspaceId, isDeleted: false },
			select: { id: true },
		});
		return !!project;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
		checkCodeExists,
	};
};
