# Bandai PATS Single-Operational-Context Design Revision Plan

**Status:** DESIGN-ONLY REVISION PLAN

**Date:** 2026-07-15

## Objective

Revise the PATS design package for the current on-prem operating assumption: one PATS
installation tracks one operational production context, normally one physical assembly line.
Remove accidental SaaS multi-tenancy semantics from the canonical design while preserving a
clear, migration-safe path to multiple lines later if that becomes a confirmed requirement.

This revision must complete before any Prisma, migration, application, generated, seed,
deployment, or frontend implementation.

## Working recommendation under review

- `Workspace` is not a canonical PATS tenant or public resource.
- A single deployment has one operational context; users are authorized by capabilities within
  that deployment, not by workspace membership.
- `ProductionLine` may be retained as an internal/domain identity only if the physical line has
  meaningful business identity or a future deployment may contain multiple lines.
- The first implementation should not expose `/workspaces`, workspace selection, cross-tenant 404
  behavior, composite tenant FKs, or membership administration unless multiple lines in one
  database are explicitly confirmed.
- If multi-line operation is later accepted, introduce an explicit line/site scope through a
  planned migration rather than preloading SaaS tenancy into the first schema.

This recommendation remains `WORKING_DEFAULT` until the user accepts or changes it.

## Scope

In scope:

- decision register and evidence/context updates for D-001/D-002;
- architecture and bounded-context identity/authorization revision;
- normalized schema ownership, scope, identity, and FK revision;
- endpoint catalog and cross-cutting authorization/path revision;
- implementation plan and schema handover revision;
- explicit prompts, pass reports, unresolved conditions, and consistency review.

Out of scope:

- Prisma schema or migrations;
- application source, routes, controllers, tests, generated artifacts, seeds, deployment, or
  frontend files;
- accepting identity-provider, role, quantity, asset, retention, topology, or other unrelated
  open decisions without explicit user confirmation;
- production data or a multi-line migration.

## Revision passes

1. Operational-context decision lock: classify Workspace, Line, deployment scope, and future
   multi-line support without silently claiming multi-tenancy.
2. Domain and persistence revision: revise identity, authorization assignment, catalog ownership,
   normalized relations, constraints, indexes, and the schema handover's first task.
3. API, architecture, and operations revision: remove workspace-specific paths and membership
   assumptions, define deployment-context authorization, and preserve future evolution boundaries.
4. Consistency review and implementation handover: cross-check all canonical documents, update
   the implementation plan and handover prompts, record remaining blockers, and verify no
   prohibited file changed.

## Required outputs

- This plan;
- one revision chain record;
- four pass prompts and four pass reports;
- revised canonical design documents;
- an updated schema normalization handover;
- no runtime or persistence implementation.

## Approval gate

The revision chain may complete as design. Implementation remains blocked until the user explicitly
approves the revised design and implementation phase. The next implementation task must be derived
from the revised handover, not from the previous Workspace-based handover.
