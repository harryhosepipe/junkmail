# API Boundary Rules

This document defines enforceable API layering rules for `api/src`.

## Layering

- `features/*/http/routes.ts` owns HTTP-only concerns: request parsing, auth checks, status mapping.
- Feature route handlers call feature-local services/use-cases (`features/*/services/*` or `application/*`).
- Shared infra adapters stay outside routes (`convex/*`, `storage/*`, `queue/*`).
- Legacy `api/src/routes/*.ts` wrappers are not allowed.

## Error Shape

- Error responses must use `jsonError()` or `toErrorResponse()`.
- Error envelope shape is:
  - `error.code`
  - `error.message`
  - `requestId`
- Routes must not inline custom `{ error: ... }` JSON payloads.

## Testing Expectations

- Every feature route module must have route-level tests under `api/src/tests/routes`.
- Minimum coverage is enforced by prefix mapping (for example `voting -> votes*.test.ts`, `auth -> auth.*.test.ts`).
- New feature routes must include tests in the same change set.

## Enforcement

- `bun run check:api-boundaries` validates:
  - route import boundaries,
  - no legacy wrapper files,
  - error response pattern usage,
  - route test coverage presence.
