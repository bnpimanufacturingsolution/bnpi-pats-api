import jwt, { SignOptions } from "jsonwebtoken";
import { getLogger } from "./logger";

const logger = getLogger();

// Get JWT secrets
const JWT_SECRET: string = process.env.JWT_SECRET || "your-super-secret-jwt-key-here";
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

// Token expiration times
const ACCESS_TOKEN_EXPIRY: string = process.env.JWT_EXPIRES_IN || "24h";
const REFRESH_TOKEN_EXPIRY: string = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/**
 * JWT Token Payload Interface
 */
export interface TokenPayload {
	userId: string;
	role: string;
	firstName?: string;
	lastName?: string;
	workspaceId?: string;
	email?: string;
}

/**
 * Token Response Interface
 */
export interface TokenResponse {
	accessToken: string;
	refreshToken: string;
	expiresIn: string;
	tokenType: "Bearer";
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: TokenPayload): string {
	try {
		const options: SignOptions = {
			expiresIn: ACCESS_TOKEN_EXPIRY as never,
			algorithm: "HS256",
			issuer: "bnpi-pats-api",
			audience: "bandai-pats-client",
		};
		const token = jwt.sign(payload, JWT_SECRET, options);

		logger.debug("Access token generated", {
			userId: payload.userId,
			expiresIn: ACCESS_TOKEN_EXPIRY,
		});

		return token;
	} catch (error) {
		logger.error("Failed to generate access token", {
			error: error instanceof Error ? error.message : "Unknown error",
			userId: payload.userId,
		});
		throw new Error("Failed to generate access token");
	}
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: TokenPayload): string {
	try {
		// Refresh token has minimal payload for security
		const refreshPayload = {
			userId: payload.userId,
			role: payload.role,
			tokenType: "refresh",
		};

		const options: SignOptions = {
			expiresIn: REFRESH_TOKEN_EXPIRY as never,
			algorithm: "HS256",
			issuer: "bnpi-pats-api",
			audience: "bandai-pats-client",
		};
		const token = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, options);

		logger.debug("Refresh token generated", {
			userId: payload.userId,
			expiresIn: REFRESH_TOKEN_EXPIRY,
		});

		return token;
	} catch (error) {
		logger.error("Failed to generate refresh token", {
			error: error instanceof Error ? error.message : "Unknown error",
			userId: payload.userId,
		});
		throw new Error("Failed to generate refresh token");
	}
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: TokenPayload): TokenResponse {
	const accessToken = generateAccessToken(payload);
	const refreshToken = generateRefreshToken(payload);

	return {
		accessToken,
		refreshToken,
		expiresIn: ACCESS_TOKEN_EXPIRY,
		tokenType: "Bearer",
	};
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): TokenPayload {
	try {
		const decoded = jwt.verify(token, JWT_SECRET, {
			algorithms: ["HS256"],
			issuer: "bnpi-pats-api",
			audience: "bandai-pats-client",
		}) as TokenPayload;

		return decoded;
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			logger.warn("Access token expired", {
				expiredAt: error.expiredAt,
			});
			throw new Error("Token expired");
		} else if (error instanceof jwt.JsonWebTokenError) {
			logger.warn("Invalid access token", {
				error: error.message,
			});
			throw new Error("Invalid token");
		} else {
			logger.error("Access token verification failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
			throw new Error("Token verification failed");
		}
	}
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { userId: string; role: string } {
	try {
		const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
			algorithms: ["HS256"],
			issuer: "bnpi-pats-api",
			audience: "bandai-pats-client",
		}) as Record<string, unknown>;

		// Ensure it's actually a refresh token
		if (decoded.tokenType !== "refresh") {
			throw new Error("Not a refresh token");
		}

		return {
			userId: decoded.userId as string,
			role: decoded.role as string,
		};
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			logger.warn("Refresh token expired", {
				expiredAt: error.expiredAt,
			});
			throw new Error("Refresh token expired");
		} else if (error instanceof jwt.JsonWebTokenError) {
			logger.warn("Invalid refresh token", {
				error: error.message,
			});
			throw new Error("Invalid refresh token");
		} else {
			logger.error("Refresh token verification failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
			throw new Error("Refresh token verification failed");
		}
	}
}

/**
 * Decode token without verification (for debugging/logging)
 */
export function decodeToken(token: string): Record<string, unknown> | null {
	try {
		return jwt.decode(token) as Record<string, unknown> | null;
	} catch (error) {
		logger.error("Failed to decode token", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
		return null;
	}
}

/**
 * Check if token is expired (without throwing error)
 */
export function isTokenExpired(token: string): boolean {
	try {
		const decoded = jwt.decode(token) as Record<string, unknown> | null;
		if (!decoded || !("exp" in decoded) || typeof decoded.exp !== "number") {
			return true;
		}
		const now = Math.floor(Date.now() / 1000);
		return decoded.exp < now;
	} catch (error) {
		return true;
	}
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
	try {
		const decoded = jwt.decode(token) as Record<string, unknown> | null;
		if (!decoded || !("exp" in decoded) || typeof decoded.exp !== "number") {
			return null;
		}
		return new Date(decoded.exp * 1000);
	} catch (error) {
		return null;
	}
}

/**
 * Calculate time until token expires (in seconds)
 */
export function getTimeUntilExpiry(token: string): number | null {
	try {
		const decoded = jwt.decode(token) as Record<string, unknown> | null;
		if (!decoded || !("exp" in decoded) || typeof decoded.exp !== "number") {
			return null;
		}
		const now = Math.floor(Date.now() / 1000);
		const secondsLeft = decoded.exp - now;
		return Math.max(0, secondsLeft);
	} catch (error) {
		return null;
	}
}

export default {
	generateAccessToken,
	generateRefreshToken,
	generateTokenPair,
	verifyAccessToken,
	verifyRefreshToken,
	decodeToken,
	isTokenExpired,
	getTokenExpiration,
	getTimeUntilExpiry,
};

