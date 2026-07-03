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
import { buildErrorResponse, validateUpdatePayload, assertFound } from "../../helper/error-handler";
import { invalidateEntityCache, CachePatterns, getOrFetch } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll, logExport } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import { projectRepository } from "./project.repository";
import { CreateProject, UpdateProject } from "../../zod/project.zod";
import { Project } from "../../generated/prisma";
import { exportToExcel, formatDataForExcel } from "../../utils/excelExporter";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const projectLogger = createLogger("project");

export const controller = (prisma: PrismaClient) => {
	const repository = projectRepository(prisma);

	// Helper to get or create the project sequential for an organization
	const getOrCreateProjectSequential = async (workspaceId: string) => {
		let sequential = await prisma.sequential.findFirst({
			where: { code: "PRJ", workspaceId, isDeleted: false },
		});

		if (!sequential) {
			// Auto-create the sequential for this organization
			sequential = await prisma.sequential.create({
				data: {
					code: "PRJ",
					name: "Project Sequential",
					pattern: "{ORG}{000}",
					module: "project",
					current: 0,
					workspaceId,
				},
			});
		}

		return sequential;
	};

	// Helper to increment and get next project number from Sequential table
	const getNextProjectNumber = async (workspaceId: string): Promise<number> => {
		const sequential = await getOrCreateProjectSequential(workspaceId);

		// Atomically increment and return the next number
		const updated = await prisma.sequential.update({
			where: { id: sequential.id },
			data: { current: { increment: 1 } },
		});

		return updated.current;
	};

	// Helper to sync Sequential after project creation (ensures counter is at least the used number)
	const syncProjectSequential = async (workspaceId: string, usedNumber: number): Promise<void> => {
		const sequential = await getOrCreateProjectSequential(workspaceId);

		// Only update if the used number is greater than current
		if (usedNumber > sequential.current) {
			await prisma.sequential.update({
				where: { id: sequential.id },
				data: { current: usedNumber },
			});
			projectLogger.info(`Synced project sequential to ${usedNumber} for organization ${workspaceId}`);
		}
	};

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = req.body;

		// Auto-generate project code if not provided (using org code + sequential increment)
		let projectCode = validatedData.code;
		if (!projectCode) {
			try {
				// Get organization code to use as prefix
				const organization = await prisma.workspace.findFirst({
					where: { id: workspaceId },
					select: { code: true },
				});

				if (!organization?.code) {
					res.status(400).json(buildErrorResponse("Organization not found or has no code", 400));
					return;
				}

				const prefix = organization.code.toUpperCase();

				// Get next number from Sequential table (atomic increment)
				const nextNumber = await getNextProjectNumber(workspaceId);
				projectCode = `${prefix}${nextNumber.toString().padStart(3, "0")}`;

				projectLogger.info(`Auto-generated project code: ${projectCode}`);
			} catch (error) {
				projectLogger.error(`Failed to generate project code: ${error}`);
				res.status(500).json(buildErrorResponse("Failed to generate project code.", 500));
				return;
			}
		}

		// Create project with guaranteed code
		const projectData: CreateProject = { ...validatedData, code: projectCode, workspaceId };
		const project: Project = await repository.create(projectData);
		projectLogger.info(`Project created: ${project.id} with code: ${project.code}`);

		// Sync Sequential counter if code was provided (not auto-generated)
		// Extract number from code and ensure Sequential is at least that value
		if (validatedData.code) {
			try {
				const organization = await prisma.workspace.findFirst({
					where: { id: workspaceId },
					select: { code: true },
				});

				if (organization?.code) {
					const prefix = organization.code.toUpperCase();
					const match = projectCode.match(new RegExp(`^${prefix}(\\d+)$`, "i"));
					if (match) {
						const usedNumber = parseInt(match[1], 10);
						await syncProjectSequential(workspaceId, usedNumber);
					}
				}
			} catch (error) {
				// Non-fatal: log but don't fail the request
				projectLogger.warn(`Failed to sync project sequential: ${error}`);
			}
		}

		logCreate(req, "Project", project);
		await invalidateEntityCache("project", projectLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.PROJECT.CREATED, project, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, projectLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		projectLogger.info(`Getting projects, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.ProjectWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["name", "description", "type", "code", "notebookNo", "vatIncEx"];

		if (query) {
			const searchConditions = buildSearchConditions("Project", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Project", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "Project");
		const [projects, total]: [Project[], number] = await repository.getAll(findManyQuery, whereClause, { document, count });

		projectLogger.info(`Retrieved ${projects.length} projects`);

		const processedData = groupBy && document ? groupDataByField(projects, groupBy as string) : projects;
		const responseData: Record<string, unknown> = {
			...(document && { projects: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Project", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		projectLogger.info(`Getting project by ID: ${id}`);

		const cacheKey = `cache:project:byId:${id}:${fields || "full"}`;
		const project = await getOrFetch(cacheKey, async () => {
			const query: Prisma.ProjectFindFirstArgs = { where: { id, workspaceId } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		assertFound(project, "Project", projectLogger, id);

		projectLogger.info(`Project retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT.RETRIEVED, project, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, projectLogger)) return;

		const validatedData = req.body;
		projectLogger.info(`Updating project: ${id}`);

		// Get existing project to merge capital/actualExpenses if only one is being updated
		const existing = await repository.getById({ where: { id, workspaceId } });
		assertFound(existing, "Project", projectLogger, id);

		const updateData: UpdateProject = { ...validatedData };
		const { existingProject, updatedProject } = await repository.update(id, updateData, workspaceId);

		assertFound(existingProject, "Project", projectLogger, id);
		assertFound(updatedProject, "Project", projectLogger, id);

		projectLogger.info(`Project updated: ${id}`);

		logUpdate(req, "Project", id, existingProject!, updatedProject!);
		await invalidateEntityCache("project", projectLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT.UPDATED, { project: updatedProject }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		projectLogger.info(`Soft deleting project and related records: ${id}`);

		const existingProject = await repository.remove(id, workspaceId);

		assertFound(existingProject, "Project", projectLogger, id);

		projectLogger.info(`Project deleted: ${id}`);

		logDelete(req, "Project", existingProject!);
		await invalidateEntityCache("project", projectLogger, id, CachePatterns.project.onDelete);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT.DELETED, {}, 200));
	});

	const exportExcel = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, projectLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const { order, sort, query, filter } = validationResult.validatedParams!;

		projectLogger.info(`Exporting projects to Excel`);

		const whereClause: Prisma.ProjectWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["name", "description", "type", "code", "notebookNo", "vatIncEx", "status"];

		if (query) {
			const searchConditions = buildSearchConditions("Project", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Project", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		// Use reasonable limit to prevent OOM; fetch count first for large datasets
		const EXPORT_LIMIT = 5000;
		const [, totalCount] = await repository.getAll({ where: whereClause, take: 1 }, whereClause, { document: false, count: true });

		if (totalCount > EXPORT_LIMIT) {
			projectLogger.warn(`Export truncated: ${totalCount} projects exceed limit of ${EXPORT_LIMIT}`);
		}

		const findManyQuery = buildFindManyQuery(whereClause, 0, EXPORT_LIMIT, order, sort, undefined, "Project");
		const [projects]: [Project[], number] = await repository.getAll(findManyQuery, whereClause, { document: true, count: false });

		projectLogger.info(`Exporting ${projects.length} projects to Excel (total: ${totalCount})`);

		const formattedData = formatDataForExcel(projects);
		const columnHeaders = {
			id: "ID", code: "Workspace Code", name: "Name", description: "Description",
			type: "Type", notebookNo: "Notebook No", vatIncEx: "VAT INC/EX", form2307: "Form 2307",
			status: "Status", capital: "Capital", actualExpenses: "Actual Expenses",
			createdAt: "Created At", updatedAt: "Updated At",
		};
		const fields = ["code", "name", "description", "type", "notebookNo", "vatIncEx", "form2307", "status", "capital", "actualExpenses", "createdAt", "updatedAt"];

		exportToExcel(res, formattedData, {
			filename: `workspaces-export-${new Date().toISOString().split("T")[0]}`,
			sheetName: "Workspaces",
			columnHeaders,
			fields,
		});

		logExport(req, "Project", projects.length);
	});

	const exportClientSummary = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, projectLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const { order, sort, query, filter } = validationResult.validatedParams!;

		projectLogger.info(`Exporting client summary to Excel`);

		const whereClause: Prisma.ProjectWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["name", "description", "type", "code", "notebookNo", "vatIncEx", "status"];

		if (query) {
			const searchConditions = buildSearchConditions("Project", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Project", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		// Use reasonable limit to prevent OOM; fetch count first for large datasets
		const EXPORT_LIMIT = 5000;
		const [, totalCount] = await repository.getAll({ where: whereClause, take: 1 }, whereClause, { document: false, count: true });

		if (totalCount > EXPORT_LIMIT) {
			projectLogger.warn(`Export truncated: ${totalCount} projects exceed limit of ${EXPORT_LIMIT}`);
		}

		const findManyQuery = buildFindManyQuery(whereClause, 0, EXPORT_LIMIT, order, sort, undefined, "Project");
		const [projects]: [Project[], number] = await repository.getAll(findManyQuery, whereClause, { document: true, count: false });

		projectLogger.info(`Exporting ${projects.length} projects to client summary (total: ${totalCount})`);

		const formattedData = formatDataForExcel(projects);
		const columnHeaders = {
			code: "Workspace Code", name: "Workspace Name", description: "Description",
			type: "Type", notebookNo: "Notebook No", vatIncEx: "VAT INC/EX", form2307: "Form 2307",
			status: "Status", capital: "Budget", startDate: "Start Date", endDate: "End Date", createdAt: "Created At",
		};
		const fields = ["code", "name", "description", "type", "notebookNo", "vatIncEx", "form2307", "status", "capital", "startDate", "endDate", "createdAt"];

		exportToExcel(res, formattedData, {
			filename: `workspace-client-summary-${new Date().toISOString().split("T")[0]}`,
			sheetName: "Workspaces",
			columnHeaders,
			fields,
		});

		logExport(req, "Project", projects.length);
	});

	const generateCode = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;

		projectLogger.info(`Generating project code preview for organization: ${workspaceId}`);

		// Get the organization to use its code as prefix
		const organization = await prisma.workspace.findFirst({
			where: { id: workspaceId },
			select: { code: true },
		});

		if (!organization?.code) {
			res.status(400).json(buildErrorResponse("Organization not found or has no code", 400));
			return;
		}

		// Use organization code as prefix (uppercase)
		const prefix = organization.code.toUpperCase();

		// Get current counter from Sequential table
		const sequential = await getOrCreateProjectSequential(workspaceId);

		// Also check actual highest project number in database (in case Sequential is out of sync)
		const lastProject = await prisma.project.findFirst({
			where: {
				code: { startsWith: prefix },
				isDeleted: false,
				workspaceId
			},
			orderBy: { code: "desc" },
			select: { code: true },
		});

		let maxProjectNumber = sequential.current;
		if (lastProject?.code) {
			const match = lastProject.code.match(new RegExp(`^${prefix}(\\d+)$`, "i"));
			if (match) {
				const existingMax = parseInt(match[1], 10);
				if (existingMax > maxProjectNumber) {
					maxProjectNumber = existingMax;
					// Sync Sequential to match actual data
					await prisma.sequential.update({
						where: { id: sequential.id },
						data: { current: existingMax },
					});
					projectLogger.info(`Synced project sequential from ${sequential.current} to ${existingMax}`);
				}
			}
		}

		const nextNumber = maxProjectNumber + 1;
		const generatedCode = `${prefix}${nextNumber.toString().padStart(3, "0")}`;

		projectLogger.info(`Suggested project code: ${generatedCode}`);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PROJECT.CODE_GENERATED, { code: generatedCode, prefix, number: nextNumber }, 200));
	});

	return { create, getAll, getById, update, remove, exportExcel, exportClientSummary, generateCode };
};
