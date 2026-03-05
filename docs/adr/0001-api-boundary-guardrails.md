# ADR-0001: API Boundary Guardrails

- Status: Accepted
- Date: 2026-02-24

## Context

The API was incrementally migrated from `api/src/routes/*` and shared `services/*` modules toward feature-first boundaries. Without guardrails, regressions can reintroduce cross-layer coupling and inconsistent error envelopes.

## Decision

Adopt explicit, automated guardrails for API boundaries:

1. Keep `api/src/routes/*.ts` as compatibility re-exports only.
2. Require feature routes to depend on feature-local services/use-cases instead of direct imports from `api/src/services/*`.
3. Enforce a single error envelope shape via `jsonError()`/`toErrorResponse()`.
4. Require route-level tests for every feature route module.

These rules are enforced by `tools/check-api-boundaries.mjs` and executed via `bun run check:api-boundaries` (and `bun run check`).

## Consequences

- Pros:
  - Prevents architectural drift.
  - Keeps route handlers thin and easier to review.
  - Makes error behavior consistent for frontend consumers and logs.
- Cons:
  - Adds guardrail maintenance when route/test naming evolves.
  - Requires explicit feature-local wrappers during incremental migration.
