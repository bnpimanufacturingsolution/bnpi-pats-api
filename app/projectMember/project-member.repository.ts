import { PrismaClient, Prisma, ProjectMember } from "../../generated/prisma";
import { AddProjectMember } from "../../zod/projectMember.zod";

export const projectMemberRepository = (prisma: PrismaClient) => {
	const add = async (data: AddProjectMember & { workspaceId: string }): Promise<ProjectMember> => {
		return await prisma.projectMember.create({
			data: data as Prisma.ProjectMemberCreateInput,
		});
	};

	const getAll = async (
		findManyQuery: Prisma.ProjectMemberFindManyArgs,
		whereClause: Prisma.ProjectMemberWhereInput,
		options: { document: boolean; count: boolean },
	): Promise<[ProjectMember[], number]> => {
		return await Promise.all([
			options.document ? prisma.projectMember.findMany(findManyQuery) : [],
			options.count ? prisma.projectMember.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.ProjectMemberFindFirstArgs): Promise<ProjectMember | null> => {
		return await prisma.projectMember.findFirst(query);
	};

	const getByProject = async (projectId: string, workspaceId: string): Promise<ProjectMember[]> => {
		return await prisma.projectMember.findMany({
			where: { projectId, workspaceId, isDeleted: false },
		});
	};

	const getByProjectAndUser = async (projectId: string, userId: string): Promise<ProjectMember | null> => {
		return await prisma.projectMember.findFirst({
			where: { projectId, userId, isDeleted: false },
		});
	};

	const updateRole = async (
		id: string,
		role: string,
		workspaceId: string,
	): Promise<{ existing: ProjectMember | null; updated: ProjectMember | null }> => {
		const existing = await prisma.projectMember.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});

		if (!existing) {
			return { existing: null, updated: null };
		}

		const updated = await prisma.projectMember.update({
			where: { id },
			data: { role: role as any },
		});

		return { existing, updated };
	};

	const remove = async (id: string, workspaceId: string): Promise<ProjectMember | null> => {
		const existing = await prisma.projectMember.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});

		if (!existing) {
			return null;
		}

		await prisma.projectMember.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existing;
	};

	const removeByUserAndWorkspace = async (userId: string, workspaceId: string): Promise<number> => {
		const result = await prisma.projectMember.updateMany({
			where: { userId, workspaceId, isDeleted: false },
			data: { isDeleted: true },
		});
		return result.count;
	};

	return {
		add,
		getAll,
		getById,
		getByProject,
		getByProjectAndUser,
		updateRole,
		remove,
		removeByUserAndWorkspace,
	};
};
