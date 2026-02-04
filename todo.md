# Junkmail v1 - TODO

> Public gallery of junkmail images with fast pairwise voting, invite-only uploads, anonymous voting, deadpan UI, and SEO-first public pages. :contentReference[oaicite:1]{index=1}

---

## Git Workflow (Per Phase)

- [x] Create a new branch for each phase (e.g. `phase-01-setup`, `phase-02-backend`)
- [ ] Keep commits focused within the phase scope
- [x] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge the phase branch back into `main` only after verification
- [ ] Delete phase branch after merge (local and remote)

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
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Delete phase branch (local and remote)

---

## 1) Local Infrastructure (Dev First)

- [x] Create phase branch (phase-02-local-infra)
- [x] Create `docker-compose.yml` for:
  - [x] Postgres
  - [x] Redis
  - [x] MinIO (S3-compatible) + bucket init
- [x] Start services (`docker compose up -d`)
- [x] Verify services: connect to Postgres, Redis ping, MinIO console access
- [x] Add DB migration strategy (Drizzle migrations) and scripts
- [x] Add queue framework wiring (BullMQ) with Redis connection
- [x] Document ports, credentials, and common dev commands
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Delete phase branch (local and remote)

---

## 2) Backend Foundations (Hono + Drizzle)

- [ ] Create phase branch (phase-03-backend-foundations)
- [ ] Scaffold Hono API (`/api/v1` base) with:
  - [ ] Request logging
  - [ ] Error handler + consistent JSON error format
  - [ ] CORS policy (tight in prod, relaxed in dev)
- [ ] Set up Drizzle + Postgres connection and test query
- [ ] Implement DB schema + migrations:
  - [ ] `users` (invite-only uploader role)
  - [ ] `images` (status, URLs/variants JSON)
  - [ ] `votes` (pairwise winner, hashes)
  - [ ] `ratings` (score, uncertainty, comparisons_count)
- [ ] Seed script:
  - [ ] Create uploader user(s) and invite tokens
  - [ ] Insert sample images (dev-only) + initial ratings
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Delete phase branch (local and remote)

---

## 3) Object Storage + Media Pipeline (Sharp + MinIO)

- [ ] Create phase branch (phase-04-media-pipeline)
- [ ] Define storage layout (paths per image id, variants per size/format)
- [ ] Implement server-side upload handling:
  - [ ] Validate MIME type (JPG/PNG only)
  - [ ] Enforce max file size (10-15MB)
  - [ ] Write original to MinIO
  - [ ] Create `images` row with `status=processing`
- [ ] Implement BullMQ worker:
  - [ ] Pull original from MinIO
  - [ ] Generate variants: AVIF + WebP + (optional) optimized JPG/PNG
  - [ ] Generate sizes: thumb, feed, full
  - [ ] Store variants in MinIO
  - [ ] Update `images.variant_urls` and set `status=public`
- [ ] Implement responsive delivery contract:
  - [ ] Return variant URLs suitable for `srcset`, lazy loading
- [ ] Add retry + dead-letter strategy (at least logging + backoff)
- [ ] Add a simple admin-only script/endpoint to reprocess an image (dev-only)
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Delete phase branch (local and remote)

---

## 4) Auth (Magic Link, Invite-Only Uploads)

- [ ] Create phase branch (phase-05-auth)
- [ ] Decide email delivery for magic links (provider + API keys)
- [ ] Implement Auth endpoints:
  - [ ] `POST /api/v1/auth/request-link` (accept email, send link)
  - [ ] `GET /api/v1/auth/verify?token=...` (set session cookie, redirect)
  - [ ] `POST /api/v1/auth/logout`
- [ ] Enforce invite-only rule:
  - [ ] Only emails present in `users` with role `uploader` may request links
  - [ ] Store/validate one-time token with expiry
- [ ] Implement session management:
  - [ ] Secure, HttpOnly cookie
  - [ ] CSRF considerations for state-changing endpoints
- [ ] Protect endpoints:
  - [ ] `POST /api/v1/images` uploader-only
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Delete phase branch (local and remote)

---

## 5) Voting + Ranking Engine (Bradley-Terry Online Updates)

- [ ] Create phase branch (phase-06-voting-engine)
- [ ] Implement ranking state:
  - [ ] Initialize new images with neutral score + high uncertainty
  - [ ] Maintain `ratings` row per image
- [ ] Implement `POST /api/v1/votes`:
  - [ ] Validate: `image_a_id`, `image_b_id`, `winner_id`, `seed`
  - [ ] Enforce "no ties" (winner must be A or B)
  - [ ] Record vote row
  - [ ] Update ratings via online Bradley-Terry gradient step
  - [ ] Increment `comparisons_count` for both images
- [ ] Implement voter identity hashing:
  - [ ] `voter_hash` from cookie-based id
  - [ ] `ip_hash` from IP (hash at ingestion; never store raw IP)
- [ ] Implement abuse prevention basics:
  - [ ] Rate limit vote endpoint by `ip_hash` + `voter_hash`
  - [ ] Server-side throttling rules (burst + sustained)
  - [ ] Optional escalation hook for CAPTCHA (stub in v1)
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Delete phase branch (local and remote)

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
- [ ] Delete phase branch (local and remote)

---

## 7) Read APIs + Caching

- [ ] Create phase branch (phase-08-read-apis)
- [ ] Implement `GET /api/v1/images/top?limit=50`:
  - [ ] Sort by score
  - [ ] Filter by `comparisons_count >= threshold` (10-20 default) :contentReference[oaicite:2]{index=2}
  - [ ] Include vote appearances and thumb URL
- [ ] Implement `GET /api/v1/images/{id}`:
  - [ ] Return variants, votes, score
- [ ] Implement `GET /api/v1/feed/home`:
  - [ ] Return `{ matchup, feed }` (recent + top blend)
- [ ] Add caching strategy:
  - [ ] Cache toplist for 60-120s in Redis :contentReference[oaicite:3]{index=3}
  - [ ] Cache matchup selection inputs lightly (avoid stale bias)
- [ ] Add performance checks: vote endpoint p50 < 300ms target :contentReference[oaicite:4]{index=4}
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Delete phase branch (local and remote)

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
  - [x] `/i/[id]` Image detail (full image + vote count + share metadata)
  - [x] `/upload` Upload (gated)
  - [x] `/login` Magic link request/verify UX
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Delete phase branch (local and remote)

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
- [ ] Delete phase branch (local and remote)

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
- [ ] Delete phase branch (local and remote)

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
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Delete phase branch (local and remote)

---

## 12) SEO First-Class (Public Pages + Crawlers)

- [ ] Create phase branch (phase-13-seo)
- [ ] Add per-page metadata (title/description/canonical)
- [ ] Add OpenGraph + Twitter card tags on:
  - [ ] Home
  - [ ] Toplist
  - [ ] Image detail (image preview, description, url)
- [ ] Implement:
  - [ ] `GET /sitemap.xml` including `/`, `/top`, and all public `/i/{id}` :contentReference[oaicite:6]{index=6}
  - [ ] `GET /robots.txt` :contentReference[oaicite:7]{index=7}
- [ ] Ensure SSG/SSR outputs are crawlable and fast
- [ ] Verify share previews (OG validators)
- [ ] Verify phase works end-to-end (tests or manual checks)
- [ ] Merge phase branch back into `main`
- [ ] Delete phase branch (local and remote)

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
- [ ] Delete phase branch (local and remote)

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
- [ ] Delete phase branch (local and remote)

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
- [ ] Delete phase branch (local and remote)

---

## Defaults to Decide (Record Decisions Here)

- [ ] Comparisons threshold for toplist inclusion (default 10-20) :contentReference[oaicite:12]{index=12}
- [ ] Ranking learning rate + uncertainty update rule
- [ ] Matchup blend percentages (new/close/random)
- [ ] Rate limit values (per minute/per hour) + escalation triggers
- [ ] Magic link token TTL + resend policy
- [ ] Image sizes for thumb/feed/full
