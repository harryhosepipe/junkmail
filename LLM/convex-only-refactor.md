# Convex-Only Refactor Notes (Historical)

This document is historical context from before the Convex-only migration.
The runtime is now Convex-first and no longer uses Postgres/Drizzle.

At the time this document was written, the repo used a hybrid backend:

- Web: Astro (`web/`)
- API: Hono (`api/`)
- Background: BullMQ workers (`api/src/queue/*`) backed by Redis
- Relational store: Postgres via Drizzle (`api/src/db/*`)
- Object storage: MinIO via S3 client (`api/src/storage/*`)
- Realtime/voting/ratings: Convex (`convex/`, plus API-side Convex client in `api/src/convex/*`)

The goal of a "Convex-only" refactor would be to make Convex the system-of-record for all app data and (optionally) replace most of the bespoke infra (Postgres/Redis/MinIO) with Convex primitives.

This is not currently tracked as a bd epic; existing Convex work (e.g. `junkmail-389`) is explicitly scoped to keep Postgres available.

## What Convex Provides (Relevant Building Blocks)

Convex functions:

- Queries: read-only functions.
- Mutations: transactional write functions.
- Actions: orchestrators that can call queries/mutations and external APIs. Actions can run in a Node.js runtime using `"use node"` for Node APIs / npm packages.

Convex HTTP actions:

- Expose endpoints on Convex.
- Run in the same environment as queries/mutations (no Node.js APIs), but can call Node actions.

Convex file storage:

- Store blobs via `ctx.storage.store(blob)` and fetch via `ctx.storage.get(storageId)`.
- Upload via an HTTP action is currently limited to 20MB request size; serving blobs directly via HTTP action has a 20MB response limit.

## What In This Repo Could Become "Just Convex"

### 1) Replace Postgres tables with Convex tables

Postgres currently stores:

- Users/auth tokens/sessions (`api/src/routes/auth.ts`, `api/src/auth/session.ts`, `api/src/db/schema.ts`).
- Images metadata and lifecycle fields (status, URLs, timestamps) (`api/src/routes/images.ts`, `api/src/routes/telegram.ts`, `api/src/routes/matchups.ts`).
- Comments (`api/src/db/schema.ts`, used by image routes).

A Convex-only version would move these into Convex tables and replace the API's Drizzle calls with Convex queries/mutations.

### 2) Simplify the vote path (optional)

Today:

- API validates a matchup against Postgres and rate-limits via Redis.
- Vote is enqueued in BullMQ.
- Worker performs the Convex vote mutation (`mutateConvexRecordVote`).

A Convex-only path could:

- Record votes directly in Convex (transactional mutation).
- Optionally move more validation + rate limiting into Convex (or keep a minimal API layer just for cookie/IP handling).

### 3) Replace MinIO with Convex file storage (optional)

Current file cap is 15MB (see `MAX_UPLOAD_BYTES` in API routes), which fits Convex's 20MB HTTP action upload limit.

Potential approach:

- Upload original files to Convex storage.
- Store storage IDs (and derived asset metadata) in Convex tables.
- Serve files via Convex HTTP actions with access control at request time.

Tradeoff:

- If large images or future video uploads exceed 20MB, you'd need the "upload URL" flow (or keep S3/MinIO).

### 4) Replace the image-processing worker with Convex Node actions (risky/validate early)

Current worker (`api/src/queue/worker.ts`):

- Downloads original from S3/MinIO
- Uses `sharp` to generate variants (avif/webp + fallback)
- Uploads variants to S3/MinIO
- Updates Postgres with `variantUrls` and `status`

Convex-only idea:

- HTTP action accepts upload (or issues upload URLs)
- Store original in Convex storage
- Node action (with `"use node"`) runs `sharp` and stores variants + metadata
- Convex mutation updates image record status + variant references

Key risk:

- `sharp` is a native module. Even though Convex supports Node runtime actions, validate native module compatibility and resource limits early (especially if moving off self-hosted Convex).

## What Would Disappear In A True Convex-Only End State

- Postgres container and Drizzle tooling (`api/src/db/*`, `api/drizzle*`, `DATABASE_URL` usage).
- Redis + BullMQ queue (unless retained for rate limiting/cooldowns outside Convex).
- MinIO/S3 client usage (`api/src/storage/*`) if replaced with Convex storage.
- Most (or all) of the Hono API if Astro talks to Convex directly and file endpoints move to Convex HTTP actions.

## Lowest-Risk Migration Order (Suggested)

1. Images metadata (system-of-record) -> Convex.
2. Comments -> Convex.
3. Auth decision:
   - Use Convex auth identity (`ctx.auth.getUserIdentity()`), or
   - Keep external auth but store app state in Convex.
4. MinIO -> Convex storage.
5. Worker -> Convex Node action pipeline; remove Redis/BullMQ if no longer needed.

## Concrete Repo Hotspots To Touch For A Migration

- Postgres:
  - `api/src/db/client.ts`
  - `api/src/db/schema.ts`
  - `api/src/routes/auth.ts`
  - `api/src/routes/images.ts`
  - `api/src/routes/matchups.ts`
  - `api/src/routes/telegram.ts`
  - `api/src/auth/session.ts`
  - `api/src/queue/worker.ts` (updates Postgres for image processing)
- Redis/BullMQ:
  - `api/src/queue/*`
  - `api/src/routes/votes.ts` (rate limiting + enqueue)
  - `api/src/routes/matchups.ts` (pool caching + cooldown keys)
- MinIO/S3:
  - `api/src/storage/*`
  - Upload/download calls in `api/src/routes/images.ts`, `api/src/routes/telegram.ts`, `api/src/queue/worker.ts`
- Convex:
  - Existing tables in `convex/schema.ts`: `userProfiles`, `imageRatings`, `votes`
  - Existing API-side client: `api/src/convex/client.ts`
