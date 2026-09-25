/**
 * Dedicated PATS RBAC seed script.
 *
 * Seeds strictly the 6 canonical RBAC subjects, credentials, role bundles,
 * and capability assignments without modifying manufacturing catalog,
 * lots, batches, or monitoring data.
 *
 * Usage:
 *   node --env-file=.env scripts/pats-seed-rbac-only.mjs
 */
import { createHash } from "node:crypto";
import argon2 from "argon2";
import { PrismaClient } from "../generated/pats-client/index.js";

const databaseUrl = process.env.PATS_DATABASE_URL;
if (!databaseUrl) {
	throw new Error("PATS_DATABASE_URL is required to seed RBAC.");
}

const password = (process.env.PATS_SEED_PASSWORD ?? "pats-demo-seed-2026").trim();
if (password.length < 12 || password.length > 1024) {
	throw new Error("PATS_SEED_PASSWORD must contain 12-1024 characters.");
}

const profile = (process.env.SEED_MODE ?? "demo").trim().toLowerCase() || "demo";
const seedClock = new Date();
const prisma = new PrismaClient();

function stableId(key) {
	const hex = createHash("sha256").update(`pats-seed:${profile}:${key}`).digest("hex").slice(0, 32).split("");
	hex[12] = "5";
	hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
	return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

async function upsertSubject(tx, key, username, displayName, roleBundles, passwordHash, extraAssignments = []) {
	const snapshotEmail = `${username}@pats.local`;
	const subject = await tx.subject.upsert({
		where: { id: stableId(key) },
		update: {
			displayNameSnapshot: displayName,
			emailSnapshot: snapshotEmail,
			status: "ACTIVE",
		},
		create: {
			id: stableId(key),
			provider: "local",
			issuer: "pats-local",
			providerSubject: username,
			displayNameSnapshot: displayName,
			emailSnapshot: snapshotEmail,
			status: "ACTIVE",
		},
	});

	await tx.subjectCredential.upsert({
		where: { username },
		update: { subjectId: subject.id, passwordHash },
		create: { subjectId: subject.id, username, passwordHash },
	});

	for (const role of roleBundles) {
		await tx.subjectAssignment.upsert({
			where: { subjectId_kind_key: { subjectId: subject.id, kind: "ROLE_BUNDLE", key: role } },
			update: { status: "ACTIVE", suspendedAt: null, revokedAt: null },
			create: { subjectId: subject.id, kind: "ROLE_BUNDLE", key: role, status: "ACTIVE" },
		});
	}

	for (const assignment of extraAssignments) {
		await tx.subjectAssignment.upsert({
			where: {
				subjectId_kind_key: {
					subjectId: subject.id,
					kind: assignment.kind,
					key: assignment.key,
				},
			},
			update: { status: "ACTIVE", suspendedAt: null, revokedAt: null },
			create: {
				subjectId: subject.id,
				kind: assignment.kind,
				key: assignment.key,
				status: "ACTIVE",
			},
		});
	}

	const desiredKeys = new Set([
		...roleBundles.map((role) => `ROLE_BUNDLE:${role}`),
		...extraAssignments.map((assignment) => `${assignment.kind}:${assignment.key}`),
	]);
	const existingAssignments = await tx.subjectAssignment.findMany({
		where: { subjectId: subject.id, status: "ACTIVE" },
	});
	for (const assignment of existingAssignments) {
		if (!desiredKeys.has(`${assignment.kind}:${assignment.key}`)) {
			await tx.subjectAssignment.update({
				where: { id: assignment.id },
				data: { status: "REVOKED", revokedAt: seedClock },
			});
		}
	}

	await tx.userPreference.upsert({
		where: { userId: subject.id },
		update: { locale: "EN", completedTours: [] },
		create: { userId: subject.id, locale: "EN", completedTours: [] },
	});

	return subject;
}

async function seedRbac() {
	console.log(`\n🔐 Seeding PATS RBAC subjects into ${databaseUrl}...\n`);
	const passwordHash = await argon2.hash(password);

	const subjects = await prisma.$transaction(async (tx) => {
		// 1. Planner (marco.villanueva)
		const planner = await upsertSubject(
			tx,
			"subject-planner",
			"marco.villanueva",
			"Marco Villanueva",
			["planner"],
			passwordHash,
		);

		// 2. Operator (joshua.reyes)
		const operator = await upsertSubject(
			tx,
			"subject-operator",
			"joshua.reyes",
			"Joshua Reyes",
			["operator"],
			passwordHash,
		);

		// 3. Line Leader (aila.torres) — operator + daily-metrics.encode + quality.read
		const lineLeader = await upsertSubject(
			tx,
			"subject-lineleader",
			"aila.torres",
			"Aila Torres",
			["operator"],
			passwordHash,
			[
				{ kind: "CAPABILITY", key: "daily-metrics.encode" },
				{ kind: "CAPABILITY", key: "quality.read" },
			],
		);

		// 4. Quality Inspector (karen.limjoco)
		const quality = await upsertSubject(
			tx,
			"subject-quality",
			"karen.limjoco",
			"Karen Limjoco",
			["qi"],
			passwordHash,
		);

		// 5. Negative QC fixture (paolo.garcia) — qi bundle, no stage scopes
		const qualityNoScope = await upsertSubject(
			tx,
			"subject-quality-noscope",
			"paolo.garcia",
			"Paolo Garcia",
			["qi"],
			passwordHash,
		);

		// 6. Admin (liza.delacruz) — full admin access
		const admin = await upsertSubject(
			tx,
			"subject-admin",
			"liza.delacruz",
			"Liza Dela Cruz",
			["admin"],
			passwordHash,
		);

		return [planner, operator, lineLeader, quality, qualityNoScope, admin];
	});

	console.log(`✅ Successfully seeded ${subjects.length} RBAC fixture subjects:`);
	console.log(`   - liza.delacruz     (admin)`);
	console.log(`   - marco.villanueva  (planner)`);
	console.log(`   - joshua.reyes      (operator)`);
	console.log(`   - aila.torres       (operator + line leader grants)`);
	console.log(`   - karen.limjoco     (qi)`);
	console.log(`   - paolo.garcia      (qi - no stage scope)`);
	console.log(`\n🔑 Shared password: ${password}\n`);
}

try {
	await seedRbac();
} finally {
	await prisma.$disconnect();
}
