-- D-024 close-out: canonical planning noun is Project. Rename the lifecycle enum type;
-- values are unchanged, so this is non-destructive to stored rows. Historical migrations
-- untouched. New audit/outbox rows use project-* names; pre-existing rows keep theirs.

ALTER TYPE "PlanLifecycleStatus" RENAME TO "ProjectLifecycleStatus";
