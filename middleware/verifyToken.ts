import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getLogger } from "../helper/logger";
import { env } from "../config/env";

const logger = getLogger();

const JWT_SECRET = env.JWT_SECRET;

enum Role {
	SUPERADMIN = "superadmin",
	ADMIN = "admin",
	USER = "user",
	GUEST = "guest",
}

export interface AuthRequest extends Request {
	role?: Role;
	userId?: string;
	userEmail?: string;
	firstName?: string;
	lastName?: string;
	workspaceId?: string;
	organizationId?: string;
	tokenExp?: number;
	workspaceMemberRole?: string;
	workspaceMemberId?: string;
	projectMemberRole?: string;
	projectMemberId?: string;
}

interface JwtPayload {
	userId: string;
	role: Role;
	firstName?: string;
	lastName?: string;
	workspaceId?: string;
	organizationId?: string;
	user?: { id?: string; email?: string };
	iat?: number;
	exp?: number;
}

export default (req: AuthRequest, res: Response, next: NextFunction) => {
	// Check for token in Authorization header first, then fall back to cookies
	let token = req.cookies?.token;

	if (!token) {
		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith("Bearer ")) {
			token = authHeader.substring(7); // Remove 'Bearer ' prefix
		}
	}

	if (!token) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	try {
		const decoded = jwt.verify(token, JWT_SECRET, {
			algorithms: ["HS256"], // Explicitly specify allowed algorithms
			maxAge: "24h", // Maximum token age
		}) as JwtPayload;

		// Additional validation
		if (!decoded.userId || !decoded.role) {
			logger.warn("Invalid token payload - missing required fields", {
				ip: req.ip,
				path: req.path,
			});
			res.status(401).json({ message: "Invalid token" });
			return;
		}

		// Attach decoded data to request
		req.role = decoded.role;
		req.userId = decoded.userId;
		req.userEmail = decoded.user?.email;
		req.organizationId = decoded.organizationId;
		req.firstName = decoded.firstName;
		req.lastName = decoded.lastName;
		req.tokenExp = decoded.exp;

		// Check for x-workspace-id header (selected workspace ID from frontend)
		// This overrides the JWT workspaceId which is the SSO tenant ID
		const headerWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
		req.workspaceId = headerWorkspaceId || decoded.workspaceId;

		// Log successful authentication (without sensitive data)
		logger.debug("Token verified successfully", {
			userId: decoded.userId,
			role: decoded.role,
			path: req.path,
		});

		next();
	} catch (error) {
		// Log authentication failures for security monitoring
		logger.warn("Token verification failed", {
			ip: req.ip,
			path: req.path,
			userAgent: req.get("User-Agent"),
			error: error instanceof Error ? error.name : "Unknown",
		});

		// Don't expose internal error details to client
		if (error instanceof jwt.TokenExpiredError) {
			res.status(401).json({ message: "Token expired" });
		} else if (error instanceof jwt.JsonWebTokenError) {
			res.status(401).json({ message: "Invalid token" });
		} else {
			res.status(401).json({ message: "Authentication failed" });
		}
	}
};
