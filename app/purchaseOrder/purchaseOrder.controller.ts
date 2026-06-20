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
import { NotFoundError } from "../../errors";
import { purchaseOrderRepository } from "./purchaseOrder.repository";
import { createPurchaseOrderService } from "./purchaseOrder.service";
import { CreatePurchaseOrder, UpdatePurchaseOrder } from "../../zod/purchaseOrder.zod";
import { PurchaseOrder } from "../../generated/prisma";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";
import { generatePurchaseOrderPdf, type PurchaseOrderPdfData } from "../../utils/pdfExporter";

const purchaseOrderLogger = createLogger("purchaseOrder");

export const controller = (prisma: PrismaClient) => {
	const repository = purchaseOrderRepository(prisma);
	const service = createPurchaseOrderService(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const purchaseOrderData: CreatePurchaseOrder = { ...req.body, workspaceId };

		const purchaseOrder: PurchaseOrder = await repository.create(purchaseOrderData);
		purchaseOrderLogger.info(`Purchase Order created: ${purchaseOrder.id}`);

		logCreate(req, "PurchaseOrder", { ...purchaseOrder, name: purchaseOrder.poNumber });
		await invalidateEntityCache("purchaseOrder", purchaseOrderLogger);

		res.status(201).json(buildSuccessResponse(config.SUCCESS.PURCHASE_ORDER.CREATED, purchaseOrder, 201));
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, purchaseOrderLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		purchaseOrderLogger.info(`Getting purchase orders, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.PurchaseOrderWhereInput = { isDeleted: false, workspaceId };
		const searchFields = ["poNumber", "remarks"];

		if (query) {
			const searchConditions = buildSearchConditions("PurchaseOrder", query, searchFields);
			if (searchConditions.length > 0) whereClause.OR = searchConditions;
		}

		if (filter) {
			const filterConditions = buildFilterConditions("PurchaseOrder", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "PurchaseOrder");
		const [purchaseOrders, total]: [PurchaseOrder[], number] = await repository.getAll(findManyQuery, whereClause, { document, count });

		purchaseOrderLogger.info(`Retrieved ${purchaseOrders.length} purchase orders`);

		const processedData = groupBy && document ? groupDataByField(purchaseOrders, groupBy as string) : purchaseOrders;
		const responseData: Record<string, unknown> = {
			...(document && { purchaseOrders: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "PurchaseOrder", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PURCHASE_ORDER.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		purchaseOrderLogger.info(`Getting purchase order by ID: ${id}`);

		const cacheKey = `cache:purchaseOrder:byId:${id}:${fields || "full"}`;
		const purchaseOrder = await getOrFetch(cacheKey, async () => {
			const query: Prisma.PurchaseOrderFindFirstArgs = { where: { id, workspaceId, isDeleted: false } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		if (handleNotFound(purchaseOrder, res, "PurchaseOrder", purchaseOrderLogger, id)) return;

		purchaseOrderLogger.info(`Purchase Order retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PURCHASE_ORDER.RETRIEVED, purchaseOrder, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		if (!validateUpdatePayload(req.body, res, purchaseOrderLogger)) return;

		purchaseOrderLogger.info(`Updating purchase order: ${id}`);

		const updateData: UpdatePurchaseOrder = { ...req.body };
		const { existingPurchaseOrder, updatedPurchaseOrder } = await repository.update(id, updateData, workspaceId);

		if (handleUpdateNotFound(existingPurchaseOrder, updatedPurchaseOrder, res, "PurchaseOrder", purchaseOrderLogger, id)) return;

		// Delegate all status-change side effects to the service
		if (existingPurchaseOrder!.status !== updatedPurchaseOrder!.status) {
			await service.handleStatusChange(existingPurchaseOrder!, updatedPurchaseOrder!, workspaceId);
		}

		purchaseOrderLogger.info(`Purchase Order updated: ${id}`);

		logUpdate(req, "PurchaseOrder", id, existingPurchaseOrder!, { ...updatedPurchaseOrder!, name: updatedPurchaseOrder!.poNumber });
		await invalidateEntityCache("purchaseOrder", purchaseOrderLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PURCHASE_ORDER.UPDATED, { purchaseOrder: updatedPurchaseOrder }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		purchaseOrderLogger.info(`Deleting purchase order: ${id}`);

		const existingPurchaseOrder = await repository.remove(id, workspaceId);

		if (handleNotFound(existingPurchaseOrder, res, "PurchaseOrder", purchaseOrderLogger, id)) return;

		purchaseOrderLogger.info(`Purchase Order deleted: ${id}`);

		logDelete(req, "PurchaseOrder", { ...existingPurchaseOrder!, name: existingPurchaseOrder!.poNumber });
		await invalidateEntityCache("purchaseOrder", purchaseOrderLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PURCHASE_ORDER.DELETED, {}, 200));
	});

	const exportPdf = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;

		purchaseOrderLogger.info(`Exporting PDF for purchase order: ${id}`);

		const purchaseOrder = await prisma.purchaseOrder.findFirst({
			where: { id, workspaceId, isDeleted: false },
			include: {
				vendor: true,
				project: { select: { id: true, name: true, code: true } },
				workspace: { select: { name: true, address: true, phone: true, email: true, logoUrl: true } },
			},
		});

		if (!purchaseOrder) throw new NotFoundError("PurchaseOrder", id);

		const fmtDate = (d: Date | string | null | undefined): string => {
			if (!d) return "";
			const date = typeof d === "string" ? new Date(d) : d;
			return date.toLocaleDateString("en-PH", { year: "2-digit", month: "short", day: "2-digit" });
		};

		const pdfData: PurchaseOrderPdfData = {
			companyName: purchaseOrder.workspace?.name || "",
			companyAddress: purchaseOrder.workspace?.address || "",
			companyPhone: purchaseOrder.workspace?.phone || "",
			companyEmail: purchaseOrder.workspace?.email || "",
			companyLogoUrl: purchaseOrder.workspace?.logoUrl || null,
			poNumber: purchaseOrder.poNumber,
			orderDate: fmtDate(purchaseOrder.orderDate),
			projectCode: purchaseOrder.project?.code || "",
			vendorName: purchaseOrder.vendor?.name || "",
			vendorAddress: purchaseOrder.vendor?.address || "",
			contactPerson: purchaseOrder.vendor?.contactPerson || "",
			contactPhone: purchaseOrder.vendor?.phone || "",
			contactDesignation: purchaseOrder.vendor?.contactDesignation || "",
			contactMobile: purchaseOrder.vendor?.mobile || "",
			contactDepartment: purchaseOrder.vendor?.contactDepartment || "",
			contactEmail: purchaseOrder.vendor?.email || "",
			deliveryAddress: purchaseOrder.deliveryAddress || "",
			requestedBy: purchaseOrder.requestedBy || "",
			requestedByTitle: purchaseOrder.requestedByTitle || "",
			requestedByDepartment: purchaseOrder.requestedByDepartment || "",
			shippingTerms: purchaseOrder.shippingTerms || "",
			leadTime: purchaseOrder.leadTime || "",
			availability: purchaseOrder.availability || "",
			deliveryTerms: purchaseOrder.deliveryTerms || "",
			items: (purchaseOrder.items || []).map((item) => ({
				quantity: item.quantity,
				unit: item.unit || "",
				itemCode: item.itemCode || "",
				description: item.description,
				unitPrice: item.unitPrice,
				totalPrice: item.totalPrice,
			})),
			currency: purchaseOrder.currency,
			subtotal: purchaseOrder.subtotal,
			totalAmount: purchaseOrder.totalAmount,
			checkedBy: purchaseOrder.checkedBy || "",
			checkedByTitle: purchaseOrder.checkedByTitle || "",
			dateProcessed: fmtDate(purchaseOrder.orderDate),
			approvedBy: purchaseOrder.approvedBy || "",
			approvedByTitle: purchaseOrder.approvedByTitle || "",
			dateApproved: fmtDate(purchaseOrder.approvalDate),
			acknowledgedBy: purchaseOrder.acknowledgedBy || "",
			termsConditions: purchaseOrder.termsConditions || "",
		};

		const pdfBuffer = await generatePurchaseOrderPdf(pdfData);

		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", `attachment; filename="${purchaseOrder.poNumber}.pdf"`);
		res.send(pdfBuffer);

		purchaseOrderLogger.info(`PDF exported for PO: ${purchaseOrder.poNumber}`);
	});

	return { create, getAll, getById, update, remove, exportPdf };
};
