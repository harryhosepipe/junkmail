# Quickstart

## Prerequisites

- Bun
- Docker + Docker Compose

## Boot Local Dev

```bash
bun install
cp .env.example .env.local
bun run dev
```

If uploads fail on a fresh Docker volume, run bucket bootstrap once:

```bash
bun run dev:infra:init-storage
```

## Endpoints

- Web: `http://localhost:4321`
- API: `http://localhost:8787`
- MinIO API: `http://localhost:9010`
- MinIO Console: `http://localhost:9011`
- Convex backend: `http://localhost:3210`
- Convex dashboard: `http://localhost:6791`

## Common Commands

```bash
# Infra only
bun run dev:infra

# Apps only
bun run dev:apps

# API and worker
bun --cwd api dev
bun --cwd api worker:dev

# Checks
bun run convex:codegen
bun run convex:check
bun run check
bun run test
```

## Caddy and Tunnel

Use Caddy hostnames when routing works in your environment:

- `http://web.localhost`
- `http://api.localhost`
- `http://convex.localhost`

For public webhook/auth testing via Cloudflare tunnel:

```bash
bun run dev:staging
```

## WSL2 Troubleshooting

If `web.localhost` returns `502`, Dockerized Caddy likely cannot reach host-run app ports.

Set these in `.env.local` and restart API/worker:

```dotenv
WEB_ORIGIN=http://localhost:4321
API_ORIGIN=http://localhost:8787
CORS_ORIGIN=http://localhost:4321
```

Then request a new magic link (old emails may contain stale hostnames).
