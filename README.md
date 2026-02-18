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

2. Create local env:

```bash
cp .env.example .env.local
```

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

- Web (direct Astro): `http://localhost:4321`
- Web (recommended via Caddy): `https://web.localhost`
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
bun run test
bun run fmt
```

`bun run check` includes env guardrails:

- Direct `process.env` usage is blocked outside approved env loader/config files.
- Escape hatches are allowed for test and migration files.
- `.env.example` keys must stay aligned with `packages/config/src/env.schema.ts`.

## Caddy + Staging Tunnel

Caddy routes one origin for local and tunnel usage:

- `https://web.localhost/` -> web (`localhost:4321`)
- `https://web.localhost/api/*` -> API (`localhost:8787`)
- `https://web.localhost/assets/*` -> MinIO (`minio:9000`)
- `https://convex.localhost/` -> Convex backend (`convex-backend:3210`)

Start tunnel workflow:

```bash
bun run dev:staging
```

This creates a `trycloudflare.com` URL and starts infra + apps with origin env vars aligned to that URL.

## WSL2 + Docker Desktop Note

If Caddy in Docker cannot reach host-run API/web, `web.localhost` routes may return `502`.

Use direct localhost origins in `.env.local` for auth links:

```dotenv
WEB_ORIGIN=http://localhost:4321
API_ORIGIN=http://localhost:8787
CORS_ORIGIN=http://localhost:4321
```

Then restart API/worker and request a new magic link.

## HTTPS Trust in Windows (WSL2)

Export Caddy's local root CA cert:

```bash
# First request triggers cert generation:
# open https://web.localhost once in your browser.
bun run dev:infra:export-caddy-ca
```

Then import into Windows trust store (PowerShell):

```powershell
# Elevated (recommended)
Import-Certificate -FilePath "C:\path\to\caddy-local-root-ca.crt" -CertStoreLocation Cert:\LocalMachine\Root

# Or current user only
Import-Certificate -FilePath "C:\path\to\caddy-local-root-ca.crt" -CertStoreLocation Cert:\CurrentUser\Root
```

If certs rotate or Caddy volumes reset, export/import again.

## Telegram Photo Ingest (Optional)

1. Create a bot with `@BotFather`, add it to your private group/channel.
2. Set `.env.local` values:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ALLOWED_CHAT_IDS`
   - `TELEGRAM_WEBHOOK_SECRET_TOKEN` (recommended)
3. Set webhook to:
   - `${API_ORIGIN}/api/v1/telegram/webhook`
