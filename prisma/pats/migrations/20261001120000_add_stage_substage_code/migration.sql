-- Server-authored business code for Stage and SubStage, so the UI can show a
-- human-meaningful code instead of an opaque id (display-human-readable-codes).
--
-- Both columns are added NULLABLE and deliberately NOT backfilled: a code is
-- client/ops-authored, and inventing one (abbreviating the name, e.g.
-- "Injection" -> "INJ") is exactly the client-fabricated scheme the principle
-- forbids. Null renders as "no code yet"; it never falls back to the id.
--
-- No unique index is added: uniqueness is a product decision that belongs with
-- whoever authors the codes, and adding it later is a separate migration.
ALTER TABLE "Stage" ADD COLUMN "code" TEXT;
ALTER TABLE "SubStage" ADD COLUMN "code" TEXT;