# Junkmail

Public gallery of junkmail images with invite-only uploads, pairwise voting, and Convex-backed runtime data.

## Stack

- `web/`: Astro frontend
- `api/`: Hono API + BullMQ worker
- Infra: Redis + MinIO + Convex (Docker Compose)
- Front door: Caddy (Docker, optional for local hostnames/tunnel)

No Postgres is used by the runtime.

For a short setup path, see `docs/QUICKSTART.md`.

## Quick Start

1. Install dependencies:

```bash
bun install
```

2. Create local env per app:

```bash
cp api/.env.example api/.env
cp web/.env.example web/.env
cp convex/.env.example convex/.env
```

Each app also owns committed defaults in `.env.defaults`:

- `api/.env.defaults`
- `web/.env.defaults`
- `convex/.env.defaults`
  Runtime layering is `defaults -> app env file -> process env`.

3. Start everything:

```bash
bun run dev
```

This runs Docker infra plus host dev servers (`api`, `web`, `worker`).

4. First run only (or after Docker volume reset), initialize storage bucket:

```bash
bun run dev:infra:init-storage
```

Open:

- Web (recommended): `http://localhost:4321`
- API direct: `http://localhost:8787`
- MinIO API: `http://localhost:9010`
- MinIO Console: `http://localhost:9011`
- Convex backend: `http://localhost:3210`
- Convex dashboard: `http://localhost:6791`

## Dev Commands

```bash
# Infra only (docker)
bun run dev:infra

# Apps only (host)
bun run dev:apps

# API / worker
bun --cwd api dev
bun --cwd api worker:dev

# Convex checks
bun run convex:codegen
bun run convex:check

# Quality
bun run check
bun run check:api-boundaries
bun run check:deps
bun run check:deps:upstream
bun run test
bun run fmt
```

`bun run check` includes env guardrails:

- Direct `process.env` usage is blocked outside approved env loader/config files.
- Escape hatches are allowed for test and migration files.
- `api/.env.example` keys must stay aligned with `packages/config/src/env.schema.ts`.

`bun run check` also includes API boundary guardrails:

- `api/src/routes/*` must remain thin compatibility re-exports.
- Feature routes must use standardized error envelopes and keep route test coverage.

Dependency governance policy and security cadence:

- `docs/dependency-governance.md`
- `docs/security/upstream-language-server-advisories.md`

## Local Host + Staging Tunnel

Local host entrypoint:

- `http://127.0.0.1:4321/` -> web dev server
- `http://127.0.0.1:4321/api/*` -> proxied to API (`localhost:8787`)
- `http://127.0.0.1:4321/assets/*` -> proxied to MinIO (`localhost:9010`)

Start tunnel workflow:

```bash
bun run dev:staging
```

This creates a `trycloudflare.com` URL and starts infra + apps with origin env vars aligned to that URL.

## WSL2 + Docker Desktop Note

If Caddy in Docker cannot reach host-run API/web while tunneling, tunnel routes may return `502`.

Use direct localhost origins in `api/.env` for auth links:

```dotenv
WEB_ORIGIN=http://127.0.0.1:4321
API_ORIGIN=http://127.0.0.1:4321
```

Then restart API/worker and request a new magic link.

## HTTPS in Local Dev

Current local setup is HTTP only. If secure local HTTPS is needed, track follow-up issue `junkmail-w77` (Caddy local CA trust workflow for Windows/WSL2).

## Telegram Photo Ingest (Optional)

1. Create a bot with `@BotFather`, add it to your private group/channel.
2. Set `api/.env` values:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ALLOWED_CHAT_IDS`
   - `TELEGRAM_WEBHOOK_SECRET_TOKEN` (recommended)
3. Set webhook to:
   - `${API_ORIGIN}/api/v1/telegram/webhook`
