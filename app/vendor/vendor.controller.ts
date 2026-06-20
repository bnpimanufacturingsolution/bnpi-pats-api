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
import { vendorRepository } from "./vendor.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const vendorLogger = createLogger("vendor");

export const controller = (prisma: PrismaClient) => {
	const repository = vendorRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId: workspaceId };

		const vendor = await repository.create(validatedData);
		vendorLogger.info(`Vendor created: ${vendor.id}`);

		logCreate(req, "Vendor", vendor);
		await invalidateEntityCache("vendor", vendorLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.VENDOR.CREATED, vendor, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, vendorLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		vendorLogger.info(`Getting vendors, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.VendorWhereInput = { isDeleted: false, workspaceId: workspaceId };
		const searchFields = ["vendorId", "name", "contactPerson", "email", "notes"];

		if (query) {
			const searchConditions = buildSearchConditions("Vendor", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Vendor", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "Vendor");
		const [vendors, total] = await repository.getAll(findManyQuery, whereClause, { document, count });

		vendorLogger.info(`Retrieved ${vendors.length} vendors`);

		const processedData = groupBy && document ? groupDataByField(vendors, groupBy as string) : vendors;
		const responseData: Record<string, unknown> = {
			...(document && { vendors: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Vendor", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.VENDOR.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		vendorLogger.info(`Getting vendor by ID: ${id}`);

		const cacheKey = `cache:vendor:byId:${id}:${fields || "full"}`;
		const vendor = await getOrFetch(cacheKey, async () => {
			const query: Prisma.VendorFindFirstArgs = { where: { id, workspaceId } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		if (handleNotFound(vendor, res, "Vendor", vendorLogger, id)) return;

		vendorLogger.info(`Vendor retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.VENDOR.RETRIEVED, vendor, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, vendorLogger)) return;

		const validatedData = req.body;
		vendorLogger.info(`Updating vendor: ${id}`);

		const { existingVendor, updatedVendor } = await repository.update(id, validatedData, workspaceId);

		if (handleUpdateNotFound(existingVendor, updatedVendor, res, "Vendor", vendorLogger, id)) return;

		vendorLogger.info(`Vendor updated: ${id}`);

		logUpdate(req, "Vendor", id, existingVendor!, updatedVendor!);
		await invalidateEntityCache("vendor", vendorLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.VENDOR.UPDATED, { vendor: updatedVendor }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		vendorLogger.info(`Deleting vendor: ${id}`);

		const existingVendor = await repository.remove(id, workspaceId);

		if (handleNotFound(existingVendor, res, "Vendor", vendorLogger, id)) return;

		vendorLogger.info(`Vendor deleted: ${id}`);

		logDelete(req, "Vendor", existingVendor!);
		await invalidateEntityCache("vendor", vendorLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.VENDOR.DELETED, {}, 200));
	});

	return { create, getAll, getById, update, remove };
};
