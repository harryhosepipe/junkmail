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

3. Start local services (Postgres + Redis + MinIO + Caddy)

```bash
bun run dev
```

This also starts the dev servers (API + web + worker) and Convex behind Caddy.

Visit:

- Web: `http://web.localhost`
- API (direct): `http://api.localhost`
- MinIO (direct): `http://minio.localhost`

Convex setup (required for realtime migration work)

```bash
bun run convex:codegen
bun run convex:check
```

Environment values used by the Convex check:

- `CONVEX_URL` for server-side calls
- `CONVEX_ADMIN_KEY` for admin-authenticated server calls
- `PUBLIC_CONVEX_URL` for browser usage

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

Use the printed `https://...trycloudflare.com` URL. Voting and images should work through the same hostname.

## Local Infrastructure

Ports

- Postgres: 5433
- Redis: 6379
- MinIO API: 9010
- MinIO Console: 9011

Credentials (dev)

- Postgres: user `junkmail`, password `junkmail`, db `junkmail`
- MinIO: access key `minio`, secret key `minio123`, bucket `junkmail`

Common commands

- Start services: `docker compose up -d`
- Stop services: `docker compose down`
- View status: `docker compose ps`

## Architecture Overview

- `web/`: Astro frontend
- `api/`: Hono API
- Postgres + Redis + MinIO (local infra via docker-compose in phase 1)

## Telegram Photo Ingest (Optional)

You can ingest photos posted to a private Telegram group/channel via a bot webhook.

1. Create a bot with `@BotFather`, add it to your private group.
2. Set env vars (see `.env.example`):
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ALLOWED_CHAT_IDS` (comma-separated)
   - `TELEGRAM_WEBHOOK_SECRET_TOKEN` (optional but recommended)
3. Set the bot webhook to `API_BASE_URL/api/v1/telegram/webhook` and (if configured) pass the same secret token.
