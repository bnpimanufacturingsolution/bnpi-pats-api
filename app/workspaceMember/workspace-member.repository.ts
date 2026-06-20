import { PrismaClient, Prisma, WorkspaceMember } from "../../generated/prisma";
import { AddWorkspaceMember } from "../../zod/workspaceMember.zod";

export const workspaceMemberRepository = (prisma: PrismaClient) => {
	const add = async (data: AddWorkspaceMember & { workspaceId: string }): Promise<WorkspaceMember> => {
		return await prisma.workspaceMember.create({
			data: data as Prisma.WorkspaceMemberCreateInput,
		});
	};

	const getAll = async (
		findManyQuery: Prisma.WorkspaceMemberFindManyArgs,
		whereClause: Prisma.WorkspaceMemberWhereInput,
		options: { document: boolean; count: boolean },
	): Promise<[WorkspaceMember[], number]> => {
		return await Promise.all([
			options.document ? prisma.workspaceMember.findMany(findManyQuery) : [],
			options.count ? prisma.workspaceMember.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.WorkspaceMemberFindFirstArgs): Promise<WorkspaceMember | null> => {
		return await prisma.workspaceMember.findFirst(query);
	};

	const getByWorkspaceAndUser = async (workspaceId: string, userId: string): Promise<WorkspaceMember | null> => {
		return await prisma.workspaceMember.findFirst({
			where: { workspaceId, userId, isDeleted: false },
		});
	};

	const updateRole = async (
		id: string,
		role: string,
		workspaceId: string,
	): Promise<{ existing: WorkspaceMember | null; updated: WorkspaceMember | null }> => {
		const existing = await prisma.workspaceMember.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});

		if (!existing) {
			return { existing: null, updated: null };
		}

		const updated = await prisma.workspaceMember.update({
			where: { id },
			data: { role: role as any },
		});

		return { existing, updated };
	};

	const remove = async (id: string, workspaceId: string): Promise<WorkspaceMember | null> => {
		const existing = await prisma.workspaceMember.findFirst({
			where: { id, workspaceId, isDeleted: false },
		});

		if (!existing) {
			return null;
		}

		await prisma.workspaceMember.update({
			where: { id },
			data: { isDeleted: true },
		});

		return existing;
	};

	const countByRole = async (workspaceId: string, role: string): Promise<number> => {
		return await prisma.workspaceMember.count({
			where: { workspaceId, role: role as any, isDeleted: false },
		});
	};

	return {
		add,
		getAll,
		getById,
		getByWorkspaceAndUser,
		updateRole,
		remove,
		countByRole,
	};
};
