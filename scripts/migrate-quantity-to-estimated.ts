import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function migrateQuantityFields() {
	try {
		console.log("Starting migration: quantity → estimatedQuantity...");

		// Use raw MongoDB command to rename the field for all documents
		const result = await prisma.$runCommandRaw({
			update: "Item",
			updates: [
				{
					q: { quantity: { $exists: true } }, // Only update docs that have 'quantity'
					u: {
						$rename: { quantity: "estimatedQuantity" },
					},
					multi: true, // Update all matching documents
				},
			],
		});

		console.log("Migration result:", result);
		console.log("\n=== Migration Complete ===");
		console.log("All 'quantity' fields have been renamed to 'estimatedQuantity'");
		console.log("=========================\n");
	} catch (error) {
		console.error("Migration failed:", error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

migrateQuantityFields()
	.then(() => {
		console.log("Migration script completed successfully");
		process.exit(0);
	})
	.catch((error) => {
		console.error("Migration script failed:", error);
		process.exit(1);
	});
