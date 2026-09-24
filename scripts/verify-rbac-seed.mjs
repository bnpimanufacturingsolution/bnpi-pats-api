import { PrismaClient } from "../generated/pats-client/index.js";

const prisma = new PrismaClient();

async function main() {
	const subjects = await prisma.subject.findMany({
		include: {
			assignments: {
				where: { status: "ACTIVE" },
			},
			credential: true,
		},
		orderBy: { createdAt: "asc" },
	});

	console.log(`Found ${subjects.length} active RBAC subjects in PATS:`);
	for (const s of subjects) {
		const roles = s.assignments.map((a) => `${a.kind}:${a.key}`).join(", ");
		console.log(`- ${s.credential?.username.padEnd(18)} | ${s.displayNameSnapshot.padEnd(20)} | Roles: [${roles}]`);
	}
}

try {
	await main();
} finally {
	await prisma.$disconnect();
}
