# Junkmail

Public gallery of junkmail images with fast pairwise voting, invite-only uploads, and SEO-first public pages.

## Local Development

1. Install deps

```bash
npm install
```

2. Copy env

```bash
cp .env.example .env.local
```

The API and worker load `.env.local` automatically.
If you prefer `environment.local`, that is loaded too.

3. Run API and web

```bash
npm run dev:api
npm run dev:web
```

Convex setup (required for realtime migration work)

```bash
npm run convex:codegen
npm run convex:check
```

Environment values used by the Convex check:

- `CONVEX_URL` for server-side calls
- `CONVEX_ADMIN_KEY` for admin-authenticated server calls
- `PUBLIC_CONVEX_URL` for browser usage

Realtime voting validation

```bash
npm run validate:realtime -w api
```

This simulates ~100 concurrent voters (`REALTIME_TEST_USERS`, default `100`), checks vote latency and propagation latency SLOs, and validates leaderboard consistency from Convex ratings.

4. Start local services

```bash
docker compose up -d
```

## Single-Origin Gateway (Cloudflare Tunnel Friendly)

The web dev server now proxies API and image traffic so one public origin works end-to-end:

- `/` -> Astro web (`localhost:4321`)
- `/api/*` -> API (`localhost:8787`)
- `/assets/*` -> MinIO (`localhost:9010`)

This removes the need to rotate `PUBLIC_API_BASE_URL` or `MINIO_PUBLIC_URL` every time a random tunnel URL changes.

Run:

```bash
npm run dev:api
npm run dev:web
cloudflared tunnel --url http://localhost:4321
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
