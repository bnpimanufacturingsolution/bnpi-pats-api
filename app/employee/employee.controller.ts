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
import {
	handleNotFound,
	handleUpdateNotFound,
	validateUpdatePayload,
	buildErrorResponse,
} from "../../helper/error-handler";
import { invalidateEntityCache, getOrFetch } from "../../helper/cache-helper";

import { config } from "../../config/constant";
import { employeeRepository } from "./employee.repository";
import { createEmployeeService, EmployeeService } from "./employee.service";
import {
	CreateEmployeeSchema,
	UpdateEmployeeSchema,
	SyncConfigSchema,
} from "../../zod/employee.zod";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const employeeLogger = createLogger("employee");

// Default HRIS configuration
const HRIS_CONFIG = {
	baseUrl: process.env.HRIS_API_URL || "http://localhost:3001/api",
	timeout: 30000,
	retryAttempts: 2,
	retryDelay: 1000,
	batchSize: 100,
	pageLimit: 1000,
};

/**
 * Extract bearer token from authorization header
 */
const extractBearerToken = (authHeader?: string): string | undefined => {
	return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
};

/**
 * Build HRIS API URL with query parameters
 */
const buildHrisApiUrl = (baseUrl: string): string => {
	return `${baseUrl}/employee?document=true&page=1&limit=${HRIS_CONFIG.pageLimit}&pagination=true`;
};

/**
 * Perform HRIS sync before fetching from database
 */
const performSyncFirst = async (
	service: EmployeeService,
	workspaceId: string,
	hrisUrl: string | undefined,
	authToken: string | undefined
): Promise<{ source: "api" | "database"; message?: string }> => {
	if (!authToken) {
		employeeLogger.warn("SyncFirst: No auth token provided");
		return { source: "database", message: "No auth token for sync" };
	}

	const apiUrl = buildHrisApiUrl(hrisUrl || HRIS_CONFIG.baseUrl);

	try {
		const result = await service.syncEmployees(workspaceId, {
			apiUrl,
			authType: "bearer",
			authToken,
			timeout: HRIS_CONFIG.timeout,
			retryAttempts: HRIS_CONFIG.retryAttempts,
			retryDelay: HRIS_CONFIG.retryDelay,
			batchSize: HRIS_CONFIG.batchSize,
			syncAllOrganizations: false,
		});

		employeeLogger.info(`SyncFirst: ${result.synced || 0} employees synced from ${result.source}`);
		return { source: result.source, message: result.message };
	} catch (error: any) {
		employeeLogger.warn(`SyncFirst failed: ${error.message}`);
		return { source: "database", message: `Sync failed: ${error.message}` };
	}
};

export interface IEmployeeController {
	getAll(req: AuthRequest, res: Response, next: NextFunction): void;
	getById(req: AuthRequest, res: Response, next: NextFunction): void;
	create(req: AuthRequest, res: Response, next: NextFunction): void;
	update(req: AuthRequest, res: Response, next: NextFunction): void;
	remove(req: AuthRequest, res: Response, next: NextFunction): void;
	sync(req: AuthRequest, res: Response, next: NextFunction): void;
	getSyncStatus(req: AuthRequest, res: Response, next: NextFunction): void;
	getSyncIssues(req: AuthRequest, res: Response, next: NextFunction): void;
	getStats(req: AuthRequest, res: Response, next: NextFunction): void;
	getByExternalId(req: AuthRequest, res: Response, next: NextFunction): void;
}

export const controller = (prisma: PrismaClient): IEmployeeController => {
	const repository = employeeRepository(prisma);
	const service = createEmployeeService(prisma, employeeLogger);

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, employeeLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		// Handle syncFirst - try HRIS API before reading from database
		const syncFirst = req.query.syncFirst === "true";
		let dataSource: "api" | "database" = "database";
		let syncMessage: string | undefined;

		if (syncFirst) {
			employeeLogger.info("SyncFirst requested");
			const authToken = extractBearerToken(req.headers.authorization);
			const syncResult = await performSyncFirst(
				service,
				workspaceId,
				req.query.hrisUrl as string | undefined,
				authToken
			);
			dataSource = syncResult.source;
			syncMessage = syncResult.message;
			if (dataSource === "api") {
				await invalidateEntityCache("employee", employeeLogger);
			}
		}

		employeeLogger.info(`Getting employees, page: ${page}, limit: ${limit}`);

		// Build query
		const whereClause: Prisma.EmployeeWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["firstName", "lastName", "email", "employeeId", "departmentName", "positionTitle"];

		if (query) {
			const searchConditions = buildSearchConditions("Employee", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Employee", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "Employee");
		const [employees, total] = await repository.getAll(
			findManyQuery as Prisma.EmployeeFindManyArgs,
			whereClause,
			{ document, count }
		);

		employeeLogger.info(`Retrieved ${employees.length} employees`);

		// Build response
		const processedData = groupBy && document ? groupDataByField(employees, groupBy as string) : employees;
		const responseData: Record<string, unknown> = {
			...(document && { employees: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
			source: dataSource,
			...(syncMessage && { syncMessage }),
		};

		res.status(200).json(buildSuccessResponse(config.SUCCESS.EMPLOYEE.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		employeeLogger.info(`Getting employee by ID: ${id}`);

		const cacheKey = `cache:employee:byId:${id}:${fields || "full"}`;
		const employee = await getOrFetch(cacheKey, async () => {
			const selectFields = fields ? getNestedFields(fields as string, "Employee") : undefined;

			// First, try to find by MongoDB _id
			const queryById: Prisma.EmployeeFindFirstArgs = {
				where: { id, workspaceId, isDeleted: false },
				...(selectFields && { select: selectFields }),
			};
			let result = await repository.getById(queryById);

			// If not found by _id, try to find by externalId (for HRIS IDs)
			if (!result) {
				employeeLogger.info(`Employee not found by _id, trying externalId: ${id}`);
				const queryByExternalId: Prisma.EmployeeFindFirstArgs = {
					where: { externalId: id, workspaceId, isDeleted: false },
					...(selectFields && { select: selectFields }),
				};
				result = await repository.getById(queryByExternalId);
			}

			return result;
		});

		if (handleNotFound(employee, res, "Employee", employeeLogger, id)) return;

		employeeLogger.info(`Employee retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.EMPLOYEE.RETRIEVED, employee, 200));
	});

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const userId = req.userId;

		// Generate unique externalId for locally-created employees to avoid unique constraint issues
		const localExternalId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

		const validation = CreateEmployeeSchema.safeParse({
			...req.body,
			workspaceId,
			createdBy: userId,
			syncStatus: "LOCAL_ONLY",
			externalId: req.body.externalId || localExternalId,
			externalSource: req.body.externalSource || "local",
		});

		if (!validation.success) {
			res.status(400).json(buildErrorResponse(config.ERROR.COMMON.VALIDATION_ERROR, 400, validation.error.issues as any));
			return;
		}

		// Check for duplicates
		const [existingEmail, existingNumber] = await Promise.all([
			repository.getByEmail(validation.data.email, workspaceId),
			repository.getByEmployeeNumber(validation.data.employeeId, workspaceId),
		]);

		if (existingEmail) {
			res.status(409).json(buildErrorResponse("Employee with this email already exists", 409));
			return;
		}
		if (existingNumber) {
			res.status(409).json(buildErrorResponse("Employee with this employee ID already exists", 409));
			return;
		}

		const employee = await repository.create(validation.data as Prisma.EmployeeCreateInput);
		employeeLogger.info(`Employee created: ${employee.id}`);

		await invalidateEntityCache("employee", employeeLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.EMPLOYEE.CREATED, employee, 201));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const userId = req.userId;

		if (!validateUpdatePayload(req.body, res, employeeLogger)) return;

		const validation = UpdateEmployeeSchema.safeParse({
			...req.body,
			updatedBy: userId,
		});

		if (!validation.success) {
			res.status(400).json(buildErrorResponse(config.ERROR.COMMON.VALIDATION_ERROR, 400, validation.error.issues as any));
			return;
		}

		employeeLogger.info(`Updating employee: ${id}`);

		// Check email uniqueness if being updated
		if (validation.data.email) {
			const existingEmail = await repository.getByEmail(validation.data.email, workspaceId);
			if (existingEmail && existingEmail.id !== id) {
				res.status(409).json(buildErrorResponse("Email already in use", 409));
				return;
			}
		}

		// Check for circular reporting reference
		if (validation.data.reportToId) {
			const hasCircular = await repository.hasCircularReference(
				id,
				validation.data.reportToId,
				workspaceId
			);
			if (hasCircular) {
				res.status(400).json(
					buildErrorResponse(
						"Circular reporting reference detected. This employee cannot report to someone who already reports to them.",
						400
					)
				);
				return;
			}
		}

		const { existingEmployee, updatedEmployee } = await repository.update(
			id,
			validation.data as Prisma.EmployeeUpdateInput,
			workspaceId
		);

		if (handleUpdateNotFound(existingEmployee, updatedEmployee, res, "Employee", employeeLogger, id)) return;

		employeeLogger.info(`Employee updated: ${id}`);
		await invalidateEntityCache("employee", employeeLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.EMPLOYEE.UPDATED, { employee: updatedEmployee }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		employeeLogger.info(`Deleting employee: ${id}`);

		const existingEmployee = await repository.remove(id, workspaceId);

		if (handleNotFound(existingEmployee, res, "Employee", employeeLogger, id)) return;

		employeeLogger.info(`Employee deleted: ${id}`);
		await invalidateEntityCache("employee", employeeLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.EMPLOYEE.DELETED, {}, 200));
	});

	const sync = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;

		const validation = SyncConfigSchema.safeParse(req.body);
		if (!validation.success) {
			res.status(400).json(buildErrorResponse(config.ERROR.COMMON.VALIDATION_ERROR, 400, validation.error.issues as any));
			return;
		}

		employeeLogger.info(`Starting employee sync for organization: ${workspaceId}`);

		const result = await service.triggerSync(workspaceId, validation.data);

		employeeLogger.info(`Sync completed: ${result.synced} employees synced`);
		await invalidateEntityCache("employee", employeeLogger);

		res.status(200).json(
			buildSuccessResponse(result.message, {
				source: result.source,
				total: result.total,
				synced: result.synced,
				created: result.created,
				updated: result.updated,
				failed: result.failed,
				errors: result.errors,
			}, 200)
		);
	});

	const getSyncStatus = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const status = await service.getSyncStatus(workspaceId);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.EMPLOYEE.SYNC_STATUS, status, 200));
	});

	const getSyncIssues = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const issues = await repository.getWithSyncIssues(workspaceId);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.EMPLOYEE.SYNC_ISSUES, issues, 200));
	});

	const getStats = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const stats = await repository.getStats(workspaceId);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.EMPLOYEE.STATISTICS, stats, 200));
	});

	const getByExternalId = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { externalId } = req.params;
		const { externalSource } = req.query;

		const employee = await repository.getByExternalId(
			externalId,
			workspaceId,
			externalSource as string | undefined
		);

		if (handleNotFound(employee, res, "Employee", employeeLogger, externalId)) return;

		res.status(200).json(buildSuccessResponse(config.SUCCESS.EMPLOYEE.RETRIEVED, employee, 200));
	});

	return {
		getAll,
		getById,
		create,
		update,
		remove,
		sync,
		getSyncStatus,
		getSyncIssues,
		getStats,
		getByExternalId,
	};
};

export type EmployeeController = ReturnType<typeof controller>;
