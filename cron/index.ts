/**
 * Cron Jobs Index
 *
 * Initializes all scheduled tasks.
 */

import cron from "node-cron";
import { PrismaClient } from "../generated/prisma";
import { getLogger } from "../helper/logger";
import { createPaymentScheduleService } from "../app/paymentSchedule/paymentSchedule.service";

const logger = getLogger().child({ module: "cron" });

export const initCronJobs = (prisma: PrismaClient): void => {
	logger.info("Initializing cron jobs...");

	// Daily at midnight: mark overdue and due payment schedule items
	cron.schedule("0 0 * * *", async () => {
		logger.info("Running daily payment schedule overdue check...");
		try {
			const paymentScheduleService = createPaymentScheduleService(prisma);
			const updatedCount = await paymentScheduleService.markOverdueItems();
			logger.info(`Payment schedule overdue check complete: ${updatedCount} schedule(s) updated`);
		} catch (error) {
			logger.error("Failed to run payment schedule overdue check:", error);
		}
	});

	logger.info("All cron jobs initialized");
};
