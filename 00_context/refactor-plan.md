# Junkmail Refactor Plan

This plan aligns the codebase with `00_context/guidelines.md`, focusing on reduced blast radius, explicit state ownership, clearer workflows, and maintainable boundaries.

## Objectives

- Reduce coupling between HTTP, domain logic, persistence, and infra integrations.
- Establish explicit ownership for state transitions (especially image lifecycle and voting projection).
- Replace CRUD-style mutation surfaces with intent-first commands where practical.
- Improve local discoverability of module context/invariants.
- Preserve current runtime behavior while refactoring incrementally.

## Non-goals

- No rewrite of frontend UX or major feature changes.
- No immediate schema redesign that requires risky data migration unless needed for invariants.
- No broad framework/library swap.

## Current pain points (from code audit)

1. Image flows combine domain logic + HTTP response shaping + storage + queue orchestration in the same service paths.
2. Some infra concerns leak into routes (e.g., direct S3 delete command in route handler).
3. Convex content module exposes broad CRUD-like mutation APIs (`upsert`, `set*`) that blur invariants.
4. Boundary documentation is sparse (root README only).

## Guiding constraints

- Keep PRs small and independently shippable.
- Maintain backward-compatible HTTP responses during transition.
- Preserve queue fallback behavior for vote projection durability.
- Refactor behind existing route contracts first; only then adjust external response models if needed.

---

## Phase 0: Baseline and Safety Nets

### Deliverables

- Add baseline tests (or extend existing tests) around current behavior for:
  - uploads (happy path + duplicate paths)
  - image delete behavior (metadata + storage deletion reporting)
  - vote submit behavior (accepted/rejected + queue fallback path)
- Add a short "Refactor invariants" doc with current expected behavior before edits.

### File targets

- `api/src/routes/images.delete.test.ts`
- `api/src/routes/votes.test.ts`
- `api/src/routes/matchups.test.ts`
- `00_context/refactor-invariants.md` (new)

### Exit criteria

- Existing behavior has test coverage sufficient to detect regressions during boundary extraction.

---

## Phase 1: Establish Feature Boundaries in API (without moving files yet)

### Deliverables

- Introduce explicit application-level use-case modules that own workflows.
- Keep routes thin: auth/validation -> use-case call -> response mapping.
- Move infra side effects out of routes (storage deletion from route into use-case/service boundary).

### Proposed module shape

- `api/src/application/images/`
  - `UploadImage.ts`
  - `DeleteImage.ts`
  - `CreateImageComment.ts`
  - `GetImageDetail.ts`
- `api/src/application/voting/`
  - `SubmitVote.ts`
  - `GetNextMatchup.ts`

### Initial migration targets

- Refactor `api/src/routes/images.ts` to remove direct S3 dependency.
- Split `api/src/services/images/actions.ts` into focused command/query use-case files.
- Keep `api/src/services/images/perceptualHash.ts` as a domain utility dependency.

### Exit criteria

- Routes no longer import SDK clients directly for business operations.
- Each endpoint path calls a named use-case function with a single entrypoint.

---

## Phase 2: Clarify State Ownership in Convex

### Deliverables

- Replace broad mutation names with explicit state-transition commands.
- Enforce valid transition checks in one owning module per entity.
- Restrict write paths for image status transitions and vote projection states.

### Candidate API changes (internal first)

- In `convex/content.ts`:
  - Deprecate `upsertImage` (internal usage replacement)
  - Add intent-first commands like:
    - `recordImageUploadReceived`
    - `markImageProcessingComplete`
    - `markImageRejected`
    - `recordImageFingerprint`
- In `convex/voting.ts`:
  - Keep existing workflow verbs (`validateAndConsumeMatchupToken`, `createVoteEvent`, `projectVoteEvent`) as canonical.
  - Add explicit transition guards where missing (idempotency + status guards already partly present).

### API-client wrapper changes

- Update `api/src/convex/content.ts` wrappers to mirror new verb-based commands.
- Keep compatibility wrappers temporarily for incremental migration.

### Exit criteria

- Image and voting writes happen through explicit command names.
- No call sites rely on generic upsert for workflow-critical transitions.

---

## Phase 3: Model Separation (Domain vs Persistence vs HTTP)

### Deliverables

- Define domain models/types independent from HTTP response DTOs.
- Define explicit mappers:
  - persistence row -> domain entity
  - domain entity/result -> HTTP response DTO
- Remove `httpStatus` and HTTP error payload shaping from core domain logic.

### File targets

- New:
  - `api/src/domain/images/types.ts`
  - `api/src/domain/voting/types.ts`
  - `api/src/presentation/http/images/mappers.ts`
  - `api/src/presentation/http/votes/mappers.ts`
- Refactor:
  - `api/src/services/images/actions.ts` (or replacement use-case files)
  - `api/src/services/votes/submitVote.ts`
  - `api/src/routes/images.ts`
  - `api/src/routes/votes.ts`

### Exit criteria

- Domain workflows return domain results (not HTTP-shaped objects).
- Routes own HTTP status code mapping and response envelope shaping.

---

## Phase 4: Context Documentation per Boundary

### Deliverables

Add boundary READMEs that document ownership, invariants, dependencies, and tradeoffs:

- `api/src/application/README.md`
- `api/src/domain/README.md`
- `api/src/convex/README.md`
- `api/src/storage/README.md`
- `convex/README.md`
- `web/src/README.md` (frontend data flow and API contract assumptions)

### README template (required sections)

- Owns
- Invariants
- Depends on
- Does not own
- Tradeoffs

### Exit criteria

- Every non-trivial boundary has discoverable context docs matching guideline #12.

---

## Cross-cutting standards to enforce during refactor

- Keep env usage constrained to shared loaders/approved files (existing guardrails remain mandatory).
- Prefer action/verb naming over CRUD in new or modified workflows.
- Avoid adding abstraction layers unless they reduce coupling or are reused by at least 2 concrete consumers.
- Keep third-party SDK types/imports at infra edges (`storage`, `queue`, adapters).

## Validation and quality gates per phase

Run after each phase branch/PR:

```bash
bun run check
bun run test
bun run convex:check
```

Plus targeted checks where relevant:

```bash
bun --cwd api test
bun --cwd api typecheck
bun --cwd web typecheck
```

## Suggested rollout order (PR sequence)

1. `PR-1`: baseline tests + invariants doc.
2. `PR-2`: thin routes + extract image/vote use-cases, no behavior change.
3. `PR-3`: Convex explicit command API + wrapper migration + compatibility shims.
4. `PR-4`: domain/result DTO separation and mapper introduction.
5. `PR-5`: boundary READMEs and final cleanup (remove deprecated wrappers).

## Risks and mitigations

- Risk: behavior drift in upload duplicate handling.
  - Mitigation: lock current response behavior with route tests before refactor.
- Risk: queue/projection edge-case regressions.
  - Mitigation: preserve existing fallback path and add explicit tests for enqueue failure.
- Risk: migration churn from renamed Convex mutations.
  - Mitigation: temporary compatibility wrappers in `api/src/convex/*` and staged callsite migration.

## Completion definition

Refactor is complete when:

- Routes are orchestration-only (HTTP concerns only).
- Domain/application workflows are explicit commands with bounded dependencies.
- Convex writes are command-based with clear ownership/invariants.
- Boundary docs exist and are current.
- `bun run check`, `bun run test`, and `bun run convex:check` pass.
