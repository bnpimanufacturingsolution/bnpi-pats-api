-- Durable canonical idempotency claims and completed responses.
-- This migration is prepared for isolated validation only; it is not applied by this pass.

CREATE TABLE "CatalogIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" INTEGER,
    "responseBody" JSONB,
    "responseHeaders" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogIdempotencyRecord_actorId_operation_idempotencyKey_key"
    ON "CatalogIdempotencyRecord"("actorId", "operation", "idempotencyKey");
CREATE INDEX "CatalogIdempotencyRecord_createdAt_idx" ON "CatalogIdempotencyRecord"("createdAt");
