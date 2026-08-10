import argon2 from "argon2";
import { PrismaClient } from "../generated/pats-client/index.js";

const KNOWN_ROLE_BUNDLES = new Set([
	"catalog-manager",
	"planner",
	"production-operator",
	"inventory-controller",
	"quality-reviewer",
	"operations-admin",
]);

function required(name) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

function normalizeUsername(value) {
	const username = value.trim().toLowerCase();
	if (!/^[a-z0-9][a-z0-9._-]{2,127}$/.test(username)) {
		throw new Error("PATS_BOOTSTRAP_USERNAME must match the local username policy.");
	}
	return username;
}

const username = normalizeUsername(required("PATS_BOOTSTRAP_USERNAME"));
const password = required("PATS_BOOTSTRAP_PASSWORD");
if (password.length < 12 || password.length > 1024) {
	throw new Error("PATS_BOOTSTRAP_PASSWORD must contain 12-1024 characters.");
}

const roleBundles = required("PATS_BOOTSTRAP_ROLE_BUNDLES")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);
if (roleBundles.length === 0 || roleBundles.some((role) => !KNOWN_ROLE_BUNDLES.has(role))) {
	throw new Error(`PATS_BOOTSTRAP_ROLE_BUNDLES contains an unknown role bundle.`);
}

const prisma = new PrismaClient();
try {
	const subject = await prisma.subject.upsert({
		where: {
			provider_issuer_providerSubject: {
				provider: "local",
				issuer: "pats-local",
				providerSubject: username,
			},
		},
		update: {
			displayNameSnapshot: process.env.PATS_BOOTSTRAP_DISPLAY_NAME?.trim() || username,
			emailSnapshot: process.env.PATS_BOOTSTRAP_EMAIL?.trim() || null,
			status: "ACTIVE",
		},
		create: {
			provider: "local",
			issuer: "pats-local",
			providerSubject: username,
			displayNameSnapshot: process.env.PATS_BOOTSTRAP_DISPLAY_NAME?.trim() || username,
			emailSnapshot: process.env.PATS_BOOTSTRAP_EMAIL?.trim() || null,
			status: "ACTIVE",
		},
	});

	await prisma.subjectCredential.upsert({
		where: { username },
		update: { subjectId: subject.id, passwordHash: await argon2.hash(password) },
		create: {
			subjectId: subject.id,
			username,
			passwordHash: await argon2.hash(password),
		},
	});

	for (const key of roleBundles) {
		await prisma.subjectAssignment.upsert({
			where: {
				subjectId_kind_key: { subjectId: subject.id, kind: "ROLE_BUNDLE", key },
			},
			update: { status: "ACTIVE", revokedAt: null, suspendedAt: null },
			create: { subjectId: subject.id, kind: "ROLE_BUNDLE", key, status: "ACTIVE" },
		});
	}

	console.log(`Bootstrapped local PATS subject '${username}' with ${roleBundles.length} role bundle(s).`);
} finally {
	await prisma.$disconnect();
}
