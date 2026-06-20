/**
 * Script to migrate Item.actualTotal to Transactions
 * 
 * This script ensures the new "Transactions as Source of Truth" architecture works for existing data.
 * It iterates through all items with actualTotal > 0 and creates a corresponding Transaction if one doesn't exist.
 * 
 * Idempotency: Uses transactionNumber = "MIG-{itemId}" to prevent duplicates.
 * 
 * Run with: npx ts-node scripts/migrate-actuals-to-transactions.ts [--dry-run]
 */

import { PrismaClient, TransactionType, TransactionStatus, PaymentMethod } from "../generated/prisma";

const prisma = new PrismaClient();
const IS_DRY_RUN = process.argv.includes("--dry-run");

async function migrateActuals() {
	console.log("🔄 Starting migration of Actuals to Transactions...");
	if (IS_DRY_RUN) {
		console.log("ℹ️  DRY RUN MODE: No data will be written.");
	}
	console.log("\n");

	try {
		// 1. Fetch all items with actuals
		const itemsWithActuals = await prisma.item.findMany({
			where: {
				isDeleted: false,
				actualTotal: {
					gt: 0
				},
				// Optional: Filter for items that might already have "real" transactions? 
				// For now, we assume if actualTotal exists, it needs migration unless already covered.
			},
			include: {
				estimation: true, // Needed for project ID
				transactions: true // Check if already has transactions? 
                // Actually better to rely on transactionNumber idempotency check
			}
		});

		console.log(`Found ${itemsWithActuals.length} items with actualTotal > 0\n`);

		let successCount = 0;
		let skippedCount = 0;
		let errorCount = 0;
		let totalMigratedAmount = 0;

		for (const item of itemsWithActuals) {
			const migrationTxnNumber = `MIG-${item.id}`;
			
			// 2. Check if already migrated (Idempotency)
			const existingTxn = await prisma.transaction.findUnique({
				where: { transactionNumber: migrationTxnNumber }
			});

			if (existingTxn) {
				console.log(`⏭️  Skipping Item ${item.id} (${item.itemName}): Already migrated (TXN: ${existingTxn.id})`);
				skippedCount++;
				continue;
			}
			
			// Additional Safety: If item already has "real" transactions linked, maybe actualTotal is already from them?
			// But the old architecture stored actualTotal separately. 
			// We'll proceed with creating the migration transaction, assuming actualTotal represents legacy data.

			if (!item.estimation?.projectId) {
				console.warn(`⚠️  Skipping Item ${item.id} (${item.itemName}): No linked Project ID`);
				errorCount++;
				continue;
			}

			const amount = item.actualTotal || 0;

			// 3. Create Transaction
			if (IS_DRY_RUN) {
				console.log(`[DRY RUN] Would create Transaction for Item ${item.itemName}: $${amount}`);
				successCount++;
				totalMigratedAmount += amount;
			} else {
				try {
					const txn = await prisma.transaction.create({
						data: {
							transactionNumber: migrationTxnNumber,
							transactionDate: item.updatedAt || new Date(), // Use last update time
							projectId: item.estimation.projectId,
							itemId: item.id,

							transactionType: TransactionType.OUTGOING,
							paymentMethod: PaymentMethod.OTHER,
							
							payeeName: "System Migration",
							amount: amount,
							
							status: TransactionStatus.CLEARED, // Actuals are considered cleared
							clearedDate: item.updatedAt || new Date(),
							
							isDeleted: false,
                            
                            // Add a note if possible? Schema doesn't have description field on root.
                            // We use payeeName to indicate migration.
						}
					});
					
					console.log(`✅ Migrated Item ${item.id} (${item.itemName}): Created TXN ${txn.transactionNumber} ($${amount})`);
					successCount++;
					totalMigratedAmount += amount;

				} catch (err: any) {
					// Handle unique constraint violation gracefully just in case
					if (err.code === 'P2002') {
						console.log(`⏭️  Skipping Item ${item.id}: Transaction number collision (Already migrated?)`);
						skippedCount++;
					} else {
						console.error(`❌ Failed to migrate Item ${item.id}:`, err);
						errorCount++;
					}
				}
			}
		}

		console.log("\n" + "=".repeat(50));
		console.log("📊 Migration Summary:");
		console.log("=".repeat(50));
		console.log(`Total Candidate Items: ${itemsWithActuals.length}`);
		console.log(`✅ Migrated:           ${successCount}`);
		console.log(`⏭️  Skipped (Existing): ${skippedCount}`);
		console.log(`❌ Failed:             ${errorCount}`);
		console.log(`💰 Total Value:        $${totalMigratedAmount.toFixed(2)}`);
		console.log("=".repeat(50));
		
		if (IS_DRY_RUN) {
			console.log("\nℹ️  This was a DRY RUN. Run without --dry-run to commit changes.");
		}

	} catch (error) {
		console.error("❌ Fatal error during migration:", error);
		process.exit(1);
	}
}

// Run the script
migrateActuals()
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
