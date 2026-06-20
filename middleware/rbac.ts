import { Request, Response, NextFunction } from "express";
import { getLogger } from "../helper/logger";

const logger = getLogger();

/**
 * Role-Based Access Control (RBAC) Middleware
 */

export enum Role {
	SUPERADMIN = "superadmin",
	ADMIN = "admin",
	PRODUCT_MANAGER = "product-manager",
	USER = "user",
	GUEST = "guest",
}

// Define role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY: Record<Role, number> = {
	[Role.SUPERADMIN]: 4,
	[Role.ADMIN]: 3,
	[Role.PRODUCT_MANAGER]: 2.5,
	[Role.USER]: 2,
	[Role.GUEST]: 1,
};

/**
 * Permission types for granular access control
 */
export enum Permission {
	// Resource permissions
	CREATE = "create",
	READ = "read",
	UPDATE = "update",
	DELETE = "delete",

	// Product permissions
	PRODUCT_CREATE = "product:create",
	PRODUCT_READ = "product:read",
	PRODUCT_UPDATE = "product:update",
	PRODUCT_DELETE = "product:delete",

	// Admin permissions
	MANAGE_USERS = "manage_users",
	MANAGE_ROLES = "manage_roles",
	VIEW_AUDIT_LOGS = "view_audit_logs",

	// Special permissions
	APPROVE = "approve",
	REJECT = "reject",
	EXPORT = "export",
	IMPORT = "import",
}

/**
 * Role-to-permissions mapping
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
	[Role.SUPERADMIN]: [
		Permission.CREATE,
		Permission.READ,
		Permission.UPDATE,
		Permission.DELETE,
		Permission.PRODUCT_CREATE,
		Permission.PRODUCT_READ,
		Permission.PRODUCT_UPDATE,
		Permission.PRODUCT_DELETE,
		Permission.MANAGE_USERS,
		Permission.MANAGE_ROLES,
		Permission.VIEW_AUDIT_LOGS,
		Permission.APPROVE,
		Permission.REJECT,
		Permission.EXPORT,
		Permission.IMPORT,
	],
	[Role.ADMIN]: [
		Permission.CREATE,
		Permission.READ,
		Permission.UPDATE,
		Permission.DELETE,
		Permission.PRODUCT_CREATE,
		Permission.PRODUCT_READ,
		Permission.PRODUCT_UPDATE,
		Permission.PRODUCT_DELETE,
		Permission.APPROVE,
		Permission.REJECT,
		Permission.EXPORT,
		Permission.VIEW_AUDIT_LOGS,
	],
	[Role.PRODUCT_MANAGER]: [
		Permission.PRODUCT_CREATE,
		Permission.PRODUCT_READ,
		Permission.PRODUCT_UPDATE,
		Permission.PRODUCT_DELETE,
	],
	[Role.USER]: [Permission.READ, Permission.EXPORT],
	[Role.GUEST]: [Permission.READ],
};

/**
 * Extended request interface with user data
 */
export interface RBACRequest extends Request {
	role?: Role;
	userId?: string;
	workspaceId?: string;
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
	const permissions = ROLE_PERMISSIONS[role] || [];
	return permissions.includes(permission);
}

/**
 * Check if a role is at least the required role (based on hierarchy)
 */
export function hasRoleLevel(userRole: Role, requiredRole: Role): boolean {
	const userLevel = ROLE_HIERARCHY[userRole] || 0;
	const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
	return userLevel >= requiredLevel;
}

/**
 * Middleware: Require specific role(s)
 * Usage: requireRole(Role.ADMIN)
 * Usage: requireRole([Role.ADMIN, Role.SUPERADMIN])
 */
export function requireRole(allowedRoles: Role | Role[]) {
	return (req: RBACRequest, res: Response, next: NextFunction) => {
		const userRole = req.role;

		if (!userRole) {
			logger.warn("Access denied - No role found in request", {
				ip: req.ip,
				path: req.path,
				userId: req.userId,
			});
			return res.status(401).json({
				error: "Unauthorized",
				message: "Authentication required",
			});
		}

		const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

		if (!roles.includes(userRole as Role)) {
			logger.warn("Access denied - Insufficient role", {
				ip: req.ip,
				path: req.path,
				userId: req.userId,
				userRole,
				requiredRoles: roles,
			});
			return res.status(403).json({
				error: "Forbidden",
				message: "You do not have permission to access this resource",
			});
		}

		logger.debug("Role check passed", {
			userId: req.userId,
			role: userRole,
			path: req.path,
		});

		next();
	};
}

/**
 * Middleware: Require minimum role level
 * Usage: requireMinRole(Role.ADMIN) - allows ADMIN and SUPERADMIN
 */
export function requireMinRole(minRole: Role) {
	return (req: RBACRequest, res: Response, next: NextFunction) => {
		const userRole = req.role;

		if (!userRole) {
			logger.warn("Access denied - No role found in request", {
				ip: req.ip,
				path: req.path,
				userId: req.userId,
			});
			return res.status(401).json({
				error: "Unauthorized",
				message: "Authentication required",
			});
		}

		if (!hasRoleLevel(userRole as Role, minRole)) {
			logger.warn("Access denied - Insufficient role level", {
				ip: req.ip,
				path: req.path,
				userId: req.userId,
				userRole,
				minRequiredRole: minRole,
			});
			return res.status(403).json({
				error: "Forbidden",
				message: "You do not have permission to access this resource",
			});
		}

		logger.debug("Role level check passed", {
			userId: req.userId,
			role: userRole,
			path: req.path,
		});

		next();
	};
}

/**
 * Middleware: Require specific permission
 * Usage: requirePermission(Permission.DELETE)
 */
export function requirePermission(permission: Permission | Permission[]) {
	return (req: RBACRequest, res: Response, next: NextFunction) => {
		const userRole = req.role;

		if (!userRole) {
			logger.warn("Access denied - No role found in request", {
				ip: req.ip,
				path: req.path,
				userId: req.userId,
			});
			return res.status(401).json({
				error: "Unauthorized",
				message: "Authentication required",
			});
		}

		const permissions = Array.isArray(permission) ? permission : [permission];
		const hasRequiredPermission = permissions.some((perm) =>
			hasPermission(userRole as Role, perm),
		);

		if (!hasRequiredPermission) {
			logger.warn("Access denied - Missing permission", {
				ip: req.ip,
				path: req.path,
				userId: req.userId,
				userRole,
				requiredPermissions: permissions,
			});
			return res.status(403).json({
				error: "Forbidden",
				message: "You do not have permission to perform this action",
			});
		}

		logger.debug("Permission check passed", {
			userId: req.userId,
			role: userRole,
			path: req.path,
		});

		next();
	};
}

/**
 * Middleware: Check resource ownership
 * Allows users to access their own resources or requires admin role for others
 * Usage: requireOwnership('userId') - checks if req.params.userId matches req.userId
 */
export function requireOwnership(resourceIdField: string = "id", options: { allowAdmin?: boolean } = { allowAdmin: true }) {
	return (req: RBACRequest, res: Response, next: NextFunction) => {
		const userRole = req.role;
		const userId = req.userId;
		const resourceId = req.params[resourceIdField] || req.body[resourceIdField];

		if (!userId) {
			logger.warn("Access denied - No user ID found in request", {
				ip: req.ip,
				path: req.path,
			});
			return res.status(401).json({
				error: "Unauthorized",
				message: "Authentication required",
			});
		}

		// Allow admins to access any resource if configured
		if (options.allowAdmin && userRole && hasRoleLevel(userRole as Role, Role.ADMIN)) {
			logger.debug("Ownership check bypassed - Admin access", {
				userId,
				role: userRole,
				path: req.path,
			});
			return next();
		}

		// Check if user owns the resource
		if (resourceId && resourceId !== userId) {
			logger.warn("Access denied - Not resource owner", {
				ip: req.ip,
				path: req.path,
				userId,
				resourceId,
			});
			return res.status(403).json({
				error: "Forbidden",
				message: "You can only access your own resources",
			});
		}

		logger.debug("Ownership check passed", {
			userId,
			resourceId,
			path: req.path,
		});

		next();
	};
}

/**
 * Middleware: Check workspace access
 * Ensures user can only access resources from their workspace
 */
export function requireWorkspaceAccess() {
	return (req: RBACRequest, res: Response, next: NextFunction) => {
		const userWorkspaceId = req.workspaceId;
		const resourceWorkspaceId = req.params.workspaceId || req.body.workspaceId;

		if (!userWorkspaceId) {
			logger.warn("Access denied - No workspace ID found in request", {
				ip: req.ip,
				path: req.path,
				userId: req.userId,
			});
			return res.status(401).json({
				error: "Unauthorized",
				message: "Workspace context required",
			});
		}

		// Superadmins can access all workspaces
		if (req.role === Role.SUPERADMIN) {
			return next();
		}

		if (resourceWorkspaceId && resourceWorkspaceId !== userWorkspaceId) {
			logger.warn("Access denied - Workspace mismatch", {
				ip: req.ip,
				path: req.path,
				userId: req.userId,
				userWorkspaceId,
				resourceWorkspaceId,
			});
			return res.status(403).json({
				error: "Forbidden",
				message: "You can only access resources from your workspace",
			});
		}

		next();
	};
}

export default {
	Role,
	Permission,
	hasPermission,
	hasRoleLevel,
	requireRole,
	requireMinRole,
	requirePermission,
	requireOwnership,
	requireWorkspaceAccess,
};
