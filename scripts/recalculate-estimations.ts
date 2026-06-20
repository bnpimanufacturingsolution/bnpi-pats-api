/**
 * Script to recalculate all estimations with updated metadata structure
 * This will update all estimations to include:
 * - categorySubtotals (per category)
 * - typeBreakdown (CAPEX/OPEX/MISC)
 *
 * Run with: npx ts-node scripts/recalculate-estimations.ts
 */

import { PrismaClient } from "../generated/prisma";
import { updateEstimationTotalsAndMetadata } from "../utils/calculations";

const prisma = new PrismaClient();

async function recalculateAllEstimations() {
	console.log("🔄 Starting recalculation of all estimations...\n");

	try {
		// Fetch all non-deleted estimations
		const estimations = await prisma.estimation.findMany({
			where: {
				isDeleted: false,
			},
			select: {
				id: true,
				estimationNumber: true,
				name: true,
			},
		});

		console.log(`Found ${estimations.length} estimations to recalculate\n`);

		let successCount = 0;
		let errorCount = 0;

		// Recalculate each estimation
		for (const estimation of estimations) {
			try {
				console.log(`Processing: ${estimation.estimationNumber} - ${estimation.name}`);

				const result = await updateEstimationTotalsAndMetadata(prisma, estimation.id);

				console.log(`✅ Updated successfully`);
				console.log(`   - Estimated Cost: ${result.estimatedCost}`);
				console.log(`   - Actual Cost: ${result.actualCost || "N/A"}`);
				console.log(`   - Metadata updated with category and type breakdowns`);
				console.log("");

				successCount++;
			} catch (error) {
				console.error(`❌ Error updating ${estimation.estimationNumber}:`, error);
				console.log("");
				errorCount++;
			}
		}

		console.log("\n" + "=".repeat(50));
		console.log("📊 Recalculation Summary:");
		console.log("=".repeat(50));
		console.log(`Total estimations: ${estimations.length}`);
		console.log(`✅ Successfully updated: ${successCount}`);
		console.log(`❌ Failed: ${errorCount}`);
		console.log("=".repeat(50));

		if (successCount === estimations.length) {
			console.log("\n🎉 All estimations recalculated successfully!");
		} else if (errorCount > 0) {
			console.log("\n⚠️  Some estimations failed to recalculate. Please check the errors above.");
		}

	} catch (error) {
		console.error("❌ Fatal error during recalculation:", error);
		throw error;
	}
}

// Run the script
recalculateAllEstimations()
	.then(async () => {
		console.log("\n✨ Script completed");
		await prisma.$disconnect();
		process.exit(0);
	})
	.catch(async (error) => {
		console.error("\n💥 Script failed:", error);
		await prisma.$disconnect();
		process.exit(1);
	});
