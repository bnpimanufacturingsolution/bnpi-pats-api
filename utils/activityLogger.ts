import { Request } from "express";

const ACTIVITY_LOG_URL = process.env.ACTIVITY_LOG_URL || "http://localhost:3001/api/activityLog";

/**
 * Logs user activity to the Activity Log microservice.
 */
export async function logActivity(
	req: Request,
	payload: {
		userId: string;
		action: string;
		description: string;
		workspaceId?: string;
		page?: { url: string; title: string };
	},
) {
	try {
		const activityData = {
			userId: payload.userId,
			ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown",
			path: req.originalUrl,
			method: req.method,
			userAgent: req.get("User-Agent"),
			action: payload.action,
			page: payload.page,
			description: payload.description,
			workspaceId: payload.workspaceId,
		};

		// Fire-and-forget logging
		fetch(ACTIVITY_LOG_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: req.headers.cookie || "",
			},
			body: JSON.stringify(activityData),
		}).catch((err) => console.error("Activity log request failed:", err.message));
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("Failed to log activity:", errorMessage);
	}
}
