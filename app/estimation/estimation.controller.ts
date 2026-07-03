import { Response, NextFunction } from "express";
import { PrismaClient, Prisma, EstimationStatus } from "../../generated/prisma";
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
import { getNextProjectEstimationNumber } from "../../utils/sequentialCodeGenerator";
import {
	updateItemStatuses,
	updateEstimationTotalsAndMetadata,
} from "../../utils/calculations";
import { estimationRepository } from "./estimation.repository";
import {
	CreateEstimation,
	UpdateEstimation,
	EstimationStatus as ZodEstimationStatus,
} from "../../zod/estimation.zod";
import { Estimation } from "../../generated/prisma";
import { exportToExcel, formatDataForExcel } from "../../utils/excelExporter";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const estimationLogger = createLogger("estimation");

/**
 * Generate a unique name for a project's estimation by appending (N) if needed.
 * e.g., "Draft" -> "Draft (1)" -> "Draft (2)"
 */
const generateUniqueName = async (
	prisma: PrismaClient,
	projectId: string,
	baseName: string,
): Promise<string> => {
	// 1. Find all estimations in this project that start with the base name
	// We fetch just the names to minimize data transfer
	const similarEstimations = await prisma.estimation.findMany({
		where: {
			projectId,
			name: {
				startsWith: baseName,
				mode: "insensitive",
			},
			isDeleted: false,
		},
		select: { name: true },
	});

	if (similarEstimations.length === 0) {
		return baseName;
	}

	// 2. Regex to match "Base Name" or "Base Name (N)"
	// We escape special regex chars in baseName just in case
	const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	// Pattern: ^Base Name(?: \((\d+)\))?$
	// Matches "Base Name" or "Base Name (1)", "Base Name (12)", etc.
	// Case insensitive match is handled by the initial DB query, but we do strict check here
	const pattern = new RegExp(`^${escapedBaseName}(?: \\((\\d+)\\))?$`, "i");

	let maxIndex = 0;
	let hasExactMatch = false;

	for (const est of similarEstimations) {
		// Strict check against base name
		if (est.name.toLowerCase() === baseName.toLowerCase()) {
			hasExactMatch = true;
			continue;
		}

		const match = est.name.match(pattern);
		if (match && match[1]) {
			const index = parseInt(match[1], 10);
			if (index > maxIndex) {
				maxIndex = index;
			}
		}
	}

	// If the name itself doesn't exist and no numbered versions exist, use it as is
	if (!hasExactMatch && maxIndex === 0) {
		return baseName;
	}

	// Otherwise, use the next available number
	return `${baseName} (${maxIndex + 1})`;
};

export const controller = (prisma: PrismaClient) => {
	const repository = estimationRepository(prisma);
	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		// req.body is already transformed and validated by middleware
		const validatedData = req.body;

		// Verify project exists
		const project = await repository.findProjectById(validatedData.projectId);

		assertFound(project, "Project", estimationLogger, validatedData.projectId);

		// Auto-generate estimation number if not provided (per project)
		let estimationNumber = validatedData.estimationNumber;
		if (!estimationNumber) {
			try {
				estimationNumber = await getNextProjectEstimationNumber(
					prisma,
					project.code,
					validatedData.name || "",
				);
				estimationLogger.info(
					`Auto-generated estimation number: ${estimationNumber} for project: ${project.code}`,
				);
			} catch (error) {
				estimationLogger.error(`Failed to generate estimation number: ${error}`);
				res.status(500).json(
					buildErrorResponse(
						"Failed to generate estimation number for this project.",
						500,
					),
				);
				return;
			}
		}

		// Create estimation with guaranteed estimation number
		// Computed values will be stored in metaData when items are added
		const estimationData: CreateEstimation = {
			...validatedData,
			estimationNumber,
			workspaceId,
		};
		const estimation: Estimation = await repository.create(estimationData);
		estimationLogger.info(`Estimation created: ${estimation.id} with number: ${estimation.estimationNumber}`);

		logCreate(req, "Estimation", { ...estimation, name: estimation.estimationNumber });
		await invalidateEntityCache("estimation", estimationLogger, undefined, [`cache:project:byId:${project.id}:*`]);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.ESTIMATION.CREATED, estimation, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, estimationLogger);

		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page,
			limit,
			order,
			fields,
			sort,
			skip,
			query,
			document,
			pagination,
			count,
			filter,
			groupBy,
		} = validationResult.validatedParams!;

		estimationLogger.info(
			`Getting estimations, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}, groupBy: ${groupBy}`,
		);

		const whereClause: Prisma.EstimationWhereInput = {
			isDeleted: false,
			workspaceId,
		};

		const searchFields = ["estimationNumber", "notes"];
		if (query) {
			const searchConditions = buildSearchConditions("Estimation", query, searchFields);
			if (searchConditions.length > 0) {
				whereClause.OR = searchConditions;
			}
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Estimation", filter);
			if (filterConditions.length > 0) {
				whereClause.AND = filterConditions;
			}
		}

		const findManyQuery = buildFindManyQuery(
			whereClause,
			skip,
			limit,
			order,
			sort,
			fields,
			"Estimation",
		);

		// Include items by default if no fields are specified
		if (!fields && !findManyQuery.select) {
			findManyQuery.include = {
				items: {
					where: { isDeleted: false },
				},
			};
		}

		const [estimations, total]: [Estimation[], number] = await repository.getAll(
			findManyQuery,
			whereClause,
			{
				document,
				count,
			},
		);

		estimationLogger.info(`Retrieved ${estimations.length} estimations`);
		const processedData =
			groupBy && document ? groupDataByField(estimations, groupBy as string) : estimations;

		const responseData: Record<string, unknown> = {
			...(document && { estimations: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Estimation", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.ESTIMATION.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		if (!id) {
			throw new Error(config.ERROR.QUERY_PARAMS.MISSING_ID);
		}

		if (fields && typeof fields !== "string") {
			throw new Error(config.ERROR.QUERY_PARAMS.POPULATE_MUST_BE_STRING);
		}

		estimationLogger.info(`Getting estimation by ID: ${id}`);

		const cacheKey = `cache:estimation:byId:${id}:${fields || "full"}`;
		const estimation = await getOrFetch(cacheKey, async () => {
			const query: Prisma.EstimationFindFirstArgs = {
				where: { id, isDeleted: false, workspaceId },
			};

			query.select = getNestedFields(fields);

			// Include items and project metadata by default if no fields are specified
			if (!fields && !query.select) {
				query.include = {
					items: {
						where: { isDeleted: false },
					},
					project: {
						select: {
							id: true,
							name: true,
							status: true,
							metaData: true, // Includes progress (points) and budget metrics
						},
					},
				};
			}

			return repository.getById(query);
		});

		assertFound(estimation, "Estimation", estimationLogger, id);

		estimationLogger.info(`Estimation retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.ESTIMATION.RETRIEVED, estimation, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, estimationLogger)) return;

		const validatedData = req.body;
		estimationLogger.info(`Updating estimation: ${id}`);

		// First get existing estimation to check if it exists and for calculations
		const tempExisting = await repository.getById({ where: { id, isDeleted: false, workspaceId } });

		assertFound(tempExisting, "Estimation", estimationLogger, id);

		const updateData: UpdateEstimation = { ...validatedData };

		const { existingEstimation, updatedEstimation } = await repository.update(id, updateData, workspaceId);

		assertFound(existingEstimation, "Estimation", estimationLogger, id);

		logUpdate(req, "Estimation", id, existingEstimation!, { ...updatedEstimation!, name: updatedEstimation!.estimationNumber });
		await invalidateEntityCache("estimation", estimationLogger, id, [`cache:project:byId:${existingEstimation!.projectId}:*`]);

		// Update item statuses if estimation status changed to APPROVED
		if (validatedData.status === "APPROVED" && existingEstimation!.status !== "APPROVED") {
			try {
				await updateItemStatuses(prisma, id);
				estimationLogger.info(`Updated all item statuses to IN_PROGRESS for estimation ${id}`);
			} catch (error) {
				estimationLogger.warn(`Failed to update item statuses: ${error}`);
			}
		}

		// Recalculate metaData if marginPercentage changed
		if (validatedData.marginPercentage !== undefined) {
			try {
				await updateEstimationTotalsAndMetadata(prisma, id);
				estimationLogger.info(`Recalculated metaData for estimation ${id} after margin update`);
			} catch (error) {
				estimationLogger.warn(`Failed to recalculate metaData: ${error}`);
			}
		}

		estimationLogger.info(`Estimation updated: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.ESTIMATION.UPDATED, { estimation: updatedEstimation }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		estimationLogger.info(`Deleting estimation: ${id}`);

		const existingEstimation = await repository.remove(id, workspaceId);

		assertFound(existingEstimation, "Estimation", estimationLogger, id);

		estimationLogger.info(`Estimation deleted: ${id}`);

		logDelete(req, "Estimation", { ...existingEstimation!, name: existingEstimation!.estimationNumber });
		await invalidateEntityCache("estimation", estimationLogger, id, [
			...CachePatterns.estimation.onDelete,
			`cache:project:byId:${existingEstimation!.projectId}:*`,
		]);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.ESTIMATION.DELETED, {}, 200));
	});

	const createDraft = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		// req.body is already transformed and validated by middleware
		const requestData = req.body;

		const { copyFromLatest, projectId, sourceEstimationId, ...restData } = requestData;

		if (!projectId) {
			estimationLogger.error("Project ID is required");
			res.status(400).json(buildErrorResponse("Project ID is required", 400));
			return;
		}

		// Verify project exists
		const project = await repository.findProjectById(projectId);

		assertFound(project, "Project", estimationLogger, projectId);

		// Check if an approved estimation already exists for this project
		const approvedEstimation = await prisma.estimation.findFirst({
			where: {
				projectId,
				status: EstimationStatus.APPROVED,
				isDeleted: false,
				workspaceId,
			},
		});

		if (approvedEstimation) {
			estimationLogger.error(
				`Cannot create draft: Approved estimation already exists for project ${projectId}`,
			);
			res.status(400).json(
				buildErrorResponse(
					`Cannot create draft estimation. An approved estimation (${approvedEstimation.estimationNumber}) already exists for this project.`,
					400,
				),
			);
			return;
		}

		let estimationData: CreateEstimation & { workspaceId?: string; estimationNumber?: string };
		let itemsData: Omit<Prisma.ItemCreateInput, "estimation" | "estimationId" | "workspaceId">[] = [];
		let sourceEstimation = null;

		if (sourceEstimationId) {
			// Fetch specific estimation to copy from
			sourceEstimation = await prisma.estimation.findFirst({
				where: {
					id: sourceEstimationId,
					isDeleted: false,
					workspaceId,
				},
				include: {
					items: {
						where: { isDeleted: false },
					},
				},
			});

			assertFound(sourceEstimation, "Source estimation", estimationLogger, sourceEstimationId);
			estimationLogger.info(
				`Copying from specific estimation: ${sourceEstimation.estimationNumber}`,
			);
		} else if (copyFromLatest) {
			// Find the latest estimation for this project
			sourceEstimation = await prisma.estimation.findFirst({
				where: {
					projectId,
					isDeleted: false,
					workspaceId,
				},
				include: {
					items: {
						where: { isDeleted: false },
					},
				},
				orderBy: { createdAt: "desc" },
			});

			assertFound(sourceEstimation, "Estimation to copy from", estimationLogger, projectId);
			estimationLogger.info(
				`Copying from latest estimation: ${sourceEstimation.estimationNumber}`,
			);
		}

		if (sourceEstimation) {
			// Determine the base name we want to use
			const desiredBaseName = restData.name || sourceEstimation.name;

			// Generate a unique name ensuring no collision (e.g. "Draft (1)")
			const uniqueName = await generateUniqueName(prisma, projectId, desiredBaseName);

			// Copy estimation data (excluding system fields)
			// Computed values will be stored in metaData when items are recalculated
			estimationData = {
				projectId,
				name: uniqueName,
				marginPercentage: sourceEstimation.marginPercentage,
				status: ZodEstimationStatus.DRAFT,
				notes: restData.notes || sourceEstimation.notes,
			};

			// Copy items data
			itemsData = sourceEstimation.items.map((item: any) => ({
				type: item.type,
				categoryId: item.categoryId,
				itemName: item.itemName,
				estimatedQuantity: item.estimatedQuantity,
				actualQuantity: item.actualQuantity,
				estimatedUnitPrice: item.estimatedUnitPrice,
				estimatedTotal: item.estimatedTotal,
				actualUnitPrice: item.actualUnitPrice,
				actualTotal: item.actualTotal,
				documentUrls: item.documentUrls,
				parentItemId: item.parentItemId,
				isNewAddition: item.isNewAddition,
				fields: item.fields || undefined, // Copy fields if they exist
			}));
		} else {
			// Create new draft from provided data (already validated by middleware)
			// Computed values will be stored in metaData when items are added
			estimationData = {
				...restData,
				projectId,
				status: ZodEstimationStatus.DRAFT,
			};
		}

		// Auto-generate estimation number
		let estimationNumber = restData.estimationNumber;
		if (!estimationNumber) {
			try {
				estimationNumber = await getNextProjectEstimationNumber(
					prisma,
					project.code,
					estimationData.name || "",
				);
				estimationLogger.info(
					`Auto-generated estimation number: ${estimationNumber} for project: ${project.code}`,
				);
			} catch (error) {
				estimationLogger.error(`Failed to generate estimation number: ${error}`);
				res.status(500).json(
					buildErrorResponse(
						"Failed to generate estimation number for this project.",
						500,
					),
				);
				return;
			}
		}

		// Create the estimation with auto-incremented version
		estimationData.estimationNumber = estimationNumber;
		estimationData.workspaceId = workspaceId;
		const estimation: Estimation = await repository.create(estimationData);
		estimationLogger.info(
			`Draft estimation created successfully: ${estimation.id} with number: ${estimation.estimationNumber}`,
		);

		// If copying, create all items and recalculate metaData
		if ((copyFromLatest || sourceEstimationId) && itemsData.length > 0) {
			// Create items (note: parentItemId hierarchy might need adjustment)
			const createdItems = await prisma.item.createMany({
				data: itemsData.map((itemData) => ({
					...itemData,
					estimationId: estimation.id,
					parentItemId: null,
					workspaceId,
				})),
			});

			estimationLogger.info(
				`Created ${createdItems.count} items for draft: ${estimation.id}`,
			);

			// Recalculate metaData after items are copied
			try {
				await updateEstimationTotalsAndMetadata(prisma, estimation.id);
				estimationLogger.info(`Calculated metaData for draft estimation: ${estimation.id}`);
			} catch (error) {
				estimationLogger.warn(`Failed to calculate metaData for draft: ${error}`);
			}
		}

		logCreate(req, "Estimation", { ...estimation, name: estimation.estimationNumber });
		await invalidateEntityCache("estimation", estimationLogger, undefined, [`cache:project:byId:${project.id}:*`]);

		// Fetch the created estimation with items to return complete data
		const createdEstimation = await prisma.estimation.findFirst({
			where: { id: estimation.id },
			include: {
				items: {
					where: { isDeleted: false },
				},
			},
		});

		res.status(201).json(
			buildSuccessResponse(config.SUCCESS.ESTIMATION.DRAFT_CREATED, createdEstimation, 201),
		);
	});

	const exportExcel = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, estimationLogger);

		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const { order, sort, query, filter } = validationResult.validatedParams!;

		estimationLogger.info(`Exporting estimations to Excel, query: ${query}`);

		// Base where clause
		const whereClause: Prisma.EstimationWhereInput = {
			isDeleted: false,
			workspaceId,
		};

		const searchFields = ["name", "estimationNumber", "status"];
		if (query) {
			const searchConditions = buildSearchConditions("Estimation", query, searchFields);
			if (searchConditions.length > 0) {
				whereClause.OR = searchConditions;
			}
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Estimation", filter);
			if (filterConditions.length > 0) {
				whereClause.AND = filterConditions;
			}
		}

		// Get all estimations without pagination for export
		const findManyQuery = buildFindManyQuery(
			whereClause,
			0,
			10000, // Maximum limit for export
			order,
			sort,
			undefined,
			"Estimation",
		);

		const [estimations]: [Estimation[], number] = await repository.getAll(
			findManyQuery,
			whereClause,
			{
				document: true,
				count: false,
			},
		);

		estimationLogger.info(`Exporting ${estimations.length} estimations to Excel`);

		// Format data for Excel
		const formattedData = formatDataForExcel(estimations);

		// Define column headers for better readability
		// Note: Financial data is now in metaData, flatten for export
		const columnHeaders = {
			id: "ID",
			estimationNumber: "Estimation Number",
			name: "Name",
			status: "Status",
			marginPercentage: "Margin %",
			projectId: "Project ID",
			createdAt: "Created At",
			updatedAt: "Updated At",
		};

		// Specify fields to export (in order)
		// Note: Computed values are in metaData and need to be extracted separately
		const fields = [
			"estimationNumber",
			"name",
			"status",
			"marginPercentage",
			"createdAt",
			"updatedAt",
		];

		// Export to Excel
		exportToExcel(res, formattedData, {
			filename: `estimations-export-${new Date().toISOString().split("T")[0]}`,
			sheetName: "Estimations",
			columnHeaders,
			fields,
		});

		logExport(req, "Estimation", estimations.length);
	});

	return { create, getAll, getById, update, remove, createDraft, exportExcel };
};
