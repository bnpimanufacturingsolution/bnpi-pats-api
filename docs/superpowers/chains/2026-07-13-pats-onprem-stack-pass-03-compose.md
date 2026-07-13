# Pass 3: Docker Compose On-Prem Infrastructure

## Depends On
Pass 2 build-normalization commit and passing build gate.

## Objective
Provide a reproducible local on-prem Compose stack for API, PostgreSQL, and MinIO with persistence and readiness checks.

## Scope
- Touch only: `docker-compose.yml`, `.env.example`, `.dockerignore`, `README.md` infrastructure sections, and `tests/compose-contract.spec.ts`.
- Do not touch: application source, Prisma schemas, migration files, seeds, auth, legacy Mongo route behavior, frontend files, production deployment files, or public bucket policy.

## Instructions
1. Write `tests/compose-contract.spec.ts` to assert required services, named volumes, health checks, port 3000, private MinIO configuration, and Redis's opt-in status; run it red against the current Compose file.
2. Add PostgreSQL 16 with a named volume and `pg_isready` health check.
3. Add MinIO with a named volume, pinned image reference, API/console ports, health check, and a private bucket-init service.
4. Add the API service on internal port 3000 and make it depend on database and MinIO readiness; keep legacy Mongo outside the base PATS profile.
5. Keep Redis behind an opt-in Compose profile and document that it is not required for base startup.
6. Run `docker compose config`, build the API image, start PostgreSQL and MinIO, verify health and bucket initialization, bring the services down without deleting named volumes, run the focused test, and run `git diff --check`.
7. Commit only the listed Compose/infrastructure files.

## Deliverable
`docker compose config` succeeds and the base stack can build/start API dependencies with persistent PostgreSQL and private MinIO storage while Redis remains optional.

## Self-Check Gate (pass-specific)
- [ ] PostgreSQL, MinIO, and API services are defined with pinned images and health/readiness checks.
- [ ] Named volumes survive `docker compose down`.
- [ ] MinIO bucket initialization completes without anonymous/public access.
- [ ] Base startup does not require Redis or legacy Mongo.
- [ ] Compose contract test and Docker configuration validation pass.
- [ ] No scope creep beyond files listed above.

## Stop Conditions
Agent stops and reports back (does not proceed) if:
- Docker is unavailable or cannot build the API image.
- A required infrastructure image cannot be pinned or pulled in the approved environment.
- The host ports are already owned by an unrelated process and cannot be changed safely.
- MinIO private-bucket initialization requires an unresolved security decision.

