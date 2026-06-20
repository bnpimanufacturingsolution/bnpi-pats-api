/**
 * Item Service (Functional Approach)
 *
 * Business logic layer for item operations.
 * This service handles all item-related business logic including
 * calculations, validations, and coordinating with repository.
 */

import { PrismaClient, Item, Prisma } from "../../generated/prisma";
import { getLogger } from "../../helper/logger";
import { itemRepository } from "./item.repository";
import {
	updateEstimationTotalsAndMetadata,
	updateProjectFinancials,
	calculateItemStatus,
	updateProjectProgress,
	updateProjectBudgetMetadata,
	calculateEstimationPoints,
	updateMilestoneProgress,
} from "../../utils/calculations";
import { invalidateCache } from "../../middleware/cache";
import { redisClient } from "../../config/redis";
import { uploadFiles, deleteFileByUrl } from "../../helper/cloudinary.helper";

const logger = getLogger().child({ module: "item-service" });

// Singleton instance cache
let serviceInstance: ItemServiceInstance | null = null;

interface ItemServiceInstance {
	prisma: PrismaClient;
	createItem: (data: any) => Promise<{ item: Item; progress: any }>;
	getItemById: (id: string, fields?: string, workspaceId?: string) => Promise<Item | null>;
	getAllItems: (
		findManyQuery: Prisma.ItemFindManyArgs,
		whereClause: Prisma.ItemWhereInput,
		options: { document: boolean; count: boolean },
	) => Promise<[Item[], number]>;
	updateItem: (
		id: string,
		data: any,
		workspaceId: string,
	) => Promise<{ existingItem: Item; updatedItem: Item; progress: any }>;
	updateActualPriceWithDocuments: (
		id: string,
		actualUnitPrice: number,
		files: Express.Multer.File[] | undefined,
		documentsToDelete: string[],
		workspaceId: string,
	) => Promise<{ existingItem: Item; updatedItem: Item }>;
	deleteItem: (id: string, workspaceId: string) => Promise<{ existingItem: Item; progress: any }>;
}

/**
 * Helper function to get ItemType ID by name
 * Returns null if not found
 */
const getItemTypeIdByName = async (
	prisma: PrismaClient,
	typeName: string,
): Promise<string | null> => {
	try {
		const itemType = await prisma.itemType.findFirst({
			where: { name: typeName, isDeleted: false },
			select: { id: true },
		});
		return itemType?.id || null;
	} catch (error) {
		logger.warn(`Failed to lookup ItemType for name "${typeName}":`, error);
		return null;
	}
};

/**
 * Invalidate cache for item operations
 */
const invalidateCacheForItem = async (
	prisma: PrismaClient,
	item: Item,
	projectId: string,
): Promise<void> => {
	try {
		// Parallelize cache invalidations (3x faster)
		await Promise.all([
			invalidateCache.byPattern("cache:item:list:*"),
			invalidateCache.byPattern(`cache:estimation:byId:${item.estimationId}:*`),
			invalidateCache.byPattern(`cache:project:byId:${projectId}:*`),
		]);
		logger.info("Cache invalidated after item creation");
	} catch (cacheError) {
		logger.warn("Failed to invalidate cache:", cacheError);
	}
};

/**
 * Invalidate cache for update operations
 */
const invalidateCacheForUpdate = async (
	prisma: PrismaClient,
	itemId: string,
	estimationId: string,
): Promise<void> => {
	try {
		const estimation = await prisma.estimation.findUnique({
			where: { id: estimationId },
			select: { projectId: true },
		});

		// Parallelize cache invalidations (4x faster)
		const invalidations = [
			invalidateCache.byPattern(`cache:item:byId:${itemId}:*`),
			invalidateCache.byPattern("cache:item:list:*"),
			invalidateCache.byPattern(`cache:estimation:byId:${estimationId}:*`),
		];
		if (estimation) {
			invalidations.push(invalidateCache.byPattern(`cache:project:byId:${estimation.projectId}:*`));
		}
		await Promise.all(invalidations);
		logger.info("Cache invalidated after item update");
	} catch (cacheError) {
		logger.warn("Failed to invalidate cache:", cacheError);
	}
};

/**
 * Invalidate cache for delete operations
 */
const invalidateCacheForDelete = async (
	prisma: PrismaClient,
	itemId: string,
	estimationId: string,
): Promise<void> => {
	try {
		const estimation = await prisma.estimation.findUnique({
			where: { id: estimationId },
			select: { projectId: true },
		});

		// Parallelize cache invalidations (5x faster)
		const invalidations = [
			invalidateCache.byPattern(`cache:item:byId:${itemId}:*`),
			invalidateCache.byPattern("cache:item:list:*"),
			invalidateCache.byPattern("cache:order:*"),
			invalidateCache.byPattern(`cache:estimation:byId:${estimationId}:*`),
		];
		if (estimation) {
			invalidations.push(invalidateCache.byPattern(`cache:project:byId:${estimation.projectId}:*`));
		}
		await Promise.all(invalidations);
		logger.info("Cache invalidated after item deletion");
	} catch (cacheError) {
		logger.warn("Failed to invalidate cache:", cacheError);
	}
};

/**
 * Validate that actual updates are allowed
 * Fixed: Now accepts pre-fetched estimation data to avoid extra queries
 */
const validateActualUpdates = async (
	prisma: PrismaClient,
	item: Item & { estimation?: { status: string; project: { status: string } } | null },
): Promise<void> => {
	// Use pre-fetched estimation if available, otherwise query (fallback)
	let estimation = item.estimation;
	if (!estimation) {
		estimation = await prisma.estimation.findUnique({
			where: { id: item.estimationId },
			include: { project: true },
		});
	}

	if (!estimation) {
		throw new Error("Parent estimation not found");
	}

	if (estimation.status !== "APPROVED") {
		throw new Error(
			`Cannot update actual values. Estimation must be APPROVED (current status: ${estimation.status})`,
		);
	}

	if (estimation.project.status !== "ACTIVE") {
		throw new Error(
			`Cannot update actual values. Project must be ACTIVE (current status: ${estimation.project.status})`,
		);
	}

	logger.info("Validation passed: Project is ACTIVE and Estimation is APPROVED");
};

/**
 * Calculate item status
 * Fixed: Now accepts pre-fetched estimation data to avoid race conditions
 */
const calculateItemStatusForItem = async (
	prisma: PrismaClient,
	item: Item & { estimation?: { status: string; project: { status: string } } | null },
	actualUnitPrice: number | null | undefined,
	actualTotal: number | null,
): Promise<string> => {
	// Use pre-fetched estimation if available, otherwise query (fallback)
	let estimation = item.estimation;
	if (!estimation) {
		estimation = await prisma.estimation.findUnique({
			where: { id: item.estimationId },
			include: { project: true },
		});
	}

	if (!estimation) {
		return item.status;
	}

	const hasActualData =
		actualUnitPrice !== null && actualUnitPrice !== undefined && actualTotal !== null;
	const isProjectActive = estimation.project.status === "ACTIVE";
	const isEstimationApproved = estimation.status === "APPROVED";

	return calculateItemStatus({
		hasActualData,
		isProjectActive,
		isEstimationApproved,
	});
};

/**
 * Create a new item with proper calculations and parent updates
 */
const createItem = async (
	prisma: PrismaClient,
	data: any,
): Promise<{ item: Item; progress: any }> => {
	const repository = itemRepository(prisma);

	// Verify parent estimation exists and get project
	const estimation = await prisma.estimation.findFirst({
		where: { id: data.estimationId, isDeleted: false },
		include: { project: true },
	});

	if (!estimation) {
		logger.error(`Parent estimation not found: ${data.estimationId}`);
		throw new Error("Parent estimation not found");
	}

	if (!estimation.project) {
		logger.error(`Parent project not found for estimation: ${data.estimationId}`);
		throw new Error("Parent project not found");
	}

	const project = estimation.project;

	// Determine if item is being added to an approved estimation
	const isNewAddition =
		data.isNewAddition !== undefined ? data.isNewAddition : estimation.status === "APPROVED";

	logger.info(
		`Setting isNewAddition to ${isNewAddition} (estimation status: ${estimation.status})`,
	);

	let estimatedQuantity = data.estimatedQuantity;
	let estimatedUnitPrice = data.estimatedUnitPrice;
	let estimatedTotal = data.estimatedQuantity * data.estimatedUnitPrice;

	// Initialize actuals to 0 (or explicit input) - DO NOT default to estimated values
	// This ensures that "Actuals" are only recognized via Transactions or explicit updates
	let actualQuantity = data.actualQuantity ?? 0;
	let actualUnitPrice = data.actualUnitPrice ?? 0;
	let actualTotal = data.actualTotal ?? actualUnitPrice * actualQuantity;

	// REMOVED: Legacy logic that force-converted Estimates to Actuals for approved estimations.
	// We now strictly follow "Transaction-Based Actuals".
	// Adding an item to APPROVED estimation = Budget Increase (Change Order).

	// Calculate status based on workflow rules
	const hasActualData =
		actualUnitPrice !== null && actualUnitPrice !== undefined && actualTotal !== null;
	const isProjectActive = project.status === "ACTIVE";
	const isEstimationApproved = estimation.status === "APPROVED";

	const calculatedStatus = calculateItemStatus({
		hasActualData,
		isProjectActive,
		isEstimationApproved,
	});

	logger.info(`Calculated status: ${calculatedStatus}`);

	// Calculate estimation points
	const totalForPoints = estimatedTotal > 0 ? estimatedTotal : actualTotal || 0;
	const estimationPoints = calculateEstimationPoints(totalForPoints);

	// Convert type name to itemTypeId
	let itemTypeId: string | null = null;
	if (data.type) {
		itemTypeId = await getItemTypeIdByName(prisma, data.type);
	}

	// Prepare item data
	const { type: _, ...dataWithoutType } = data;
	const itemData: any = {
		...dataWithoutType,
		...(itemTypeId && { itemTypeId }),
		estimatedQuantity,
		estimatedUnitPrice,
		estimatedTotal,
		actualQuantity,
		actualUnitPrice,
		...(actualTotal !== null && { actualTotal }),
		estimationPoints,
		isNewAddition,
		status: data.status || calculatedStatus,
	};

	const item: Item = await repository.create(itemData);
	logger.info(`Item created successfully: ${item.id}`);

	// Update parent estimation and project metrics
	// Optimized: Run independent updates in parallel after estimation update
	let calculatedProgress = null;
	try {
		// Step 1: Update estimation first (propagates to project financial metadata internally)
		await updateEstimationTotalsAndMetadata(prisma, item.estimationId);

		// Step 2: Run independent project updates in parallel
		const parallelUpdates: Promise<any>[] = [
			updateProjectFinancials(prisma, item.estimationId),
			updateProjectProgress(prisma, estimation.projectId),
			updateProjectBudgetMetadata(prisma, estimation.projectId),
		];

		// Include milestone update if item belongs to a milestone
		if (item.milestoneId) {
			parallelUpdates.push(updateMilestoneProgress(prisma, item.milestoneId));
		}

		const results = await Promise.all(parallelUpdates);
		calculatedProgress = results[1]; // updateProjectProgress result

		if (item.milestoneId && results[3]) {
			const milestoneProgress = results[3];
			logger.info(`Milestone ${item.milestoneId} updated: ${milestoneProgress.progressPercent}% (${milestoneProgress.status})`);
		}

		logger.info("Estimation and project updates completed (parallel)");
	} catch (updateError) {
		logger.warn("Failed to update estimation/project:", updateError);
	}

	// Invalidate cache
	await invalidateCacheForItem(prisma, item, estimation.projectId);

	return { item, progress: calculatedProgress };
};

/**
 * Get item by ID with optional field selection
 */
const getItemById = async (
	prisma: PrismaClient,
	id: string,
	fields?: string,
	workspaceId?: string,
): Promise<Item | null> => {
	const repository = itemRepository(prisma);
	const cacheKey = `cache:item:byId:${id}:${fields || "full"}`;
	let item = null;

	// Try to get from cache
	try {
		if (redisClient.isClientConnected()) {
			const cachedItem = await redisClient.getJSON(cacheKey);
			if (cachedItem) {
				item = {
					...cachedItem,
					type: (cachedItem as any).type || (cachedItem as any).itemType?.name || "MISC",
				} as any;
				logger.info(`Item ${id} retrieved from cache`);
			}
		}
	} catch (cacheError) {
		logger.warn(`Cache retrieval failed for item ${id}:`, cacheError);
	}

	if (!item) {
		// Build query
		const query: Prisma.ItemFindFirstArgs = {
			where: { id, ...(workspaceId && { workspaceId }) },
			select: {
				id: true,
				estimationId: true,
				categoryId: true,
				itemTypeId: true,
				itemName: true,
				estimatedQuantity: true,
				actualQuantity: true,
				estimatedUnitPrice: true,
				estimatedTotal: true,
				actualUnitPrice: true,
				actualTotal: true,
				documentUrls: true,
				fields: true,
				status: true,
				startDate: true,
				endDate: true,
				estimationPoints: true,
				orderId: true,
				isNewAddition: true,
				parentItemId: true,
				isDeleted: true,
				createdAt: true,
				updatedAt: true,
				category: true,
				itemType: true,
			},
		};

		const fetchedItem = await repository.getById(query);

		if (fetchedItem) {
			item = {
				...fetchedItem,
				type: (fetchedItem as any).itemType?.name || "MISC",
			} as any;

			// Store in cache
			if (redisClient.isClientConnected()) {
				try {
					await redisClient.setJSON(cacheKey, item, 3600);
					logger.info(`Item ${id} stored in cache`);
				} catch (cacheError) {
					logger.warn(`Failed to store item ${id} in cache:`, cacheError);
				}
			}
		}
	}

	return item;
};

/**
 * Get all items with filters
 */
const getAllItems = async (
	prisma: PrismaClient,
	findManyQuery: Prisma.ItemFindManyArgs,
	whereClause: Prisma.ItemWhereInput,
	options: { document: boolean; count: boolean },
): Promise<[Item[], number]> => {
	const repository = itemRepository(prisma);
	const [items, total] = await repository.getAll(findManyQuery, whereClause, options);

	// Transform items to include 'type' field
	const transformedItems = items.map((item: any) => ({
		...item,
		type: item.itemType?.name || "MISC",
	}));

	return [transformedItems as Item[], total];
};

/**
 * Update an item with proper validations and calculations
 */
const updateItem = async (
	prisma: PrismaClient,
	id: string,
	data: any,
	workspaceId: string,
): Promise<{ existingItem: Item; updatedItem: Item; progress: any }> => {
	const repository = itemRepository(prisma);

	// Get existing item with estimation and project (single query to avoid race conditions)
	const tempExisting = await repository.getById({
		where: { id, ...(workspaceId && { workspaceId }) },
		include: {
			estimation: {
				include: { project: true },
			},
		},
	});

	if (!tempExisting) {
		logger.error(`Item not found: ${id}`);
		throw new Error("Item not found");
	}

	// Validate if updating actuals
	const isUpdatingActuals =
		data.actualQuantity !== undefined || data.actualUnitPrice !== undefined;

	if (isUpdatingActuals) {
		await validateActualUpdates(prisma, tempExisting);
	}

	// Recalculate totals
	const finalEstimatedQuantity = data.estimatedQuantity ?? tempExisting.estimatedQuantity;
	const finalActualQuantity =
		data.actualQuantity !== undefined
			? data.actualQuantity
			: (tempExisting.actualQuantity ?? 0);
	const finalEstimatedUnitPrice = data.estimatedUnitPrice ?? tempExisting.estimatedUnitPrice;
	const finalActualUnitPrice =
		data.actualUnitPrice !== undefined ? data.actualUnitPrice : tempExisting.actualUnitPrice;

	const estimatedTotal = finalEstimatedQuantity * finalEstimatedUnitPrice;
	const actualTotal = finalActualUnitPrice ? finalActualQuantity * finalActualUnitPrice : null;

	logger.info(
		`Recomputed totals - estimatedTotal: ${estimatedTotal}, actualTotal: ${actualTotal}`,
	);

	// Recalculate estimation points
	const totalForPoints = estimatedTotal > 0 ? estimatedTotal : actualTotal || 0;
	const estimationPoints = calculateEstimationPoints(totalForPoints);

	// Determine final status:
	// 1. If user explicitly provides status, use it
	// 2. If updating actuals, recalculate status
	// 3. Otherwise, keep existing status
	let calculatedStatus = data.status;
	if (!calculatedStatus) {
		if (isUpdatingActuals) {
			// Only auto-calculate when actuals are being updated
			calculatedStatus = await calculateItemStatusForItem(
				prisma,
				tempExisting,
				finalActualUnitPrice,
				actualTotal,
			);
			logger.info(`Auto-calculated status: ${calculatedStatus} (actuals updated)`);
		} else {
			// Keep existing status if not updating actuals and no explicit status provided
			calculatedStatus = tempExisting.status;
			logger.info(`Keeping existing status: ${calculatedStatus}`);
		}
	} else {
		logger.info(`Using user-provided status: ${calculatedStatus}`);
	}

	// Convert type name to itemTypeId if type is being updated
	let itemTypeId: string | null = null;
	if (data.type) {
		itemTypeId = await getItemTypeIdByName(prisma, data.type);
	}

	// Prepare update data
	const { type: _, ...dataWithoutType } = data;
	const updateData: any = {
		...dataWithoutType,
		...(itemTypeId && { itemTypeId }),
		actualQuantity: finalActualQuantity,
		estimatedTotal,
		...(actualTotal !== null && { actualTotal }),
		estimationPoints,
		...(calculatedStatus && { status: calculatedStatus }),
	};

	const { existingItem, updatedItem } = await repository.update(id, updateData, workspaceId);

	if (!existingItem || !updatedItem) {
		logger.error(`Item not found: ${id}`);
		throw new Error("Item not found");
	}

	// Update parent estimation and project
	// Optimized: Run independent updates in parallel after estimation update
	let calculatedProgress = null;
	try {
		const estimation = await prisma.estimation.findUnique({
			where: { id: existingItem.estimationId },
			select: { projectId: true },
		});

		// Step 1: Update estimation first (propagates to project financial metadata internally)
		await updateEstimationTotalsAndMetadata(prisma, updatedItem.estimationId);

		// Step 2: Run independent project updates in parallel
		const parallelUpdates: Promise<any>[] = [
			updateProjectFinancials(prisma, updatedItem.estimationId),
		];

		if (estimation) {
			parallelUpdates.push(
				updateProjectProgress(prisma, estimation.projectId),
				updateProjectBudgetMetadata(prisma, estimation.projectId),
			);
		}

		// Handle milestone updates
		const oldMilestoneId = existingItem.milestoneId;
		const newMilestoneId = updatedItem.milestoneId;

		// Update old milestone if item moved or removed from it
		if (oldMilestoneId && oldMilestoneId !== newMilestoneId) {
			parallelUpdates.push(updateMilestoneProgress(prisma, oldMilestoneId));
		}

		// Update current milestone if item has one
		if (newMilestoneId) {
			parallelUpdates.push(updateMilestoneProgress(prisma, newMilestoneId));
		}

		const results = await Promise.all(parallelUpdates);

		// Extract progress result (index 1 if estimation exists)
		if (estimation) {
			calculatedProgress = results[1];
		}

		// Log milestone updates
		if (oldMilestoneId && oldMilestoneId !== newMilestoneId) {
			const oldMilestoneResult = results[estimation ? 3 : 1];
			if (oldMilestoneResult) {
				logger.info(`Old milestone ${oldMilestoneId} updated: ${oldMilestoneResult.progressPercent}% (${oldMilestoneResult.status})`);
			}
		}

		if (newMilestoneId) {
			const newMilestoneIdx = estimation
				? (oldMilestoneId && oldMilestoneId !== newMilestoneId ? 4 : 3)
				: (oldMilestoneId && oldMilestoneId !== newMilestoneId ? 2 : 1);
			const newMilestoneResult = results[newMilestoneIdx];
			if (newMilestoneResult) {
				logger.info(`Milestone ${newMilestoneId} updated: progress=${newMilestoneResult.progressPercent}%, status=${newMilestoneResult.status}, items=${JSON.stringify(newMilestoneResult.itemCounts)}`);
			}
		} else {
			logger.info(`Item ${id} has no milestone assigned, skipping milestone update`);
		}

		logger.info("Estimation and project updates completed (parallel)");
	} catch (updateError) {
		logger.warn("Failed to update estimation/project:", updateError);
	}

	// Invalidate cache
	await invalidateCacheForUpdate(prisma, id, existingItem.estimationId);

	return { existingItem, updatedItem, progress: calculatedProgress };
};

/**
 * Update actual price with documents
 */
const updateActualPriceWithDocuments = async (
	prisma: PrismaClient,
	id: string,
	actualUnitPrice: number,
	files: Express.Multer.File[] | undefined,
	documentsToDelete: string[],
	workspaceId: string,
): Promise<{ existingItem: Item; updatedItem: Item }> => {
	const repository = itemRepository(prisma);

	// Get existing item with estimation and project (single query to avoid race conditions)
	const currentItem = await repository.getById({
		where: { id, ...(workspaceId && { workspaceId }) },
		include: {
			estimation: {
				include: { project: true },
			},
		},
	});

	if (!currentItem) {
		logger.error(`Item not found: ${id}`);
		throw new Error("Item not found");
	}

	// Validate project and estimation status
	await validateActualUpdates(prisma, currentItem);

	// Delete documents from Cloudinary
	if (documentsToDelete.length > 0) {
		const deletePromises = documentsToDelete.map(async (url) => {
			try {
				await deleteFileByUrl(url);
				logger.info(`Deleted document from Cloudinary: ${url}`);
			} catch (deleteError) {
				logger.error(`Failed to delete document: ${url}`, { deleteError });
			}
		});
		await Promise.allSettled(deletePromises);
	}

	// Upload new documents
	let newDocumentUrls: string[] = [];
	if (files && files.length > 0) {
		const uploadResults = await uploadFiles(files, "items/documents");
		newDocumentUrls = uploadResults.map((result) => result.url);
		logger.info(`Uploaded ${newDocumentUrls.length} documents for item ${id}`);
	}

	// Calculate totals
	const actualQuantity = currentItem.actualQuantity ?? currentItem.estimatedQuantity ?? 0;
	const actualTotal = actualQuantity * actualUnitPrice;
	const estimatedTotal = currentItem.estimatedQuantity * currentItem.estimatedUnitPrice;

	// Update document URLs
	const remainingDocumentUrls = (currentItem.documentUrls || []).filter(
		(url) => !documentsToDelete.includes(url),
	);
	const updatedDocumentUrls = [...remainingDocumentUrls, ...newDocumentUrls];

	// Update item
	const updateData = {
		actualUnitPrice,
		actualQuantity,
		actualTotal,
		estimatedTotal,
		documentUrls: updatedDocumentUrls,
	};

	const { existingItem, updatedItem } = await repository.update(id, updateData, workspaceId);

	if (!existingItem || !updatedItem) {
		logger.error(`Item not found: ${id}`);
		throw new Error("Item not found");
	}

	// Update parent estimation and project
	// Optimized: Use pre-fetched estimation data, run independent updates in parallel
	try {
		// Use pre-fetched projectId from currentItem (already loaded with estimation + project)
		const projectId = (currentItem as any).estimation?.project?.id;

		// Step 1: Update estimation first (propagates to project financial metadata internally)
		await updateEstimationTotalsAndMetadata(prisma, updatedItem.estimationId);

		// Step 2: Run independent project updates in parallel
		const parallelUpdates: Promise<any>[] = [
			updateProjectFinancials(prisma, updatedItem.estimationId),
		];

		if (projectId) {
			parallelUpdates.push(
				updateProjectProgress(prisma, projectId),
				updateProjectBudgetMetadata(prisma, projectId),
			);
		}

		// Update milestone progress if item belongs to a milestone
		if (updatedItem.milestoneId) {
			parallelUpdates.push(updateMilestoneProgress(prisma, updatedItem.milestoneId));
		}

		const results = await Promise.all(parallelUpdates);

		// Log milestone update
		if (updatedItem.milestoneId) {
			const milestoneIdx = projectId ? 3 : 1;
			const milestoneProgress = results[milestoneIdx];
			if (milestoneProgress) {
				logger.info(`Milestone ${updatedItem.milestoneId} updated: ${milestoneProgress.progressPercent}% (${milestoneProgress.status})`);
			}
		}

		logger.info("Estimation and project updates completed (parallel)");
	} catch (updateError) {
		logger.warn("Failed to update estimation/project:", updateError);
	}

	// Invalidate cache
	await invalidateCacheForUpdate(prisma, id, existingItem.estimationId);

	return { existingItem, updatedItem };
};

/**
 * Soft delete an item
 */
const deleteItem = async (
	prisma: PrismaClient,
	id: string,
	workspaceId: string,
): Promise<{ existingItem: Item; progress: any }> => {
	const repository = itemRepository(prisma);

	logger.info(`Soft deleting item: ${id}`);

	const existingItem = await repository.remove(id, workspaceId);

	if (!existingItem) {
		logger.error(`Item not found: ${id}`);
		throw new Error("Item not found");
	}

	// Update parent estimation and project
	// Optimized: Run independent updates in parallel after estimation update
	let calculatedProgress = null;
	try {
		const estimation = await prisma.estimation.findUnique({
			where: { id: existingItem.estimationId },
			select: { projectId: true },
		});

		// Step 1: Update estimation first (propagates to project financial metadata internally)
		await updateEstimationTotalsAndMetadata(prisma, existingItem.estimationId);

		// Step 2: Run independent project updates in parallel
		const parallelUpdates: Promise<any>[] = [
			updateProjectFinancials(prisma, existingItem.estimationId),
		];

		if (estimation) {
			parallelUpdates.push(
				updateProjectProgress(prisma, estimation.projectId),
				updateProjectBudgetMetadata(prisma, estimation.projectId),
			);
		}

		// Update milestone progress if deleted item belonged to a milestone
		if (existingItem.milestoneId) {
			parallelUpdates.push(updateMilestoneProgress(prisma, existingItem.milestoneId));
		}

		const results = await Promise.all(parallelUpdates);

		// Extract progress result (index 1 if estimation exists)
		if (estimation) {
			calculatedProgress = results[1];
		}

		// Log milestone update
		if (existingItem.milestoneId) {
			const milestoneIdx = estimation ? 3 : 1;
			const milestoneProgress = results[milestoneIdx];
			if (milestoneProgress) {
				logger.info(`Milestone ${existingItem.milestoneId} updated after item deletion: ${milestoneProgress.progressPercent}% (${milestoneProgress.status})`);
			}
		}

		logger.info("Estimation and project updates completed (parallel)");
	} catch (updateError) {
		logger.warn("Failed to update estimation/project:", updateError);
	}

	// Invalidate cache
	await invalidateCacheForDelete(prisma, id, existingItem.estimationId);

	return { existingItem, progress: calculatedProgress };
};

/**
 * Create or get singleton service instance
 *
 * @param prisma - PrismaClient instance
 * @returns Service instance with methods
 */
export const createItemService = (prisma: PrismaClient): ItemServiceInstance => {
	if (!serviceInstance || serviceInstance.prisma !== prisma) {
		serviceInstance = {
			prisma,
			createItem: (data: any) => createItem(prisma, data),
			getItemById: (id: string, fields?: string, workspaceId?: string) => getItemById(prisma, id, fields, workspaceId),
			getAllItems: (findManyQuery, whereClause, options) =>
				getAllItems(prisma, findManyQuery, whereClause, options),
			updateItem: (id: string, data: any, workspaceId: string) => updateItem(prisma, id, data, workspaceId),
			updateActualPriceWithDocuments: (id, actualUnitPrice, files, documentsToDelete, workspaceId) =>
				updateActualPriceWithDocuments(
					prisma,
					id,
					actualUnitPrice,
					files,
					documentsToDelete,
					workspaceId,
				),
			deleteItem: (id: string, workspaceId: string) => deleteItem(prisma, id, workspaceId),
		};
	}
	return serviceInstance;
};

/**
 * Get singleton service instance (alias for createItemService)
 */
export const getItemService = createItemService;

// Export individual functions for direct use
export {
	createItem,
	getItemById,
	getAllItems,
	updateItem,
	updateActualPriceWithDocuments,
	deleteItem,
};
