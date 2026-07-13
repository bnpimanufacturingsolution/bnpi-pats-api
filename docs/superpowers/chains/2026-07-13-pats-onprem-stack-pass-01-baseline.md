# Pass 1: Baseline and Scope Lock

## Depends On
None.

## Objective
Produce a verified baseline report and an explicit file boundary for the API build-normalization pass.

## Scope
- Touch only: `docs/superpowers/reports/2026-07-13-pats-onprem-stack-baseline.md`
- Do not touch: application source, Prisma schemas, seeds, Dockerfiles, Compose files, package manifests, the sibling app repository, running user processes, and environment secrets.

## Instructions
1. Read `README.md`, `package.json`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `webpack.config.js`, `prisma/pats/schema.prisma`, and the sibling app's required WWG files when assessing frontend impact.
2. Record current branches, working-tree state, Node/pnpm/Docker/Compose versions, lockfiles, API listener port, frontend local API base URL, Docker production artifact, and whether PostgreSQL or MinIO are already available.
3. Record the exact mismatches: pnpm declaration versus Docker npm install, `dist/server.ts` versus the desired JavaScript artifact, and 3000/3001 port divergence.
4. List the exact files allowed in Pass 2 and the files that remain protected.
5. Run `git diff --check` and create the focused commit for this report.

## Deliverable
`docs/superpowers/reports/2026-07-13-pats-onprem-stack-baseline.md` containing the evidence, allowed-file boundary, exact environment versions, and a clean API working-tree result.

## Self-Check Gate (pass-specific)
- [ ] The API branch and working-tree state are recorded.
- [ ] The app's existing dirty files are listed and explicitly excluded.
- [ ] Package manager, lockfile, port, artifact, Docker, and service availability evidence is recorded.
- [ ] No source, schema, seed, environment secret, or app file was changed.
- [ ] No scope creep beyond the report file listed above.

## Stop Conditions
Agent stops and reports back (does not proceed) if:
- The API working tree contains uncommitted changes that cannot be identified as part of this chain.
- The app's existing dirty files cannot be separated from the proposed stack work.
- The active API port or process ownership cannot be established without stopping a user process.
- Docker or Compose availability cannot be determined.

