# Junkmail Production-Readiness Plan

## Summary

This plan treats the current working tree as source of truth and focuses on making the application production-ready, maintainable, and safe to extend by a mixed-seniority team.

Primary outcomes:

- Lower cognitive load and clearer ownership boundaries.
- Faster, safer feature delivery through consistent patterns.
- Better reliability, observability, and performance without weakening security.

Current baseline:

- API tests pass (`58/58`).
- `bun run check` currently fails due to formatting drift.
- Main maintainability hotspots are oversized modules in Convex, queue processing, and large Svelte components.

## Baseline Snapshot (2026-02-23)

- `bun run test`: passing (`14` files, `58` tests).
- `bun run check`: passing (Prettier, ESLint, env guardrails, API/config/web typechecks).
- Lint hardening added:
  - `@typescript-eslint/no-explicit-any` enforced by default.
  - Exceptions scoped to legacy interoperability files and tests for incremental cleanup.

## Prioritized Improvements

| Priority | Improvement                                    | Impact | Effort |   Risk | Recommendation                                                                                 |
| -------- | ---------------------------------------------- | -----: | -----: | -----: | ---------------------------------------------------------------------------------------------- |
| P0       | CI hygiene and repo consistency                |   High |  Small |    Low | Fix current formatting drift and enforce formatting/lint in CI as a hard gate.                 |
| P1       | Simplify API boundaries                        |   High | Medium |    Low | Remove pass-through wrappers; standardize `route -> use-case -> adapters`.                     |
| P2       | Split monolithic Convex content module         |   High |  Large | Medium | Break `convex/content.ts` into focused modules with explicit ownership and invariants.         |
| P3       | Reduce Convex adapter boilerplate              |   High | Medium | Medium | Consolidate repetitive function-reference wrappers and centralize typed adapters.              |
| P4       | Eliminate unsafe typing patterns               |   High | Medium |    Low | Remove `as any` in app code via typed context variables and strict helper boundaries.          |
| P5       | Extract frontend API client and feature stores |   High | Medium |    Low | Move fetch/orchestration out of large Svelte components into shared clients/stores.            |
| P6       | Unify validation and contracts                 | Medium | Medium |    Low | Centralize request/response contracts for query/body parsing and error envelopes.              |
| P7       | Decompose queue processors + observability     | Medium | Medium | Medium | Split processing pipeline stages and add structured logs/timings/correlation IDs.              |
| P8       | Dependency maintenance policy                  | Medium |  Small |    Low | Keep stack, remove redundant abstractions, and add regular dependency/security review cadence. |
| P9       | Feature-oriented folder migration              | Medium |  Large | Medium | Migrate incrementally to feature slices while preserving current API behavior.                 |

## Overengineering Check

Keep:

- `Hono`, `BullMQ`, `Convex`, `Astro + Svelte`, `sharp`, `zod`.
- These are appropriate for current scope and runtime needs.

Simplify:

- Trivial wrapper layers with no behavioral value.
- Redundant manual adapter code that increases maintenance burden.
- Cross-cutting `any` usage that bypasses TypeScript guarantees.

Avoid introducing:

- New framework-level architecture layers (IoC containers, heavy CQRS frameworks, extra data layers).

## Stack and Dependency Audit

### Keep and refine

- `convex`: Keep, but reduce adapter boilerplate and enforce clearer write/read module ownership.
- `@aws-sdk/client-s3`: Keep, centralize calls in storage adapter boundary.
- `bullmq` + `ioredis`: Keep, standardize retry/backoff and queue telemetry in one place.
- `sharp`: Keep, isolate expensive image operations and concurrency controls.

### Tooling improvements

- Tighten TypeScript linting (`no-explicit-any`, unsafe access/assignment rules in app code).
- Keep exceptions narrowly scoped to test/interop layers.

### Replace/remove

- No major runtime library replacement needed now.
- Main complexity reduction comes from deleting redundant internal abstractions.

## Performance Without Sacrificing Security

### Quick wins

1. Add short-lived cache headers (`ETag`, `Cache-Control`) for read-heavy public endpoints.
2. Use shared frontend API client with request dedupe and consistent error handling.
3. Tune queue concurrency with explicit limits per worker type.

### Deeper improvements

1. Narrow Convex query payloads and validate index usage for hot reads.
2. Improve upload/image pipeline memory behavior where possible.

### Risky optimizations to avoid

1. Bypassing CSRF or origin checks for speed.
2. Weakening upload/vote validation logic.
3. Over-optimistic UI flows that hide server rejection states.

## Target Architecture

### API target structure

```text
api/src/
  features/
    auth/
      routes.ts
      useCases/
      contracts.ts
      mappers.ts
    voting/
      routes.ts
      useCases/
      contracts.ts
      mappers.ts
    images/
      routes.ts
      useCases/
      contracts.ts
      mappers.ts
      dedupe/
    uploads/
      routes.ts
      useCases/
      contracts.ts
      mappers.ts
    featureRequests/
      routes.ts
      useCases/
      contracts.ts
      mappers.ts
  adapters/
    convex/
      client.ts
      auth.ts
      images.ts
      voting.ts
      featureRequests.ts
    storage/
      s3Client.ts
      publicUrls.ts
    queue/
      queues.ts
      workers/
  platform/
    http/
      app.ts
      errors.ts
      context.ts
      validation.ts
    env/
      index.ts
```

### Web target structure

```text
web/src/
  features/
    voting/
      components/
      api.ts
      store.ts
      types.ts
    uploads/
      components/
      api.ts
      store.ts
      types.ts
    images/
      components/
      api.ts
      types.ts
    auth/
      components/
      api.ts
      store.ts
      types.ts
    featureRequests/
      components/
      api.ts
      store.ts
      types.ts
  shared/
    components/
    lib/
      apiClient.ts
      convexClient.ts
      env.ts
    styles/
  pages/
  layouts/
```

### Convex target structure

```text
convex/
  images/
    queries.ts
    commands.ts
    dedupe.ts
    comments.ts
  voting/
    queries.ts
    commands.ts
  auth/
    commands.ts
    queries.ts
  users/
    queries.ts
    commands.ts
  featureRequests/
    queries.ts
    commands.ts
  schema.ts
```

## Planned Interface and Contract Changes

1. Preserve existing HTTP endpoint paths and payloads during migration phases.
2. Normalize error responses so every endpoint returns:
   - `error.code`
   - `error.message`
   - `requestId`
3. Standardize internal use-case inputs/outputs with explicit feature-level types.
4. Ensure external I/O only happens through adapter interfaces.

## Test Cases and Scenarios

1. Route contract tests:
   - Auth (`request-link`, `verify`, `logout`, profile read/update)
   - Votes (happy path, replay, mismatch, rate limiting)
   - Uploads (init/complete/status, exact+near duplicate, failure paths)
   - Feature requests (list/create auth and validation)

2. Use-case unit tests:
   - Each feature workflow with mocked Convex/S3/Redis boundaries.

3. Queue tests:
   - Process retries, idempotency, and fallback behavior for vote projection.

4. Security tests:
   - CSRF/origin enforcement in production mode.
   - Session cookie behavior and auth guard correctness.

5. Performance checks:
   - Latency budget tracking for read-heavy endpoints.
   - Queue throughput and retry/failure rate monitoring.

## Rollout Plan

1. Phase 1: Hygiene and safety nets
   - Fix formatting drift.
   - Enforce stricter lint/type rules where safe.

2. Phase 2: Boundary simplification
   - Remove pass-through wrappers.
   - Lock in canonical handler pattern.

3. Phase 3: Convex and queue decomposition
   - Split large modules into feature-owned files.
   - Migrate callsites incrementally.

4. Phase 4: Frontend extraction
   - Introduce shared API client and feature stores.
   - Shrink large Svelte components.

5. Phase 5: Folder migration
   - Move to feature-oriented structure in manageable slices.

6. Phase 6: Hardening and docs
   - Add boundary docs/ADRs.
   - Ensure observability and quality standards are enforced.

## Rules of the Codebase

1. Routes own HTTP; use-cases own workflow; adapters own third-party I/O.
2. No new `any` in app code except narrowly-scoped interop boundaries.
3. Keep files small and purpose-specific (split before they become hotspots).
4. No direct SDK calls in route handlers.
5. Contract-first changes: update types, mappers, and tests together.
6. Preserve backward compatibility by default unless explicitly versioning.
7. Include `requestId` in error responses and structured logs for async jobs.
8. Security controls are mandatory and cannot be traded for micro-performance gains.

## Assumptions and Defaults

1. No full rewrite, no framework swap.
2. Existing API contracts remain stable during refactor.
3. Current dirty worktree is intentional and in scope.
4. Convex remains system of record for runtime data.
5. Delivery speed and safety are prioritized over architecture purity.
