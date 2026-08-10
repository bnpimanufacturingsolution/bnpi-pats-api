-- Additive-only extension so retry replays can preserve Location/ETag contracts.
ALTER TABLE "IdempotencyRecord"
ADD COLUMN "responseHeaders" JSONB;
