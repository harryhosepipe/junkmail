# Junkmail v1 - TODO

> Public gallery of junkmail images with fast pairwise voting, invite-only uploads, anonymous voting, deadpan UI, and SEO-first public pages. :contentReference[oaicite:1]{index=1}

---

## Git Workflow (Per Phase)

Rules (must be followed before starting a phase and after completing a phase):

- Create a new branch for each phase (e.g. `phase-01-setup`, `phase-02-backend`).
- Keep commits focused within the phase scope.
- Work one todo at a time (finish before moving on).
- Run a quick smoke test after each significant feature before proceeding.
- Confirm env config is loaded during smoke tests (e.g., MINIO_PUBLIC_URL).
- Verify the phase works end-to-end (tests or manual checks).
- Merge the phase branch back into `main` only after verification.
- Keep phase branches (do not delete) from phase-05 onward.

---

## 0) Repo + Project Setup

- [x] Create phase branch (phase-01-setup)
- [x] Create monorepo structure (or two repos) for `web/` (Astro) and `api/` (Hono)
- [x] Initialize Node.js + TypeScript workspaces, shared lint/format config
- [x] Add basic tooling: ESLint, Prettier, typecheck scripts, CI workflow
- [x] Install dependencies (`npm install`)
- [x] Add `.gitignore` (node_modules, dist, .env.local, .astro, .DS_Store)
- [x] Pin Node version (`.nvmrc` or `.tool-versions`)
- [x] Decide env management (`.env.example`, `.env.local`, secrets in CI)
- [x] Add README with local dev steps + architecture overview
- [x] Verify phase works end-to-end (tests or manual checks)
- [x] Merge phase branch back into `main`
- [x] Delete phase branch (local and remote)

---

## 1) Local Infrastructure (Dev First)

- [x] Create phase branch (phase-02-local-infra)
- [x] Check for port conflicts (Postgres 5432, MinIO 9000) and adjust if needed
- [x] Create `docker-compose.yml` for:
  - [x] Postgres
  - [x] Redis
  - [x] MinIO (S3-compatible) + bucket init
- [x] Start services (`docker compose up -d`)
- [x] Verify services: connect to Postgres, Redis ping, MinIO console access
- [x] Add DB migration strategy (Drizzle migrations) and scripts
- [x] Add queue framework wiring (BullMQ) with Redis connection
- [x] Document ports, credentials, and common dev commands
- [x] Check port availability before choosing port mappings
- [x] Verify phase works end-to-end (tests or manual checks)
- [x] Merge phase branch back into `main`
- [x] Delete phase branch (local and remote)

---

## 2) Backend Foundations (Hono + Drizzle)

- [x] Create phase branch (phase-03-backend-foundations)
- [x] Load .env.local automatically in API/worker (dotenv)
- [x] Scaffold Hono API (`/api/v1` base) with:
  - [x] Request logging
  - [x] Error handler + consistent JSON error format
  - [x] CORS policy (tight in prod, relaxed in dev)
- [x] Set up Drizzle + Postgres connection and test query
- [x] Implement DB schema + migrations:
  - [x] `users` (invite-only uploader role)
  - [x] `images` (status, URLs/variants JSON)
  - [x] `votes` (pairwise winner, hashes)
  - [x] `ratings` (score, uncertainty, comparisons_count)
- [x] Seed script:
  - [x] Create uploader user(s) and invite tokens
  - [x] Insert sample images (dev-only) + initial ratings
- [x] Verify phase works end-to-end (tests or manual checks)
- [x] Merge phase branch back into `main`
- [x] Delete phase branch (local and remote)

---

## 3) Object Storage + Media Pipeline (Sharp + MinIO)

- [x] Create phase branch (phase-04-media-pipeline)
- [x] Define storage layout (paths per image id, variants per size/format)
- [x] Implement server-side upload handling:
  - [x] Validate MIME type (JPG/PNG only)
  - [x] Enforce max file size (10-15MB)
  - [x] Write original to MinIO
  - [x] Create `images` row with `status=processing`
- [x] Implement BullMQ worker:
  - [x] Pull original from MinIO
  - [x] Generate variants: AVIF + WebP + (optional) optimized JPG/PNG
  - [x] Generate sizes: thumb, feed, full
  - [x] Store variants in MinIO
  - [x] Update `images.variant_urls` and set `status=public`
- [x] Implement responsive delivery contract:
  - [x] Return variant URLs suitable for `srcset`, lazy loading
- [x] Add retry + dead-letter strategy (at least logging + backoff)
- [x] Add a simple admin-only script/endpoint to reprocess an image (dev-only)
- [x] Smoke test: upload sample image and verify MinIO variants
- [x] Verify phase works end-to-end (tests or manual checks)
- [x] Merge phase branch back into `main`
- [x] Delete phase branch (local and remote)

---

## 4) Auth (Magic Link, Invite-Only Uploads)

- [x] Create phase branch (phase-05-auth)
- [x] Decide email delivery for magic links (provider + API keys) - Resend
- [x] Implement Auth endpoints:
  - [x] `POST /api/v1/auth/request-link` (accept email, send link)
  - [x] `GET /api/v1/auth/verify?token=...` (set session cookie, redirect)
  - [x] `POST /api/v1/auth/logout`
- [x] Enforce invite-only rule:
  - [x] Only emails present in `users` with role `uploader` may request links
  - [x] Store/validate one-time token with expiry
- [x] Implement session management:
  - [x] Secure, HttpOnly cookie
  - [x] CSRF considerations for state-changing endpoints
- [x] Protect endpoints:
  - [x] `POST /api/v1/images` uploader-only
- [x] Finish magic-link email delivery test (Resend sender verified)
- [x] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## 5) Voting + Ranking Engine (Bradley-Terry Online Updates)

- [x] Create phase branch (phase-06-voting-engine)
- [x] Implement ranking state:
  - [x] Initialize new images with neutral score + high uncertainty
  - [x] Maintain `ratings` row per image
- [x] Implement `POST /api/v1/votes`:
  - [x] Validate: `image_a_id`, `image_b_id`, `winner_id`, `seed`
  - [x] Enforce "no ties" (winner must be A or B)
  - [x] Record vote row
  - [x] Update ratings via online Bradley-Terry gradient step
  - [x] Increment `comparisons_count` for both images
- [x] Implement voter identity hashing:
  - [x] `voter_hash` from cookie-based id
  - [x] `ip_hash` from IP (hash at ingestion; never store raw IP)
- [x] Implement abuse prevention basics:
  - [x] Rate limit vote endpoint by `ip_hash` + `voter_hash`
  - [x] Server-side throttling rules (burst + sustained)
  - [x] Optional escalation hook for CAPTCHA (stub in v1)
- [x] Verify phase works end-to-end (tests or manual checks)
- [x] Merge phase branch back into `main`
- [x] Keep phase branch (do not delete)

---

## 6) Matchup Selection (Bias Mitigation + Sampling)

- [ ] Create phase branch (phase-07-matchups)
- [ ] Implement `GET /api/v1/matchups/next`:
  - [ ] Blend selection pools:
    - [ ] New / low exposure images (forced exposure)
    - [ ] Close-ranked pairs for separation
    - [ ] Occasional random pairs to prevent lock-in
  - [ ] Ensure:
    - [ ] Both images are `public`
    - [ ] Not the same image
    - [ ] Avoid immediate repeats for same voter (best effort)
- [ ] Return a `seed` value that must be echoed in `POST /votes`
- [ ] Add metrics logging: selection reason, exposure counts
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## 7) Read APIs + Caching

- [ ] Create phase branch (phase-08-read-apis)
- [ ] Implement `GET /api/v1/images/top?limit=50`:
  - [ ] Sort by score
  - [ ] Filter by `comparisons_count >= threshold` (10-20 default) :contentReference[oaicite:2]{index=2}
  - [ ] Include vote appearances and thumb URL
- [ ] Implement `GET /api/v1/images/{id}`:
  - [ ] Return variants, votes, score
- [x] Implement `GET /api/v1/images/recent?limit=8` for Fresh scans
- [ ] Implement `GET /api/v1/feed/home`:
  - [ ] Return `{ matchup, feed }` (recent + top blend)
- [ ] Add caching strategy:
  - [ ] Cache toplist for 60-120s in Redis :contentReference[oaicite:3]{index=3}
  - [ ] Cache matchup selection inputs lightly (avoid stale bias)
- [ ] Add performance checks: vote endpoint p50 < 300ms target :contentReference[oaicite:4]{index=4}
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## 8) Frontend Foundations (Astro SSR/SSG + Islands)

- [ ] Create phase branch (phase-09-frontend-foundations)
- [x] Create Astro app layout:
  - [x] Global styles (dry/deadpan)
  - [x] Header/footer, nav to Home/Toplist/Upload
- [x] Configure SSR/SSG:
  - [x] Public pages SSR/SSG as appropriate (SEO-first)
  - [ ] Islands for voting module and upload
- [x] Build core routes:
  - [x] `/` Home (vote module + feed)
  - [x] `/top` Toplist (ranked list + counts)
  - [x] `/image/[id]` Image detail (full image + vote count + share metadata)
  - [x] `/upload` Upload (gated)
  - [x] `/login` Magic link request/verify UX
- [ ] Add Svelte integration + islands (auth indicator/login/upload), remove inline scripts
- [x] Add Svelte integration + islands (auth indicator/login/upload), remove inline scripts
- [x] Use Context7 MCP for Astro/Svelte workflow references
- [ ] Hybrid SSR default; prerender public pages with `prerender = true`
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] SSR via adapter: keep output static + prerender public routes
- [ ] Enable Astro view transitions + persist auth indicator
- [ ] Web auth flow checklist:
  - [ ] `/login` submits email and shows "check your email"
  - [ ] Magic link opens and redirects to `/upload` (cookie set)
  - [ ] Invite-only messaging for non-uploader email
  - [ ] `/upload` gated when logged out
  - [ ] Logout clears session and re-gates upload
  - [ ] Handle expired/used token error state on `/login`
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## 9) Voting UX (Fast, No Ties)

- [ ] Create phase branch (phase-10-voting-ux)
- [ ] Create Vote Island component:
  - [ ] Fetch `GET /matchups/next`
  - [ ] Render A vs B with fast click targets
  - [ ] On click, POST `/votes` and immediately fetch next matchup
  - [ ] Handle latency states (optimistic UI, minimal spinner)
  - [ ] Keyboard shortcuts (optional but good for "fast")
- [ ] Implement cookie-based voter id creation on first visit
- [ ] Add "no ties allowed" UX (no tie option exists)
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## 10) Gallery + Image Detail UX

- [ ] Create phase branch (phase-11-gallery-ux)
- [ ] Home feed component:
  - [ ] Mixed recent/top thumbnails
  - [ ] Lazy loading + responsive `srcset`
- [ ] Toplist page:
  - [ ] Ranked list with vote appearances count
  - [ ] Show comparisons/votes as spec requires :contentReference[oaicite:5]{index=5}
- [ ] Image detail page:
  - [ ] Full image variant
  - [ ] Score + vote appearances
  - [ ] Share UI (copy link)
  - [ ] Ensure OpenGraph/Twitter metadata
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## 11) Upload UX (Invite-Only, Minimal Friction)

- [ ] Create phase branch (phase-12-upload-ux)
- [ ] Login page:
  - [ ] Email input -> `POST /auth/request-link`
  - [ ] Confirmation state ("check your email")
- [ ] Verify link behavior:
  - [ ] `GET /auth/verify` sets cookie and redirects to `/upload`
- [ ] Upload page:
  - [ ] File picker (JPG/PNG only)
  - [ ] Size validation before submit
  - [ ] Submit -> `POST /images` multipart
  - [ ] Show "processing" state; poll `GET /images/{id}` until public
  - [ ] After publish, redirect to image detail
- [ ] Upload metadata + preview:
  - [ ] Title + description inputs
  - [ ] Show WebP preview after processing
  - [ ] Store uploader + metadata with image
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## 12) SEO First-Class (Public Pages + Crawlers)

- [ ] Create phase branch (phase-13-seo)
- [ ] Add per-page metadata (title/description/canonical)
- [ ] Add OpenGraph + Twitter card tags on:
  - [ ] Home
  - [ ] Toplist
  - [ ] Image detail (image preview, description, url)
- [ ] Implement:
  - [ ] `GET /sitemap.xml` including `/`, `/top`, and all public `/image/{id}` :contentReference[oaicite:6]{index=6}
  - [ ] `GET /robots.txt` :contentReference[oaicite:7]{index=7}
- [ ] Ensure SSG/SSR outputs are crawlable and fast
- [ ] Verify share previews (OG validators)
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## 13) Hardening + Security

- [ ] Create phase branch (phase-14-hardening)
- [ ] Input validation everywhere (zod or similar)
- [ ] Strict MIME sniffing + file signature checks (not just extension)
- [ ] Ensure no raw IP stored; confirm hashing is irreversible :contentReference[oaicite:8]{index=8}
- [ ] Add security headers (CSP, HSTS, frame-ancestors, etc.)
- [ ] Confirm auth cookies: Secure + HttpOnly + SameSite
- [ ] Abuse prevention:
  - [ ] Tune rate limits
  - [ ] Add suspicious-pattern thresholds and escalation path
- [ ] Add audit logging for uploads + auth events
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## 14) Performance Pass

- [ ] Create phase branch (phase-15-performance)
- [ ] Confirm Home interactive < 2s on mid-tier mobile target :contentReference[oaicite:9]{index=9}
- [ ] Confirm cached toplist response time + proper TTL (60-120s) :contentReference[oaicite:10]{index=10}
- [ ] Ensure image delivery:
  - [ ] AVIF/WebP preferred, fallback available
  - [ ] Correct cache-control headers for variants
- [ ] Add basic observability:
  - [ ] Request timings
  - [ ] Worker job durations/failures
  - [ ] Queue depth alerts (even if just logs for v1)
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## 15) QA + Release

- [ ] Create phase branch (phase-16-qa-release)
- [ ] Write minimal tests:
  - [ ] API contract tests for votes/matchups/top/images
  - [ ] Ranking update sanity tests
- [ ] Manual test checklist:
  - [ ] Anonymous voting loop is instant and stable
  - [ ] New images get exposure (cold start)
  - [ ] Toplist threshold filtering works (10-20 comparisons) :contentReference[oaicite:11]{index=11}
  - [ ] Upload flow end-to-end (magic link -> upload -> processing -> publish)
  - [ ] SEO: sitemap/robots + OG tags on image pages
- [ ] Deployment plan:
  - [ ] Provision Postgres, Redis, MinIO/S3, email provider keys
  - [ ] Set env vars + secrets
  - [ ] Run migrations
  - [ ] Smoke test endpoints + worker
- [ ] Add v1 launch checklist and rollback steps
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Keep phase branch (do not delete)

---

## Defaults to Decide (Record Decisions Here)

- [ ] Comparisons threshold for toplist inclusion (default 10-20) :contentReference[oaicite:12]{index=12}
- [ ] Ranking learning rate + uncertainty update rule
- [ ] Matchup blend percentages (new/close/random)
- [ ] Rate limit values (per minute/per hour) + escalation triggers
- [ ] Magic link token TTL + resend policy
- [ ] Image sizes for thumb/feed/full

---

## Project Rules (Dynamic)

- [ ] Enforce static-by-default; SSR only for auth/session-sensitive pages
- [ ] Keep all client logic in Svelte islands (no inline scripts)
- [ ] SSR-seed auth state on `/login` and `/upload`
- [ ] Persist header auth indicator with view transitions
- [ ] Standardize dev hostnames to avoid cookie/CORS mismatch
- [ ] Build API contract before UI (no mock-only flows)
- [ ] Use layout-stable skeletons to prevent CLS
- [ ] Prefer explicit routes (e.g. `/image/[id]`)
- [ ] Use Context7 MCP for Astro/Svelte updates
