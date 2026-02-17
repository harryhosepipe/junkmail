# Junkmail

Public gallery of junkmail images with fast pairwise voting, invite-only uploads, and SEO-first public pages.

## Local Development

1. Install deps

```bash
bun install
```

2. Copy env

```bash
cp .env.example .env.local
```

The API and worker load `.env.local` automatically.
If you prefer `environment.local`, that is loaded too.

3. Start local services (Redis + MinIO + Convex + Caddy)

```bash
bun run dev
```

This starts:

- Infra in Docker (Redis + MinIO + Convex + Caddy)
- App dev servers on your host (API + web + worker)

If this is your first run (or after wiping Docker volumes), initialize the MinIO bucket once:

```bash
bun run dev:infra:init-storage
```

Run only some services (host-run)

```bash
bun run dev:infra

# API
bun --cwd api dev

# Worker
bun --cwd api worker
```

Visit:

- Web: `http://localhost:4321` (or `http://web.localhost` via Caddy)
- API (direct): `http://localhost:8787` (or `http://api.localhost` via Caddy)
- MinIO (direct): `http://localhost:9010` (or `http://minio.localhost` via Caddy)
- Convex (direct): `http://localhost:3210` (or `http://convex.localhost` via Caddy)
- Convex dashboard: `http://localhost:6791`

Convex setup (required for realtime migration work)

```bash
bun run convex:codegen
bun run convex:check
```

Environment values used by the Convex check:

- `CONVEX_URL` for server-side calls
- `CONVEX_ADMIN_KEY` for admin-authenticated server calls
- `PUBLIC_CONVEX_URL` (optional) for browser usage; the web app defaults to same-origin `/convex` proxying to avoid mixed content when using a tunnel

Convex function env policy:

- Convex functions read runtime env directly (Convex limitation), but variable names are kept aligned with `packages/config` and `.env.example` (e.g. `BRADLEY_TERRY_K`, `RATING_INITIAL_SCORE`).

Realtime voting validation

```bash
bun run validate:realtime -w api
```

This simulates ~100 concurrent voters (`REALTIME_TEST_USERS`, default `100`), checks vote latency and propagation latency SLOs, and validates leaderboard consistency from Convex ratings.

## Caddy Front Door (Stable Hostnames + Cloudflare Tunnel Friendly)

Caddy is the stable front door for local dev, so you can use consistent hostnames and tunnel a single origin.

Routes:

- `http://web.localhost/` -> Astro web (`localhost:4321`)
- `http://web.localhost/api/*` -> API (`localhost:8787`)
- `http://web.localhost/assets/*` -> MinIO (`minio:9000`)
- `http://api.localhost/` -> API (`localhost:8787`)
- `http://minio.localhost/` -> MinIO (`minio:9000`)
- `http://convex.localhost/` -> Convex (`convex-backend:3210`)
- Convex dashboard: `http://localhost:6791`

Run:

```bash
bun run dev:staging
```

This starts a quick `trycloudflare.com` tunnel to Caddy (the single entrypoint), prints the public URL, starts the local infra stack, and then starts the host app dev servers (web + api + worker) with `APP_ORIGIN` set to that URL.

On WSL2 + Docker Desktop, the script also sets `DEV_UPSTREAM_HOST` to your WSL VM IP so Caddy (in Docker) can reach the host-run dev servers.

## Local Infrastructure

Ports

- Redis: 6379
- MinIO API: 9010
- MinIO Console: 9011

Credentials (dev)

- MinIO: access key `minio`, secret key `minio123`, bucket `junkmail`

Common commands

- Start services: `make infra-up` (or `docker compose up -d`)
- Stop services: `make infra-down` (or `docker compose down`)
- View status: `make infra-ps` (or `docker compose ps`)

Quality

```bash
bun run check
bun run test
bun run fmt
```

Session-end (ship)

```bash
make ship
```

## Architecture Overview

- `web/`: Astro frontend
- `api/`: Hono API
- Redis + MinIO + Convex (local infra via docker-compose)

## Telegram Photo Ingest (Optional)

You can ingest photos posted to a private Telegram group/channel via a bot webhook.

1. Create a bot with `@BotFather`, add it to your private group.
2. Set env vars (see `.env.example`):
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ALLOWED_CHAT_IDS` (comma-separated)
   - `TELEGRAM_WEBHOOK_SECRET_TOKEN` (optional but recommended)
3. Set the bot webhook to `API_BASE_URL/api/v1/telegram/webhook` and (if configured) pass the same secret token.
