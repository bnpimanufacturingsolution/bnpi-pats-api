import { PrismaClient, Prisma, Template } from "../../generated/prisma";
import { CreateTemplate, UpdateTemplate } from "../../zod/template.zod";

export const templateRepository = (prisma: PrismaClient) => {
	const create = async (data: CreateTemplate): Promise<Template> => {
		// Type assertion: Controller ensures all required fields are present
		return await prisma.template.create({ data: data as Prisma.TemplateCreateInput });
	};

	const getAll = async (
		findManyQuery: Prisma.TemplateFindManyArgs,
		whereClause: Prisma.TemplateWhereInput,
		options: { document: boolean; count: boolean }
	): Promise<[Template[], number]> => {
		return await Promise.all([
			options.document ? prisma.template.findMany(findManyQuery) : [],
			options.count ? prisma.template.count({ where: whereClause }) : 0,
		]);
	};

	const getById = async (query: Prisma.TemplateFindFirstArgs): Promise<Template | null> => {
		return await prisma.template.findFirst(query);
	};

	const update = async (
		id: string,
		data: UpdateTemplate,
		workspaceId: string,
	): Promise<{ existingTemplate: Template | null; updatedTemplate: Template | null }> => {
		const existingTemplate = await prisma.template.findFirst({
			where: { id, workspaceId },
		});

		if (!existingTemplate) {
			return { existingTemplate: null, updatedTemplate: null };
		}

		// Type assertion: Zod validates data structure
		const updatedTemplate = await prisma.template.update({
			where: { id },
			data: data as Prisma.TemplateUpdateInput,
		});

		return { existingTemplate, updatedTemplate };
	};

	const remove = async (id: string, workspaceId: string): Promise<Template | null> => {
		const existingTemplate = await prisma.template.findFirst({
			where: { id, workspaceId },
		});

		if (!existingTemplate) {
			return null;
		}

		await prisma.template.delete({
			where: { id },
		});

		return existingTemplate;
	};

	return {
		create,
		getAll,
		getById,
		update,
		remove,
	};
};
