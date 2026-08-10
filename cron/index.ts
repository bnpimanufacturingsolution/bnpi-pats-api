/**
 * Cron Jobs Index
 *
 * Initializes all scheduled tasks.
 */

import type { PrismaClient } from "../generated/prisma";
import { getLogger } from "../helper/logger";

const logger = getLogger().child({ module: "cron" });

export const initCronJobs = (_prisma: PrismaClient): void => {
	logger.info("Initializing cron jobs...");
	// The payment-schedule overdue-check job was retired with the paymentSchedule
	// module (2026-07-15, no active consumer). No cron jobs are currently registered.
	logger.info("All cron jobs initialized");
};
