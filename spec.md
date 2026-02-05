# Junkmail v1 Spec

## Summary

Junkmail is a public gallery of junkmail images with fast pairwise voting to surface a reliable top list. Uploads are invite-only. Voting is anonymous, no ties allowed. The interface is dry, deadpan, and fast. SEO is a first-class requirement.

## Goals

- Publicly browseable, shareable image gallery
- Fun, quick pairwise voting that produces stable rankings
- Invite-only uploads with minimal friction
- Fast image delivery with modern formats
- Strong SEO for all public pages

## Non-goals (v1)

- Admin dashboards or moderation tooling
- User profiles, comments, or social features
- Categories, tags, or advanced metadata
- Paid plans or account management

## Users and Permissions

- Visitor: browse, vote anonymously
- Uploader (invite-only): login via magic link, upload images

## Information Architecture

- Home (mixed): vote module + feed of recent/top images
- Toplist: ranked list + vote counts
- Image Detail: full image, vote count, share metadata
- Upload: gated by login
- Login: magic link request/verify

## Core Flows

1. Visitor voting

- Land on Home
- See a pairwise matchup (A vs B)
- Click to vote (no ties)
- Immediately get next matchup

2. Visitor browsing

- Home feed and Toplist
- Open Image Detail for sharing

3. Uploader

- Request magic link
- Verify link to create session
- Upload image
- Image processed and published

## Voting and Ranking

### Interaction Model

- Pairwise comparisons only
- No ties allowed
- Each vote compares two images and records one winner

### Algorithm (default)

Use Bradley-Terry pairwise ranking.

- Each image has a score S
- P(A beats B) = 1 / (1 + exp(-(S_A - S_B)))
- On vote, update S_A and S_B via online gradient update
- Track uncertainty via comparisons_count; newer images have higher uncertainty

### Bias Mitigation and Sampling

- Cold start: new images seeded with neutral score and forced exposure
- Matchup selection blends:
  - New/low-exposure images
  - Close-ranked images for better separation
  - Occasional random pairs to avoid lock-in
- Toplist ordering uses score with a minimum comparisons threshold

### Display Rules

- Show total vote appearances per image
- Toplist sorted by score, filtered by comparisons_count >= threshold

## Abuse Prevention

- Anonymous voting allowed
- Rate limits by IP hash and cookie-based voter hash
- Server-side throttling on vote endpoint
- Optional escalation: CAPTCHA for suspicious patterns

## Media Pipeline

- Accept JPG/PNG uploads
- Store original + generate AVIF and WebP variants
- Store originals and variants in MinIO
- Generate sizes: thumb, feed, full
- Serve with responsive srcset and lazy loading
- Max file size: 10-15MB

## Data Model (Minimal)

### users

- id (uuid, pk)
- email (text, unique)
- role (text) -- "uploader"
- invite_token (text, unique)
- created_at (timestamp)

### images

- id (uuid, pk)
- uploader_id (uuid, fk users.id)
- status (text) -- "processing", "public"
- original_url (text)
- variant_urls (jsonb) -- {"thumb":..., "feed":..., "full":..., "avif":..., "webp":...}
- created_at (timestamp)

### votes

- id (uuid, pk)
- image_a_id (uuid, fk images.id)
- image_b_id (uuid, fk images.id)
- winner_id (uuid, fk images.id)
- voter_hash (text)
- ip_hash (text)
- created_at (timestamp)

### ratings

- image_id (uuid, pk, fk images.id)
- score (double precision)
- uncertainty (double precision)
- comparisons_count (int)
- updated_at (timestamp)

## API Specification (v1)

Base: /api/v1

### Auth (Magic Link)

- POST /auth/request-link
  - body: {"email":"string"}
  - response: 204
- GET /auth/verify?token=...
  - sets session cookie
  - redirect to /upload
- POST /auth/logout
  - response: 204

### Images

- POST /images
  - auth: uploader
  - body: multipart with file
  - response: {"id":"uuid","status":"processing"}

- GET /images/top?limit=50
  - response: [{"id":"uuid","score":1.23,"votes":120,"thumb_url":"..."}]

- GET /images/{id}
  - response: {"id":"uuid","variants":{...},"votes":120,"score":1.23}

### Voting

- GET /matchups/next
  - response: {"a":{...},"b":{...},"seed":"string"}

- POST /votes
  - body: {"image_a_id":"uuid","image_b_id":"uuid","winner_id":"uuid","seed":"string"}
  - response: {"ok":true}

### Home Feed

- GET /feed/home
  - response: {"matchup":{...},"feed":[...]}

### SEO

- GET /sitemap.xml
- GET /robots.txt

## Frontend (Astro)

- Static output with SSR via adapter; prerender public pages where possible
- Use `export const prerender = true` for public routes
- Use SSR (`prerender = false`) for auth-sensitive pages/layouts
- Use Svelte islands for interactive UI (auth, voting, upload)
- Avoid inline scripts; keep interactivity inside islands
- Client directives: prefer `client:load` for auth/login, `client:visible` for heavier UI
- Enable Astro View Transitions and persist header auth island
- Route naming: use explicit paths (e.g. `/image/[id]`, not `/i/[id]`)
- Fast routes for Home and Toplist
- Metadata for OpenGraph/Twitter
- Use Context7 MCP for Astro/Svelte workflow references
- Keep layouts/pages thin: layout renders static structure, islands handle client state
- Centralize API base URL via `PUBLIC_API_BASE_URL`

## Project Rules (Dynamic)

- Static by default; SSR only where auth/session affects first paint
- All client interactivity lives in Svelte islands; avoid inline scripts
- SSR-seed auth state on auth-sensitive pages (`/login`, `/upload`)
- Persist the header auth indicator across navigation (view transitions)
- Same-host rule for auth cookies (avoid localhost/127 mismatch)
- API contract first, UI follows (no mock-only flows)
- Prevent CLS with layout-stable skeletons/placeholders
- Prefer explicit routes (`/image/[id]`), avoid terse path shorthands
- Use Context7 MCP for Astro/Svelte decisions

## Backend Architecture

- Runtime: Node.js + TypeScript
- HTTP framework: Hono
- ORM: Drizzle
- DB: Postgres
- Cache and queue: Redis + BullMQ
- Image processing: Sharp
- Object storage: MinIO (self-hosted, S3-compatible)
- Background jobs for image processing and maintenance
- Cache for Toplist and matchup selection

## Local Development Notes

- Check port availability before choosing port mappings
- Default local ports: Postgres 5433, Redis 6379, MinIO 9010/9011
- Require MINIO_PUBLIC_URL for correct public URLs
- API and worker must load .env.local (dotenv) in dev
- Smoke tests after feature changes:
  - GET /api/v1/health
  - Upload a sample image and verify variants in MinIO

## Performance Targets

- Home interactive under 2s on mid-tier mobile
- Vote endpoint response under 300ms (p50)
- Toplist cached for 60-120s

## Future Considerations

### Live Toplist Updates

- Goal: near real-time ranking updates even with ~100 concurrent voters.
- Approach: add a live updates channel (SSE or WebSocket) that pushes toplist deltas or full snapshots on a fixed cadence (e.g., every 2-5 seconds).
- Backend: publish a lightweight "toplist updated" event from the vote handler; consumers throttle/batch updates to avoid flooding clients.
- Client: subscribe and smoothly update ranks (animate moves, avoid layout shifts).
- Fallback: if live channel fails, keep polling the cached endpoint.

### Toplist Refresh Countdown

- UI shows a simple countdown like "Final votes tallied in 60 seconds" that tracks the server cache TTL.
- Countdown resets whenever a new toplist snapshot is fetched.

## Security and Privacy

- Hash IPs at ingestion; never store raw IP
- Strict MIME type validation
- Signed upload URLs if direct-to-storage used

## Milestones

1. Foundations
   - Astro app, base layout, routing
   - Backend skeleton + DB
2. Voting MVP
   - Pairwise API, ranking updates, matchup selection
   - Home vote module
3. Upload Pipeline
   - Auth flow, uploads, image processing
4. Public Pages
   - Toplist and image detail
   - SEO metadata + sitemap
5. Hardening
   - Rate limits, caching, basic abuse prevention

## Open Items (v1 defaults)

- Auth: magic link email
- Ranking: Bradley-Terry with uncertainty
- Exposure threshold: 10-20 comparisons before Toplist inclusion
