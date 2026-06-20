/**
 * Script to update estimation points for all existing items
 * This will calculate and set estimation points based on estimatedTotal using Fibonacci scale
 *
 * Run with: npx ts-node scripts/update-estimation-points.ts
 */

import { PrismaClient } from "../generated/prisma";
import { calculateEstimationPoints } from "../utils/calculations";

const prisma = new PrismaClient();

async function updateAllEstimationPoints() {
	console.log("🔄 Starting update of estimation points for all items...\n");

	try {
		// Fetch all non-deleted items
		const items = await prisma.item.findMany({
			where: {
				isDeleted: false,
			},
			select: {
				id: true,
				itemName: true,
				estimatedTotal: true,
				actualTotal: true,
				estimationPoints: true,
			},
		});

		console.log(`Found ${items.length} items to process\n`);
		let updatedCount = 0;
		let skippedCount = 0;
		let errorCount = 0;

		// Update each item
		for (const item of items) {
			try {
				// Use actualTotal if estimatedTotal is 0 (new additions to APPROVED estimations)
				const totalForPoints =
					item.estimatedTotal > 0 ? item.estimatedTotal : item.actualTotal || 0;
				const calculatedPoints = calculateEstimationPoints(totalForPoints);

				// Only update if points are different
				if (item.estimationPoints !== calculatedPoints) {
					await prisma.item.update({
						where: { id: item.id },
						data: { estimationPoints: calculatedPoints },
					});

					console.log(`✅ ${item.itemName}`);
					console.log(`   Estimated Total: ₱${item.estimatedTotal.toLocaleString()}`);
					console.log(`   Actual Total: ₱${(item.actualTotal || 0).toLocaleString()}`);
					console.log(`   Total used for points: ₱${totalForPoints.toLocaleString()}`);
					console.log(
						`   Points: ${item.estimationPoints || "null"} → ${calculatedPoints}`,
					);
					console.log("");

					updatedCount++;
				} else {
					skippedCount++;
				}
			} catch (error) {
				console.error(`❌ Error updating ${item.itemName}:`, error);
				errorCount++;
			}
		}

		console.log("\n" + "=".repeat(50));
		console.log("📊 Summary:");
		console.log(`   Total items: ${items.length}`);
		console.log(`   ✅ Updated: ${updatedCount}`);
		console.log(`   ⏭️  Skipped (already correct): ${skippedCount}`);
		console.log(`   ❌ Errors: ${errorCount}`);
		console.log("=".repeat(50));

		if (updatedCount > 0) {
			console.log("\n✨ Estimation points updated successfully!");
			console.log("💡 Tip: Points are automatically calculated using these ranges:");
			console.log("   1pt: $0-1K | 2pt: $1K-5K | 3pt: $5K-10K | 5pt: $10K-25K");
			console.log("   8pt: $25K-50K | 13pt: $50K-100K | 21pt: $100K-250K");
			console.log("   34pt: $250K-500K | 55pt: $500K-1M | 89pt: $1M+");
		}
	} catch (error) {
		console.error("❌ Fatal error:", error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

// Run the script
updateAllEstimationPoints().catch((error) => {
	console.error("Unexpected error:", error);
	process.exit(1);
});
