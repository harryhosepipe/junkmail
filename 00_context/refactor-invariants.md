# Refactor Invariants (Phase 0 Baseline)

This document captures behavior that must remain stable during the refactor sequence in
`00_context/refactor-plan.md`.

## Uploads

- `POST /api/v1/uploads/complete` with a valid pending upload:
  - stores the original file in object storage,
  - writes Convex image content state with `status: "processing"`,
  - enqueues image processing,
  - returns `200` with `{ uploadId, imageId, status: "processing" }`.
- `POST /api/v1/uploads/complete` for an upload already finalized as `public` or `rejected`:
  - returns current terminal state payload,
  - does not write storage, update content, or enqueue processing.

## Image Delete

- `DELETE /api/v1/images/:id` for missing image returns `404` with `"Image not found"`.
- Successful delete:
  - removes image graph metadata via Convex,
  - attempts object deletion for all discovered storage keys,
  - returns `200` with `deletedCounts` and storage summary `{ attempted, deleted, failed }`.
- Partial storage deletion failures do not fail the route; response remains successful with failure counts.

## Vote Submit

- `POST /api/v1/votes` accepted token flow:
  - writes vote event,
  - enqueues projection job,
  - returns `200` with `ok: true`, `acceptedForScoring: true`.
- Rejected token flows (`rejected_replay`, `rejected_invalid_token`, `rejected_expired`):
  - still write vote event with validation metadata,
  - do not enqueue projection,
  - return `200` with `acceptedForScoring: false` and the validation status.
- If queue enqueue fails for an accepted vote, route falls back to direct projection and still returns success.

## Matchup

- `GET /api/v1/matchups/next` returns `404` when there are fewer than two candidate public images.
- When candidates exist, route returns `200` with two distinct images and a matchup token.
