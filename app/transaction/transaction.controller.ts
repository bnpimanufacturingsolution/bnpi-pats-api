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
import { buildErrorResponse, assertFound } from "../../helper/error-handler";
import { invalidateEntityCache, getOrFetch } from "../../helper/cache-helper";
import { logCreate, logUpdate, logDelete, logGetAll } from "../../helper/logging-helper";
import { config } from "../../config/constant";

import { transactionRepository } from "./transaction.repository";
import { uploadFiles } from "../../helper/cloudinary.helper";
import asyncHandler from "../../middleware/asyncHandler";
import { createTransactionService } from "./transaction.service";
import { AuthRequest } from "../../middleware/verifyToken";

const transactionLogger = createLogger("transaction");

export const controller = (prisma: PrismaClient) => {
	const repository = transactionRepository(prisma);
	const transactionService = createTransactionService(prisma);

	const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		let validatedData = { ...req.body, workspaceId };
		const files = req.files as Express.Multer.File[];

		// Handle additional transformations for file uploads and complex fields
		const contentType = req.get("Content-Type") || "";
		if (
			contentType.includes("application/x-www-form-urlencoded") ||
			contentType.includes("multipart/form-data")
		) {
			// Convert string values to proper types for FormData
			if (validatedData.amount) validatedData.amount = parseFloat(validatedData.amount);

			// Remove documentUrls from body if files are being uploaded
			if (files && files.length > 0) {
				delete validatedData.documentUrls;
			}

			// Remove empty string values and convert to null
			Object.keys(validatedData).forEach((key) => {
				if (validatedData[key] === "" || validatedData[key] === "null") {
					validatedData[key] = null;
				}
			});
		}

		// Upload documents to Cloudinary if files are present
		let documentUrls: string[] = [];
		if (files && files.length > 0) {
			const uploadResults = await uploadFiles(files, "transactions/documents");
			documentUrls = uploadResults.map((result) => result.url);
			transactionLogger.info(`Uploaded ${documentUrls.length} documents for transaction`);
		}

		// Extract idempotency key from header (standard pattern)
		const idempotencyKey = req.get("Idempotency-Key") || req.get("X-Idempotency-Key");

		// Create transaction using service layer
		try {
			const userId = req.userId;
			const { transaction } = await transactionService.createTransaction({
				...validatedData,
				documentUrls,
				idempotencyKey,
				userId,
				transactionDate: validatedData.transactionDate
					? new Date(validatedData.transactionDate)
					: new Date(),
			});

			transactionLogger.info(`Transaction created successfully: ${transaction.id}`);

			// Sync item financials
			await transactionService.syncFinancialsForNewTransaction(transaction);

			logCreate(req, "Transaction", { ...transaction, name: transaction.transactionNumber });
			await invalidateEntityCache("transaction", transactionLogger);

			res.status(201).json(
				buildSuccessResponse(config.SUCCESS.TRANSACTION.CREATED, { transaction }, 201),
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			transactionLogger.error("Transaction creation failed:", error);

			res.status(400).json(buildErrorResponse(errorMessage, 400));
			return;
		}
	});

	const getAll = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const validationResult = validateQueryParams(req, transactionLogger);

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

		transactionLogger.info(
			`Getting transactions, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}, groupBy: ${groupBy}`,
		);

		// Base where clause
		const whereClause: Prisma.TransactionWhereInput = {
			isDeleted: false,
			workspaceId,
		};

		// Search fields
		const searchFields = [
			"transactionNumber",
			"payeeName",
			"checkDetails.checkNumber",
			"checkDetails.bankName",
			"bankTransferDetails.referenceNumber",
			"bankTransferDetails.bankName",
			"onlineDetails.referenceNumber",
		];
		if (query) {
			const searchConditions = buildSearchConditions("Transaction", query, searchFields);
			if (searchConditions.length > 0) {
				whereClause.OR = searchConditions;
			}
		}

		if (filter) {
			const filterConditions = buildFilterConditions("Transaction", filter);
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
			"Transaction",
		);

		const [transactions, total] = await repository.getAll(findManyQuery, whereClause, {
			document,
			count,
		});

		transactionLogger.info(`Retrieved ${transactions.length} transactions`);
		const processedData =
			groupBy && document ? groupDataByField(transactions, groupBy as string) : transactions;

		const responseData: Record<string, unknown> = {
			...(document && { transactions: processedData }),
			...(count && { count: total }),
			...(pagination && { pagination: buildPagination(total, page, limit) }),
			...(groupBy && { groupedBy: groupBy }),
		};

		logGetAll(req, "Transaction", total);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.TRANSACTION.RETRIEVED_ALL, responseData, 200));
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

		transactionLogger.info(`Getting transaction by ID: ${id}`);

		const cacheKey = `cache:transaction:byId:${id}:${fields || "full"}`;
		const transaction = await getOrFetch(cacheKey, async () => {
			const query: Prisma.TransactionFindFirstArgs = {
				where: { id, workspaceId },
			};

			// If no fields specified, include all relations
			if (!fields) {
				query.include = {
					project: {
						select: {
							id: true,
							name: true,
						},
					},
					item: {
						select: {
							id: true,
							itemName: true,
						},
					},
					purchaseOrder: {
						select: {
							id: true,
							poNumber: true,
						},
					},
				};
			} else {
				query.select = getNestedFields(fields, "Transaction");
			}

			return repository.getById(query);
		});

		assertFound(transaction, "Transaction", transactionLogger, id);

		transactionLogger.info(`Transaction retrieved: ${id}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.TRANSACTION.RETRIEVED, transaction, 200));
	});

	const update = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		const files = req.files as Express.Multer.File[];
		let validatedData = req.body;
		const contentType = req.get("Content-Type") || "";

		if (!id) {
			throw new Error(config.ERROR.QUERY_PARAMS.MISSING_ID);
		}

		// Handle additional transformations for file uploads and complex fields
		if (
			contentType.includes("application/x-www-form-urlencoded") ||
			contentType.includes("multipart/form-data")
		) {
			// Convert string values to proper types for FormData
			if (validatedData.amount) validatedData.amount = parseFloat(validatedData.amount);

			// Remove documentUrls from body if files are being uploaded
			if (files && files.length > 0) {
				delete validatedData.documentUrls;
			}

			// Remove empty string values and convert to null
			Object.keys(validatedData).forEach((key) => {
				if (validatedData[key] === "" || validatedData[key] === "null") {
					validatedData[key] = null;
				}
			});
		}

		if (Object.keys(req.body).length === 0 && (!files || files.length === 0)) {
			throw new Error(config.ERROR.COMMON.NO_UPDATE_FIELDS);
		}

		// Upload new documents to Cloudinary if files are present
		if (files && files.length > 0) {
			const uploadResults = await uploadFiles(files, "transactions/documents");
			const newDocumentUrls = uploadResults.map((result) => result.url);
			transactionLogger.info(
				`Uploaded ${newDocumentUrls.length} documents for transaction ${id}`,
			);

			// Get existing transaction to merge document URLs
			const existingTransaction = await repository.getById({ where: { id } });
			if (existingTransaction) {
				const existingUrls = existingTransaction.documentUrls || [];
				validatedData = {
					...validatedData,
					documentUrls: [...existingUrls, ...newDocumentUrls],
				};
			} else {
				validatedData = {
					...validatedData,
					documentUrls: newDocumentUrls,
				};
			}
		}

		transactionLogger.info(`Updating transaction: ${id}`);

		const { existingTransaction, updatedTransaction } = await repository.update(
			id,
			validatedData,
			workspaceId,
		);

		assertFound(existingTransaction, "Transaction", transactionLogger, id);

		// Sync item financials
		await transactionService.syncFinancialsForModifiedTransaction(existingTransaction!, updatedTransaction!);

		transactionLogger.info(`Transaction updated: ${id}`);

		logUpdate(req, "Transaction", id, existingTransaction!, { ...updatedTransaction!, name: updatedTransaction!.transactionNumber });
		await invalidateEntityCache("transaction", transactionLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.TRANSACTION.UPDATED, { transaction: updatedTransaction }, 200));
	});

	const remove = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const workspaceId = req.workspaceId!;
		const { id } = req.params;
		transactionLogger.info(`Deleting transaction: ${id}`);

		const existingTransaction = await repository.remove(id, workspaceId);

		assertFound(existingTransaction, "Transaction", transactionLogger, id);

		// Sync item financials
		await transactionService.syncFinancialsForModifiedTransaction(existingTransaction!, null);

		transactionLogger.info(`Transaction deleted: ${id}`);

		logDelete(req, "Transaction", { ...existingTransaction!, name: existingTransaction!.transactionNumber });
		await invalidateEntityCache("transaction", transactionLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.TRANSACTION.DELETED, {}, 200));
	});

	const getMetric = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { projectId } = req.query;

		if (!projectId || typeof projectId !== "string") {
			throw new Error("projectId query parameter is required");
		}

		transactionLogger.info(`Getting transaction metrics for project: ${projectId}`);

		const metrics = await repository.getMetric(projectId);

		transactionLogger.info(`Transaction metrics retrieved for project: ${projectId}`);
		res.status(200).json(buildSuccessResponse(config.SUCCESS.TRANSACTION.METRICS, { metrics }, 200));
	});

	const getRunningBalance = asyncHandler(
		async (req: AuthRequest, res: Response, _next: NextFunction) => {
			const workspaceId = req.workspaceId!;
			const validationResult = validateQueryParams(req, transactionLogger);

			if (!validationResult.isValid) {
				res.status(400).json(validationResult.errorResponse);
				return;
			}

			const { page, limit, order, fields, sort, skip, query, filter } =
				validationResult.validatedParams!;

			transactionLogger.info(
				`Getting transactions with running balance, page: ${page}, limit: ${limit}, query: ${query}, order: ${order}`,
			);

			// Base where clause
			const whereClause: Prisma.TransactionWhereInput = {
				isDeleted: false,
				workspaceId,
			};

			// Search fields
			const searchFields = [
				"transactionNumber",
				"payeeName",
				"checkDetails.checkNumber",
				"checkDetails.bankName",
				"bankTransferDetails.referenceNumber",
				"bankTransferDetails.bankName",
				"onlineDetails.referenceNumber",
			];
			if (query) {
				const searchConditions = buildSearchConditions("Transaction", query, searchFields);
				if (searchConditions.length > 0) {
					whereClause.OR = searchConditions;
				}
			}

			if (filter) {
				const filterConditions = buildFilterConditions("Transaction", filter);
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
				"Transaction",
			);

			const transactionsWithBalance = await repository.getRunningBalance(findManyQuery);

			transactionLogger.info(`Retrieved ${transactionsWithBalance.length} transactions with running balance`);

			res.status(200).json(buildSuccessResponse(
				"Transactions with running balance retrieved successfully",
				{ transactions: transactionsWithBalance },
				200,
			));
		},
	);

	const setCleared = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
		const { id } = req.params;
		const { clearedDate } = req.body;

		const date = clearedDate ? new Date(clearedDate) : new Date();
		transactionLogger.info(`Setting transaction ${id} as cleared on ${date.toISOString()}`);

		const updatedTransaction = await repository.setCleared(id, date);

		assertFound(updatedTransaction, "Transaction", transactionLogger, id);

		await invalidateEntityCache("transaction", transactionLogger, id);

		res.status(200).json(buildSuccessResponse(config.SUCCESS.TRANSACTION.CLEARED, updatedTransaction, 200));
	});

	return {
		create,
		getAll,
		getById,
		update,
		remove,
		getMetric,
		getRunningBalance,
		setCleared,
	};
};
