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
import { buildErrorResponse, handleNotFound } from "../../helper/error-handler";
import { invalidateEntityCache, getOrFetch } from "../../helper/cache-helper";
import { logGetAll, logDelete } from "../../helper/logging-helper";
import { config } from "../../config/constant";
import { paymentScheduleRepository } from "./paymentSchedule.repository";
import { createPaymentScheduleService } from "./paymentSchedule.service";
import { PaymentSchedule } from "../../generated/prisma";
import asyncHandler from "../../middleware/asyncHandler";
import { AuthRequest } from "../../middleware/verifyToken";

const paymentScheduleLogger = createLogger("paymentSchedule");

export const controller = (prisma: PrismaClient) => {
	const repository = paymentScheduleRepository(prisma);
	const service = createPaymentScheduleService(prisma);

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, paymentScheduleLogger);
		if (!validationResult.isValid) {
			res.status(400).json(validationResult.errorResponse);
			return;
		}

		const {
			page, limit, order, fields, sort, skip, query,
			document, pagination, count, filter, groupBy,
		} = validationResult.validatedParams!;

		paymentScheduleLogger.info(`Getting payment schedules, page: ${page}, limit: ${limit}`);

		const whereClause: Prisma.PaymentScheduleWhereInput = { isDeleted: false, workspaceId };

		if (filter) {
			const filterConditions = buildFilterConditions("PaymentSchedule", filter);
			if (filterConditions.length > 0) whereClause.AND = filterConditions;
		}

		const findManyQuery = buildFindManyQuery(whereClause, skip, limit, order, sort, fields, "PaymentSchedule");
		const [paymentSchedules, total]: [PaymentSchedule[], number] = await repository.getAll(findManyQuery, whereClause, { document, count });

		paymentScheduleLogger.info(`Retrieved ${paymentSchedules.length} payment schedules`);

		const responseData: Record<string, unknown> = {
			...(document && { paymentSchedules }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
		};

		logGetAll(req, "PaymentSchedule", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYMENT_SCHEDULE.RETRIEVED_ALL, responseData, 200));
	});

	const getById = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const { fields } = req.query;

		paymentScheduleLogger.info(`Getting payment schedule by ID: ${id}`);

		const cacheKey = `cache:paymentSchedule:byId:${id}:${fields || "full"}`;
		const paymentSchedule = await getOrFetch(cacheKey, async () => {
			const query: Prisma.PaymentScheduleFindFirstArgs = { where: { id, workspaceId, isDeleted: false } };
			query.select = getNestedFields(fields as string);
			return repository.getById(query);
		});

		if (handleNotFound(paymentSchedule, res, "PaymentSchedule", paymentScheduleLogger, id)) return;

		paymentScheduleLogger.info(`Payment Schedule retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYMENT_SCHEDULE.RETRIEVED, paymentSchedule, 200));
	});

	const getByPurchaseOrderId = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { purchaseOrderId } = req.params;

		paymentScheduleLogger.info(`Getting payment schedule for PO: ${purchaseOrderId}`);

		const schedule = await repository.getByPurchaseOrderId(purchaseOrderId, workspaceId);

		if (handleNotFound(schedule, res, "PaymentSchedule", paymentScheduleLogger, purchaseOrderId)) return;

		paymentScheduleLogger.info(`Payment Schedule retrieved for PO: ${purchaseOrderId}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYMENT_SCHEDULE.RETRIEVED, schedule, 200));
	});

	const releasePayment = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const {
			itemIndex, amount, paymentMethod, payeeName,
			checkDetails, cashDetails, bankTransferDetails, onlineDetails,
			documentUrls,
		} = req.body;

		paymentScheduleLogger.info(`Releasing payment for schedule ${id}, item ${itemIndex}, amount ${amount}`);

		try {
			const result = await service.releasePayment({
				scheduleId: id,
				workspaceId,
				itemIndex,
				amount,
				paymentMethod,
				payeeName,
				checkDetails,
				cashDetails,
				bankTransferDetails,
				onlineDetails,
				documentUrls,
				userId: req.userId,
			});

			await invalidateEntityCache("paymentSchedule", paymentScheduleLogger, id);
			await invalidateEntityCache("transaction", paymentScheduleLogger);
			await invalidateEntityCache("purchaseOrder", paymentScheduleLogger);

			res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYMENT_SCHEDULE.PAYMENT_RELEASED, result, 200));
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Failed to release payment";
			paymentScheduleLogger.error(`Release payment failed for schedule ${id}:`, error);
			res.status(400).json(buildErrorResponse(msg, 400));
		}
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		paymentScheduleLogger.info(`Deleting payment schedule: ${id}`);

		const existingSchedule = await repository.remove(id, workspaceId);

		if (handleNotFound(existingSchedule, res, "PaymentSchedule", paymentScheduleLogger, id)) return;

		paymentScheduleLogger.info(`Payment Schedule deleted: ${id}`);

		logDelete(req, "PaymentSchedule", { ...existingSchedule!, name: `Schedule-${existingSchedule!.purchaseOrderId}` });
		await invalidateEntityCache("paymentSchedule", paymentScheduleLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.PAYMENT_SCHEDULE.DELETED, {}, 200));
	});

	return { getAll, getById, getByPurchaseOrderId, releasePayment, remove };
};
