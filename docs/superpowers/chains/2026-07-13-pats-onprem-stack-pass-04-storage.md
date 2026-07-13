# Pass 4: MinIO Object-Storage Boundary

## Depends On
Pass 3 Compose stack with a healthy private MinIO bucket.

## Objective
Create a tested object-storage boundary that allows PATS modules to use MinIO without importing MinIO directly or exposing buckets publicly.

## Scope
- Touch only: `app/storage/object-storage.ts`, `app/storage/minio-object-storage.ts`, `tests/object-storage.contract.spec.ts`, `package.json`, `pnpm-lock.yaml`, and storage configuration documentation in `.env.example`.
- Do not touch: Prisma schemas, database models, API routes, frontend files, legacy Cloudinary behavior, public bucket policy, or production deployment configuration.

## Instructions
1. Define `ObjectStorage` operations for `putObject`, `getObject`, `deleteObject`, and `createReadUrl`, including typed metadata and not-found/configuration errors.
2. Write contract tests against a fake implementation first and run them red; add a local MinIO smoke path when the service is available.
3. Implement the MinIO adapter with validated endpoint, TLS, credentials, bucket, content type, byte size, checksum, and approved object-prefix handling.
4. Ensure the adapter never changes bucket policy to public and does not leak root credentials in returned values or logs.
5. Run focused storage tests, the MinIO smoke test, lint, typecheck, and `git diff --check`.
6. Commit only the listed storage files and dependency lock changes.

## Deliverable
Passing object-storage contract tests plus a working MinIO put/get/delete smoke path through the adapter, with clear failures for missing configuration.

## Self-Check Gate (pass-specific)
- [ ] Business modules do not import the MinIO SDK directly.
- [ ] Object keys are restricted to approved PATS prefixes.
- [ ] Content type, size, and checksum metadata are preserved.
- [ ] Missing credentials and missing objects return typed actionable results.
- [ ] Buckets remain private.
- [ ] No scope creep beyond files listed above.

## Stop Conditions
Agent stops and reports back (does not proceed) if:
- MinIO cannot be reached through the Compose network.
- The required storage behavior needs a database metadata model not yet approved.
- A request requires public URLs, Cloudinary behavior, or a provider not in this pass.
- Credential handling would require committing or reading a real secret.

