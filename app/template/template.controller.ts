import { Response, NextFunction } from "express";
import { PrismaClient, Prisma } from "../../generated/prisma";
import { createLogger } from "../../helper/logger";
import { validateQueryParams } from "../../helper/validation-helper";
import {
	buildFilterConditions,
	buildFindManyQuery,
	buildSearchConditions,
	getNestedFields,
} from "../../helper/query-builder";
import { buildSuccessResponse, buildPagination } from "../../helper/success-handler";
import { groupDataByField } from "../../helper/dataGrouping";
import { handleNotFound, handleUpdateNotFound, validateUpdatePayload } from "../../helper/error-handler";
import { invalidateEntityCache, getOrFetch } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import { templateRepository } from "./template.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const templateLogger = createLogger("template");

export const controller = (prisma: PrismaClient) => {
	const repository = templateRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId };

		const template = await repository.create(validatedData);
		templateLogger.info(`Template created: ${template.id}`);

		logCreate(req, "Template", template);
		await invalidateEntityCache("template", templateLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.TEMPLATE.CREATED, template, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, templateLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		templateLogger.info(`Getting templates, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.TemplateWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["name", "description", "type"];

		if (query) {
			const searchConditions = buildSearchConditions("Template", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Template", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "Template");
		const [templates, total] = await repository.getAll(findManyQuery, whereClause, { document, count });

		templateLogger.info(`Retrieved ${templates.length} templates`);

		const processedData = groupBy && document ? groupDataByField(templates, groupBy as string) : templates;
		const responseData: Record<string, unknown> = {
			...(document && { templates: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Template", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.TEMPLATE.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		templateLogger.info(`Getting template by ID: ${id}`);

		const cacheKey = `cache:template:byId:${id}:${fields || "full"}`;
		const template = await getOrFetch(cacheKey, async () => {
			const query: Prisma.TemplateFindFirstArgs = { where: { id, workspaceId } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		if (handleNotFound(template, res, "Template", templateLogger, id)) return;

		templateLogger.info(`Template retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.TEMPLATE.RETRIEVED, template, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, templateLogger)) return;

		const validatedData = req.body;
		templateLogger.info(`Updating template: ${id}`);

		const { existingTemplate, updatedTemplate } = await repository.update(id, validatedData, workspaceId);

		if (handleUpdateNotFound(existingTemplate, updatedTemplate, res, "Template", templateLogger, id)) return;

		templateLogger.info(`Template updated: ${id}`);

		logUpdate(req, "Template", id, existingTemplate!, updatedTemplate!);
		await invalidateEntityCache("template", templateLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.TEMPLATE.UPDATED, { template: updatedTemplate }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		templateLogger.info(`Deleting template: ${id}`);

		const existingTemplate = await repository.remove(id, workspaceId);

		if (handleNotFound(existingTemplate, res, "Template", templateLogger, id)) return;

		templateLogger.info(`Template deleted: ${id}`);

		logDelete(req, "Template", existingTemplate!);
		await invalidateEntityCache("template", templateLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.TEMPLATE.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};
