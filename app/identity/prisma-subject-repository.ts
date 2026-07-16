import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient as PatsPrismaClient } from "../../generated/pats-client";
import type {
	LocalAccountRepository,
	LocalCredentialRecord,
	SubjectAssignmentRecord,
	SubjectRecord,
	SubjectRepository,
	VerifiedIdentity,
} from "./types";

interface SubjectRow {
	id: string;
	provider: string;
	issuer: string;
	providerSubject: string;
	displayNameSnapshot: string | null;
	emailSnapshot: string | null;
	status: "ACTIVE" | "DISABLED";
}

interface AssignmentRow {
	kind: "CAPABILITY" | "ROLE_BUNDLE";
	key: string;
	status: "ACTIVE" | "SUSPENDED" | "REVOKED";
}

interface CredentialRow {
	subjectId: string;
	username: string;
	passwordHash: string;
}

export interface PrismaSubjectRepository extends SubjectRepository, LocalAccountRepository {}

export function prismaSubjectRepository(prisma: PatsPrismaClient): PrismaSubjectRepository {
	const repository: PrismaSubjectRepository = {
		async findById(subjectId: string): Promise<SubjectRecord | null> {
			const rows = await prisma.$queryRaw<SubjectRow[]>(Prisma.sql`
				SELECT "id", "provider", "issuer", "providerSubject", "displayNameSnapshot", "emailSnapshot", "status"
				FROM "Subject"
				WHERE "id" = ${subjectId}
				LIMIT 1
			`);

			const row = rows[0];
			if (!row) return null;
			return {
				id: row.id,
				provider: row.provider,
				issuer: row.issuer,
				providerSubject: row.providerSubject,
				displayNameSnapshot: row.displayNameSnapshot ?? undefined,
				emailSnapshot: row.emailSnapshot ?? undefined,
				status: row.status,
			};
		},

		async resolve(identity: VerifiedIdentity): Promise<SubjectRecord> {
			if (identity.subjectId) {
				const existing = await repository.findById(identity.subjectId);
				if (!existing) throw new Error("Subject does not exist.");
				return existing;
			}

			const rows = await prisma.$queryRaw<SubjectRow[]>(Prisma.sql`
				INSERT INTO "Subject" (
					"id", "provider", "issuer", "providerSubject", "displayNameSnapshot", "emailSnapshot", "status", "createdAt", "updatedAt"
				)
				VALUES (
					${randomUUID()},
					${identity.provider},
					${identity.issuer},
					${identity.providerSubject},
					${identity.displayName ?? null},
					${identity.email ?? null},
					'ACTIVE'::"SubjectStatus",
					CURRENT_TIMESTAMP,
					CURRENT_TIMESTAMP
				)
				ON CONFLICT ("provider", "issuer", "providerSubject") DO UPDATE
				SET
					"displayNameSnapshot" = COALESCE("Subject"."displayNameSnapshot", EXCLUDED."displayNameSnapshot"),
					"emailSnapshot" = COALESCE("Subject"."emailSnapshot", EXCLUDED."emailSnapshot"),
					"updatedAt" = CURRENT_TIMESTAMP
				RETURNING "id", "provider", "issuer", "providerSubject", "displayNameSnapshot", "emailSnapshot", "status"
			`);

			const row = rows[0];
			if (!row) throw new Error("Subject resolution did not return a row.");

			return {
				id: row.id,
				provider: row.provider,
				issuer: row.issuer,
				providerSubject: row.providerSubject,
				displayNameSnapshot: row.displayNameSnapshot ?? undefined,
				emailSnapshot: row.emailSnapshot ?? undefined,
				status: row.status,
			};
		},

		async listAssignments(subjectId: string): Promise<SubjectAssignmentRecord[]> {
			const rows = await prisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
				SELECT "kind", "key", "status"
				FROM "SubjectAssignment"
				WHERE "subjectId" = ${subjectId}
				ORDER BY "kind", "key"
			`);

			return rows;
		},

		async findByUsername(username: string): Promise<LocalCredentialRecord | null> {
			const rows = await prisma.$queryRaw<CredentialRow[]>(Prisma.sql`
				SELECT "subjectId", "username", "passwordHash"
				FROM "SubjectCredential"
				WHERE "username" = ${username}
				LIMIT 1
			`);

			return rows[0] ?? null;
		},

		async markLogin(subjectId: string, occurredAt: Date): Promise<void> {
			await prisma.$executeRaw(Prisma.sql`
				UPDATE "SubjectCredential"
				SET "lastLoginAt" = ${occurredAt}, "updatedAt" = CURRENT_TIMESTAMP
				WHERE "subjectId" = ${subjectId}
			`);
		},
	};

	return repository;
}
