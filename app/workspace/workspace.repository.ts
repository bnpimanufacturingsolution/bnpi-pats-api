import { PrismaClient, Prisma, Workspace } from "../../generated/prisma";
import { CreateWorkspace, UpdateWorkspace } from "../../zod/workspace.zod";

export const workspaceRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateWorkspace): Promise<Workspace> => {
		return await prisma.workspace.create({ data: data as Prisma.WorkspaceCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.WorkspaceFindManyArgs,
		whereClause: Prisma.WorkspaceWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[Workspace[], number]> => {
		return await Promise.all([
			options.document ? prisma.workspace.findMany(findManyQuery) : [],
			options.count ? prisma.workspace.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.WorkspaceFindFirstArgs): Promise<Workspace | null> => {
		return await prisma.workspace.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdateWorkspace,
	): Promise<{ existingWorkspace: Workspace | null; updatedWorkspace: Workspace | null }> => {
		const existingWorkspace = await prisma.workspace.findFirst({
			where: { id },
		});

		if (!existingWorkspace) {
			return { existingWorkspace: null, updatedWorkspace: null };
		}

		const updatedWorkspace = await prisma.workspace.update({
			where: { id },
			data: data as Prisma.WorkspaceUpdateInput,
		});

		return { existingWorkspace, updatedWorkspace };
	};

	const remove = async (id: string): Promise<Workspace | null> => {
		const existingWorkspace = await prisma.workspace.findFirst({
			where: { id },
		});

		if (!existingWorkspace) {
			return null;
		}

		await prisma.workspace.delete({
			where: { id },
		});

		return existingWorkspace;
	};

	const checkCodeExists = async (code: string): Promise<boolean> => {
		const workspace = await prisma.workspace.findFirst({
			where: { code, isDeleted: false },
			select: { id: true },
		});
		return !!workspace;
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
