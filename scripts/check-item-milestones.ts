import { PrismaClient } from "../generated/prisma";

const DEFAULT_WORKSPACE_ID = "69730de19f5f5a0cf510ec57";

async function main() {
	const prisma = new PrismaClient();
	const workspaceId = process.env.WORKSPACE_ID || DEFAULT_WORKSPACE_ID;

	try {
		const total = await prisma.item.count({
			where: { workspaceId, isDeleted: false },
		});

		const missing = await prisma.item.count({
			where: { workspaceId, isDeleted: false, milestoneId: null },
		});

		console.log({ workspaceId, total, missing });

		if (missing > 0) {
			const sample = await prisma.item.findMany({
				where: { workspaceId, isDeleted: false, milestoneId: null },
				select: { id: true, itemName: true, estimationId: true },
				take: 10,
			});
			console.log("Sample items missing milestoneId:", sample);
		}
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((e) => {
	// eslint-disable-next-line no-console
	console.error(e);
	process.exit(1);
});

