-- Gate 2 identity and capability persistence.
-- Deployment-scoped by design: no Workspace, membership, tenant selector, or ProductionLine FK.

CREATE TYPE "SubjectStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "SubjectAssignmentKind" AS ENUM ('CAPABILITY', 'ROLE_BUNDLE');

CREATE TYPE "SubjectAssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "displayNameSnapshot" TEXT,
    "emailSnapshot" TEXT,
    "status" "SubjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubjectAssignment" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "kind" "SubjectAssignmentKind" NOT NULL,
    "key" TEXT NOT NULL,
    "status" "SubjectAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubjectCredential" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "SubjectCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subject_provider_issuer_providerSubject_key"
    ON "Subject"("provider", "issuer", "providerSubject");

CREATE INDEX "Subject_status_idx" ON "Subject"("status");

CREATE UNIQUE INDEX "SubjectCredential_subjectId_key" ON "SubjectCredential"("subjectId");

CREATE UNIQUE INDEX "SubjectCredential_username_key" ON "SubjectCredential"("username");

CREATE INDEX "SubjectCredential_username_idx" ON "SubjectCredential"("username");

CREATE UNIQUE INDEX "SubjectAssignment_subjectId_kind_key_key"
    ON "SubjectAssignment"("subjectId", "kind", "key");

CREATE INDEX "SubjectAssignment_subjectId_status_idx"
    ON "SubjectAssignment"("subjectId", "status");

CREATE INDEX "SubjectAssignment_kind_key_status_idx"
    ON "SubjectAssignment"("kind", "key", "status");

ALTER TABLE "SubjectAssignment"
    ADD CONSTRAINT "SubjectAssignment_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubjectCredential"
    ADD CONSTRAINT "SubjectCredential_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
