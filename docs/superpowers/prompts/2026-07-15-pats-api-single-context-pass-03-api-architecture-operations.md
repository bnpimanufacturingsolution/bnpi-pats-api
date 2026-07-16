# Single-Context Revision Pass 3: API, Architecture, and Operations Revision

Using Passes 1-2, revise the API endpoint catalog, architecture, cross-cutting design, context,
and implementation plan so they no longer assume `/workspaces`, workspace membership, tenant
selection, or cross-tenant 404 behavior for the first deployment.

Define deployment-context authorization, capability checks, object ownership, path strategy,
catalog/configuration ownership, audit scope, asset scope, health/readiness, and future multi-line
evolution. Preserve the approved `/api/v1`, naming, pagination, RFC 9457, concurrency,
idempotency, trace, and deprecation standards. Do not change application or persistence source.
