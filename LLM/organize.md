# Monorepo Rules & Workflow Guide (Astro Web + Hono API + Worker + Convex + Postgres + MinIO + Caddy + Cloudflare Tunnel)

This file defines a clean, repeatable workflow for running a multi-service monorepo with **three environments**:

- `local`
- `staging`
- `production`

The goals:

- One command to run everything
- Root-only environment variables
- Typed/validated env access via **Zod**
- Stable local routing via **Caddy**
- Cloudflare Tunnel exposes **one entrypoint** (Caddy) for staging sharing + webhooks

---

## 1) Non-negotiable principles

1. **Single source of truth for config**
   - All environment variables are defined at the **repo root**.
   - No per-folder env sprawl.

2. **No “magic env loading”**
   - Apps must not depend on current working directory or implicit `.env` behavior.
   - All processes must be started from the repo root (except rare debugging).

3. **Fail fast**
   - Every service must validate env at startup via Zod and crash with a clear error if missing/invalid.

4. **Stable local addresses**
   - Use a local reverse proxy (Caddy) to access services via stable hostnames rather than juggling ports.
   - Ports may remain whatever they are today; **Caddy is the stable front door**.

5. **One entrance for Cloudflare tunnels**
   - Cloudflare Tunnel targets **Caddy only**.
   - Caddy routes traffic to web/api/etc.

6. **One command starts everything**
   - `bun run dev` starts: web + api + worker (+ optional infra)
   - `bun run dev:staging` starts: web + api + worker (+ tunnel)

---

## 2) Canonical repo structure

Use this structure (approved):

repo/
apps/
web/ # Astro
api/ # Hono
worker/ # image ingestion worker
packages/
config/ # shared env loader + Zod schema (single source of env access)
shared/ # shared types/utils (optional)
infra/
docker/ # docker compose files
caddy/ # Caddyfile(s)
cloudflared/ # cloudflared config/scripts (optional)
turbo.json
package.json
.env.example
.env.defaults
.env.local
.env.staging
.env.production

**Rule**: Avoid `.env` files inside `apps/*`.

- Soft exception: if a tool requires it, generate it from root env (never hand-maintain it).

---

## 3) Environments: meaning and rules

### 3.1 `local`

Purpose: active development on your machine.

- Web/API/Worker run locally.
- Datastores/infrastructure may run locally via Docker Compose:
  - Postgres
  - MinIO
  - Convex (depending on your chosen setup)
- No Cloudflare tunnel by default.

Default command:

- `bun run dev` → local

### 3.2 `staging`

Purpose: local dev **pointing to staging cloud services**, plus optional public sharing.

- Web/API/Worker still run locally.
- At least one dependency points to staging cloud (e.g., Convex staging deployment).
- Cloudflare tunnel runs so:
  - friends can access the app
  - Telegram webhook can call back into your running app via a public URL

Command:

- `bun run dev:staging`

### 3.3 `production`

Purpose: deployed on a platform (e.g., Railway / VPS Docker).

- Running via deployment pipeline.
- Production env vars managed by the platform secrets manager (not by local `.env.production` on your laptop).
- Local `.env.production` exists mainly for “build/test-like-prod” workflows.

---

## 4) Root env files: policy and layering

### 4.1 Files

Committed:

- `.env.defaults` — non-secret defaults (safe)
- `.env.example` — documentation of required vars + examples (no secrets)

Not committed (gitignored):

- `.env.local` — local secrets/overrides
- `.env.staging` — staging secrets/overrides
- `.env.production` — production secrets/overrides (rarely used locally; platform secrets preferred)

### 4.2 Layering order

When `APP_ENV=local`:

1. `.env.defaults`
2. `.env.local` overrides

When `APP_ENV=staging`:

1. `.env.defaults`
2. `.env.staging` overrides

When `APP_ENV=production`:

1. `.env.defaults`
2. `.env.production` overrides

**Rule**: no additional env sources unless explicitly added here.

---

## 5) Typed & validated env access (Zod) — REQUIRED

### 5.1 Single entrypoint

All apps must import env from one shared package:

- `packages/config/env.ts` exports `env`
- Apps use: `import { env } from "@repo/config/env"`

Apps must not read `process.env.X` directly (except inside the env loader).

### 5.2 Naming rules

- Only variables safe for the browser use `PUBLIC_` prefix.
- Secrets must never use `PUBLIC_`.
- Prefer consistent prefixes:
  - `APP_` (shared across services)
  - `WEB_`, `API_`, `WORKER_`
  - `CONVEX_`, `POSTGRES_`, `MINIO_`, etc.

### 5.3 Minimum required variables (suggested baseline)

You will likely have (examples; tailor as you implement):

- `APP_ENV` = `local | staging | production`
- `APP_ORIGIN` = canonical origin (public-facing; in staging it can be the tunnel URL)
- `WEB_ORIGIN` = internal stable origin for web via proxy (often `https://web.localhost`)
- `API_ORIGIN` = internal stable origin for api via proxy (often `https://api.localhost`)
- `CONVEX_URL` and/or whatever Convex requires per environment
- `POSTGRES_URL`
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`

### 5.4 `.env.example` rule

When adding any env var:

1. Add it to Zod schema
2. Add it to `.env.example` (with explanation)
3. If it has a safe default, add to `.env.defaults`

---

## 6) Reverse proxy (Caddy): the “stable front door”

You prefer a reverse proxy. Default choice: **Caddy**.

### 6.1 Recommended routing style: hostnames

Use `*.localhost` hostnames for local dev:

- `web.localhost` → Astro (port 4321)
- `api.localhost` → Hono API (whatever it is)
- optionally:
  - `minio.localhost` → MinIO console/api
  - `convex.localhost` → Convex dev UI (if relevant)

Why hostnames:

- Cleaner separation (web vs api vs infra)
- Fewer edge cases than path-based routing
- Mirrors production (subdomains) more naturally

### 6.2 HTTPS locally: recommended

Prefer HTTPS termination at Caddy locally:

- Improves parity with production
- Helps webhooks/callback flows behave realistically

Soft fallback:

- If HTTPS causes early friction, allow HTTP locally temporarily, but aim to switch to HTTPS.

### 6.3 Service-to-service URL rule

Inside your code/config, prefer stable origins:

- Web calls API using `API_ORIGIN` (often `https://api.localhost` in local)
- Worker calls API/Convex using stable origins
- Don’t “bake in ports” unless unavoidable—ports stay behind Caddy

---

## 7) Cloudflare Tunnel: staging-only sharing + webhooks

### 7.1 Golden rule

Cloudflare tunnel must target **Caddy only**:

- Tunnel → Caddy → routes to services

This keeps your setup stable even if internal ports change.

### 7.2 When it runs

- `local`: no tunnel (default)
- `staging`: tunnel runs (default)

### 7.3 Public URL handling

Cloudflare may generate a random URL; this must still work:

- In staging, set `APP_ORIGIN` to the tunnel URL.
- Web/API must rely on `APP_ORIGIN`/`*_ORIGIN` env vars, not hardcoded domains.

### 7.4 Telegram webhook rule (general)

Default approach:

- Webhook hits the **API**.
- API validates signature/secret.
- API forwards to Convex and/or queues worker work as needed.

(If later you decide Convex Actions should receive webhooks directly, update this doc; until then, API is the webhook entrypoint.)

---

## 8) Docker / Compose rules

Docker is used for infra such as:

- Postgres
- MinIO
- Convex (if you’re running parts locally that way)
- other supporting services (e.g., reader server)

Rules:

- Compose files live in `infra/docker/`.
- Compose uses root env files via `env_file` (or environment injection from the root dev runner).
- Prefer a shared Compose network; services can talk by service name.

Ports:

- Keep your current ports.
- Don’t “fight ports” in app config; use Caddy hostnames for stability.

---

## 9) Dev UX: commands & behavior

Preferred command style:

- `bun run dev` → local
- `bun run dev:staging` → staging (local apps + staging pointers + tunnel)
- Worker must be included and auto-restart.

Rules:

- Dev commands run from repo root.
- Turbo (optional but recommended) is used to orchestrate dev scripts across apps.

---

## 10) Turborepo usage (lightweight)

You mainly want Turbo for “run tasks across packages,” not necessarily advanced caching.

Approved:

- Use Turbo to run `dev`, `build`, `lint`, `typecheck` across apps.
- Keep scripts consistent and predictable.

---

## 11) Service boundaries (clear responsibilities)

### 11.1 Web (Astro)

- Uses `PUBLIC_` env vars only for browser-exposed config.
- Server-only secrets are forbidden here.
- Calls API via `API_ORIGIN`.

### 11.2 API (Hono)

- Handles webhooks by default.
- Talks to Convex and Postgres as needed.
- Owns auth/signature validation for inbound webhooks.
- Provides stable endpoints for web and worker.

### 11.3 Worker

- Handles image ingestion/processing logic.
- Auto-restarts in dev.
- Reads all config from the shared env loader.
- Talks to API and/or Convex using stable origins.

### 11.4 Datastores

- Convex is primary application DB.
- Postgres likely stores image metadata or relational needs (allowed).
- MinIO stores objects/blobs (allowed).

---

## 12) LLM guardrails (STRICT)

When generating code, configuration, or scaffolding, the LLM must follow these rules.

### Must do

- ✅ Keep env vars root-only.
- ✅ Add all env vars to `packages/config` Zod schema and export typed `env`.
- ✅ Update `.env.example` for every new env var.
- ✅ Route external access through Caddy.
- ✅ Tunnel only targets Caddy.
- ✅ Use stable origins (`API_ORIGIN`, `APP_ORIGIN`, etc.) and never hardcode tunnel domains.
- ✅ Start web + api + worker from root `dev` commands.

### Must NOT do

- ❌ Do not add/maintain separate `.env` files per app folder.
- ❌ Do not access `process.env` directly outside `@repo/config`.
- ❌ Do not put secrets into `PUBLIC_` env vars or frontend bundles.
- ❌ Do not hardcode Cloudflare-generated URLs into code.

### Soft exception rule

If a dependency requires an env file inside an app:

- It must be generated from root env (scripted), never duplicated and edited manually.

---

## 13) Implementation checklist (next concrete steps)

1. Create `packages/config`:
   - `env.schema.ts` (Zod schemas)
   - `env.ts` (loads env, validates, exports typed `env`)
2. Add root env files:
   - `.env.defaults` (committed)
   - `.env.example` (committed)
   - `.env.local`, `.env.staging`, `.env.production` (gitignored)
3. Add Caddy config under `infra/caddy/`:
   - hostnames: `web.localhost`, `api.localhost`, etc.
4. Add docker compose under `infra/docker/`:
   - Postgres + MinIO + others
   - root-driven env injection
5. Add Turbo + root scripts:
   - `bun run dev` (local)
   - `bun run dev:staging` (staging + tunnel)
6. Add staging tunnel runner:
   - tunnel → caddy only
   - staging sets `APP_ORIGIN` to tunnel URL

---

## 14) Simple mental model (keep it straight)

- Local: “Build and debug locally.”
- Staging: “Run locally, but point at staging cloud dependencies, and share via tunnel.”
- Production: “Deployed and managed by a platform.”

End of file.
