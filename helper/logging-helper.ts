/**
 * Logging Helper
 * Simplified activity and audit logging for CRUD operations
 */

import { Request } from "express";
import { logActivity } from "../utils/activityLogger";
import { logAudit } from "../utils/auditLogger";
import { config } from "../config/constant";
import { AuthenticatedRequest } from "../app/types";

type CrudAction = "CREATE" | "UPDATE" | "DELETE" | "GET" | "GET_ALL" | "EXPORT";
type AuditSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface EntityLogOptions {
	req: Request;
	action: CrudAction;
	entityType: string; // e.g., "Project", "Category"
	entityName?: string; // Display name of the entity (e.g., project.name)
	entityId?: string;
	changesBefore?: Record<string, unknown> | null;
	changesAfter?: Record<string, unknown> | null;
	customDescription?: string;
}

/**
 * Get severity based on action type
 */
const getSeverityForAction = (action: CrudAction): AuditSeverity => {
	switch (action) {
		case "DELETE":
			return "HIGH";
		case "UPDATE":
			return "MEDIUM";
		case "CREATE":
		case "GET":
		case "GET_ALL":
		case "EXPORT":
		default:
			return "LOW";
	}
};

/**
 * Get audit action from config
 */
const getAuditAction = (action: CrudAction): string => {
	switch (action) {
		case "CREATE":
			return config.AUDIT_LOG.ACTIONS.CREATE;
		case "UPDATE":
			return config.AUDIT_LOG.ACTIONS.UPDATE;
		case "DELETE":
			return config.AUDIT_LOG.ACTIONS.DELETE;
		default:
			return action;
	}
};

/**
 * Generate description based on action and entity
 */
const generateDescription = (
	action: CrudAction,
	entityType: string,
	entityName?: string,
	entityId?: string,
): string => {
	const identifier = entityName || entityId || "unknown";
	switch (action) {
		case "CREATE":
			return `${entityType} created: ${identifier}`;
		case "UPDATE":
			return `${entityType} updated: ${identifier}`;
		case "DELETE":
			return `${entityType} deleted: ${identifier}`;
		case "GET":
			return `${entityType} retrieved: ${identifier}`;
		case "GET_ALL":
			return `${entityType}s retrieved`;
		case "EXPORT":
			return `${entityType}s exported`;
	}
};

/**
 * Generate page title based on action and entity
 */
const generatePageTitle = (action: CrudAction, entityType: string): string => {
	switch (action) {
		case "CREATE":
			return `${entityType} Creation`;
		case "UPDATE":
			return `${entityType} Update`;
		case "DELETE":
			return `${entityType} Deletion`;
		case "GET":
			return `${entityType} Details`;
		case "GET_ALL":
			return `${entityType}s List`;
		case "EXPORT":
			return `${entityType}s Export`;
	}
};

/**
 * Log entity operation - combines activity and audit logging
 *
 * @example
 * // For CREATE
 * logEntityOperation({
 *   req,
 *   action: "CREATE",
 *   entityType: "Project",
 *   entityName: project.name,
 *   entityId: project.id,
 *   changesAfter: project,
 * });
 *
 * // For UPDATE
 * logEntityOperation({
 *   req,
 *   action: "UPDATE",
 *   entityType: "Project",
 *   entityName: project.name,
 *   entityId: project.id,
 *   changesBefore: existingProject,
 *   changesAfter: updatedProject,
 * });
 *
 * // For DELETE
 * logEntityOperation({
 *   req,
 *   action: "DELETE",
 *   entityType: "Project",
 *   entityName: project.name,
 *   entityId: project.id,
 *   changesBefore: project,
 * });
 */
export const logEntityOperation = (options: EntityLogOptions): void => {
	const {
		req,
		action,
		entityType,
		entityName,
		entityId,
		changesBefore = null,
		changesAfter = null,
		customDescription,
	} = options;

	const userId = (req as AuthenticatedRequest).user?.id || "unknown";
	const description =
		customDescription || generateDescription(action, entityType, entityName, entityId);
	const actionKey = `${action}_${entityType.toUpperCase()}`;

	// Log activity
	logActivity(req, {
		userId,
		action: actionKey,
		description,
		page: {
			url: req.originalUrl,
			title: generatePageTitle(action, entityType),
		},
	});

	// Log audit for mutations (CREATE, UPDATE, DELETE)
	if (["CREATE", "UPDATE", "DELETE"].includes(action) && entityId) {
		logAudit(req, {
			userId,
			action: getAuditAction(action),
			resource: entityType.toUpperCase(),
			severity: getSeverityForAction(action),
			entityType,
			entityId,
			changesBefore,
			changesAfter,
			description,
		});
	}
};

/**
 * Shorthand for common operations
 */
export const logCreate = (
	req: Request,
	entityType: string,
	entity: Record<string, unknown> & { id: string; name?: string },
): void => {
	logEntityOperation({
		req,
		action: "CREATE",
		entityType,
		entityName: entity.name,
		entityId: entity.id,
		changesAfter: entity,
	});
};

export const logUpdate = (
	req: Request,
	entityType: string,
	entityId: string,
	before: Record<string, unknown>,
	after: Record<string, unknown> & { name?: string },
): void => {
	logEntityOperation({
		req,
		action: "UPDATE",
		entityType,
		entityName: after.name,
		entityId,
		changesBefore: before,
		changesAfter: after,
	});
};

export const logDelete = (
	req: Request,
	entityType: string,
	entity: Record<string, unknown> & { id: string; name?: string },
): void => {
	logEntityOperation({
		req,
		action: "DELETE",
		entityType,
		entityName: entity.name,
		entityId: entity.id,
		changesBefore: entity,
	});
};

export const logGet = (
	req: Request,
	entityType: string,
	entityId: string,
	entityName?: string,
): void => {
	logEntityOperation({
		req,
		action: "GET",
		entityType,
		entityName,
		entityId,
	});
};

export const logGetAll = (req: Request, entityType: string, count?: number): void => {
	logEntityOperation({
		req,
		action: "GET_ALL",
		entityType,
		customDescription: count !== undefined ? `${entityType}s retrieved: ${count}` : undefined,
	});
};

export const logExport = (req: Request, entityType: string, count: number): void => {
	logEntityOperation({
		req,
		action: "EXPORT",
		entityType,
		customDescription: `Exported ${count} ${entityType.toLowerCase()}s`,
	});
};
