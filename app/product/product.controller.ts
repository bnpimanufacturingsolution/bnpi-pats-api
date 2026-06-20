import { Response, NextFunction } from "express";
import { Prisma, PrismaClient } from "../../generated/prisma";
import { createLogger } from "../../helper/logger";
import { validateQueryParams } from "../../helper/validation-helper";
import { buildFilterConditions, buildSearchConditions } from "../../helper/query-builder";
import { buildSuccessResponse, buildPagination } from "../../helper/success-handler";
import { handleNotFound, handleUpdateNotFound } from "../../helper/error-handler";
import { invalidateEntityCache } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import { productRepository } from "./product.repository";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const productLogger = createLogger("product");

const PRODUCT_INCLUDE = {
	productionSteps: true,
	materials: true,
	costAssumptions: true,
};

function formatProductCode(code: string): string {
	return code.trim().toUpperCase();
}

function generateNextProductCode(codes: string[]): { code: string; prefix: string; number: number } {
	const prefix = "PRD";
	const matchingNumbers = codes
		.map((code) => code.toUpperCase())
		.filter((code) => code.startsWith(prefix))
		.map((code) => Number.parseInt(code.slice(prefix.length), 10))
		.filter((value) => Number.isFinite(value) && value > 0);
	const number = matchingNumbers.length > 0 ? Math.max(...matchingNumbers) + 1 : 1;
	return { code: `${prefix}${String(number).padStart(3, "0")}`, prefix, number };
}

export const controller = (prisma: PrismaClient) => {
	const repository = productRepository(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validatedData = { ...req.body, workspaceId, organizationId: req.organizationId };

		const existingProducts = await prisma.product.findMany({
			where: { workspaceId, isDeleted: false },
			select: { code: true },
		});

		const nextCode = generateNextProductCode(existingProducts.map((product) => product.code));
		const productData = {
			...validatedData,
			code: formatProductCode(validatedData.code || nextCode.code),
		};

		const product = await repository.create(productData);
		productLogger.info(`Product created: ${product.id}`);

		logCreate(req, "Product", product);
		await invalidateEntityCache("product", productLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.PRODUCT.CREATED, product, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, productLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page,
			limit,
			skip,
			sort,
			order,
			query,
			filter,
			document,
			pagination,
			count,
		} = validationResult.validatedParams!;
		const sortField = typeof sort === "string" ? sort : undefined;

		const whereClause: Record<string, unknown> = { isDeleted: false, workspaceId };
		const searchFields = ["name", "code", "description", "brand", "category", "variant", "unitOfMeasure", "revision"];

		if (query) {
			const searchConditions = buildSearchConditions("Product", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Product", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const products = await repository.findMany({
			where: whereClause,
			skip,
			take: limit,
			orderBy: sortField
				? ({ [sortField]: order } as Prisma.ProductOrderByWithRelationInput)
				: ({ createdAt: "desc" } as Prisma.ProductOrderByWithRelationInput),
			include: document ? PRODUCT_INCLUDE : undefined,
		});

		let total = 0;
		if (count) {
			total = await repository.count({ where: whereClause });
		}

		const responseData: Record<string, unknown> = {
			...(document && { products }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
		};

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PRODUCT.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

		const product = await repository.getById({
			where: { id, workspaceId },
			include: PRODUCT_INCLUDE,
		});

		if (handleNotFound(product, res, "Product", productLogger, id)) return;

		productLogger.info(`Product retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PRODUCT.RETRIEVED, product, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
		const validatedData = req.body;

		const { existingProduct, updatedProduct } = await repository.update(id, validatedData, workspaceId);

		if (handleUpdateNotFound(existingProduct, updatedProduct, res, "Product", productLogger, id)) return;

		productLogger.info(`Product updated: ${id}`);

		logUpdate(req, "Product", id, existingProduct!, updatedProduct!);
		await invalidateEntityCache("product", productLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PRODUCT.UPDATED, updatedProduct, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

		const product = await repository.remove(id, workspaceId);

		if (handleNotFound(product, res, "Product", productLogger, id)) return;

		productLogger.info(`Product deleted: ${id}`);

		logDelete(req, "Product", product!);
		await invalidateEntityCache("product", productLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PRODUCT.DELETED, {}, 200));
	});

	const generateCode = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const products = await prisma.product.findMany({
			where: { workspaceId, isDeleted: false },
			select: { code: true },
		});
		const generated = generateNextProductCode(products.map((product) => product.code));

		res.status(200).json(buildSuccessResponse("Product code generated successfully", generated, 200));
	});

	return { create, getAll, getById, update, remove, generateCode };
};
