# PATS catalog read contract

`GET /api/pats/catalog/products/{productId}` requires the existing bearer authentication boundary and an `x-workspace-id` header. The product is returned only when it is linked to a project in that workspace; the PATS query applies the workspace predicate directly rather than trusting client display data.

The route keeps the existing workspace-membership authorization middleware. The PATS-only profile can start without the legacy database, but authenticated catalog requests still require the existing membership service until workspace identity is deliberately reconciled into PATS; this pass does not change that security boundary.

The response keeps sparse data explicit:

- `models` and each model's `modelParts` are always arrays.
- `sourceReference` and `modelName` may be `null`.
- `imageUrl` is always present as either a short-lived private MinIO read URL or `null`.
- An optional private `imageObjectKey` may be carried in source metadata for the current boundary; it is consumed server-side and never returned. Its durable asset ownership remains `NEEDS_CONFIRMATION` and is not a new catalog relation in this pass.
- A missing object returns `imageUrl: null`; an unavailable object-storage operation returns `503` with `errorCode: PATS_IMAGE_STORAGE_UNAVAILABLE`.
- A product not linked to the requested workspace returns `404`; an invalid or missing workspace header returns `400`.

The route is read-only and does not fall back to legacy `app/product` data, demo seed records, initials, display names, or filenames.
