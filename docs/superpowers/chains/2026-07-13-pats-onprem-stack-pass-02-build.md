# Pass 2: API Build Normalization

## Depends On
Pass 1 baseline report: `docs/superpowers/reports/2026-07-13-pats-onprem-stack-baseline.md`.

## Objective
Make API install, build, and production startup deterministic with pnpm, Node 20, port 3000, and `dist/server.js`.

## Scope
- Touch only: `package.json`, `pnpm-lock.yaml`, `Dockerfile`, `webpack.config.js`, `.env.example`, `nginx.conf`, `tsconfig.json` only when required, and `tests/build-contract.spec.ts`.
- Do not touch: `app/**`, `prisma/**`, `prisma/pats/**`, seeds, auth, legacy route registration, Compose services, the sibling app repository, or unrelated tests.

## Instructions
1. Write `tests/build-contract.spec.ts` to assert the production script, Webpack output filename, API port default, and Docker package-manager contract; run it red against the current files.
2. Change Docker to use Corepack and the repository's pnpm lockfile with a frozen install, while retaining a multi-stage non-root runtime.
3. Change Webpack and `package.json` so the production artifact is `dist/server.js` and the production command starts `node dist/server.js`; standardize the internal API port to `3000` across `.env.example` and nginx if nginx remains in use.
4. Run the focused test, `pnpm run lint`, `pnpm run type-check`, `pnpm test`, `pnpm run build`, and `git diff --check`.
5. Review the changed-file list, commit only the listed files, and report the exact Node version used for verification.

## Deliverable
A passing build-contract suite, a successful API build that emits `dist/server.js`, and a production command/configuration that agrees on port `3000` without adding PATS domain behavior.

## Self-Check Gate (pass-specific)
- [ ] `pnpm install --frozen-lockfile` is the Docker dependency-install path.
- [ ] `dist/server.js` exists after build and `package.json` starts it.
- [ ] API configuration, Compose-facing configuration, nginx, and frontend-local assumptions agree on port `3000`.
- [ ] Focused build contract, lint, typecheck, existing tests, and build pass.
- [ ] No PATS route, migration, seed, schema, or app UI file changed.
- [ ] No scope creep beyond files listed above.

## Stop Conditions
Agent stops and reports back (does not proceed) if:
- The repository cannot run the gate under Node 20.
- Webpack output cannot be changed without changing runtime behavior outside this pass.
- A production port cannot be standardized without an unresolved deployment decision.
- The build requires legacy schema or seed changes to pass.
