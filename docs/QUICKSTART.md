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

- Web (direct Astro): `http://localhost:4321`
- Web (Caddy front door): `https://web.localhost`
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

- `https://web.localhost`
- `https://api.localhost`
- `https://convex.localhost`

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

## Local HTTPS Trust (Windows + WSL2)

Caddy now serves local hostnames over HTTPS with a local CA. Export the CA cert from the running Caddy container:

```bash
# First request triggers cert generation:
# open https://web.localhost once in your browser.
bun run dev:infra:export-caddy-ca
```

Then import that cert in Windows PowerShell:

```powershell
# Elevated (recommended)
Import-Certificate -FilePath "C:\path\to\caddy-local-root-ca.crt" -CertStoreLocation Cert:\LocalMachine\Root

# Or current user only (no elevation)
Import-Certificate -FilePath "C:\path\to\caddy-local-root-ca.crt" -CertStoreLocation Cert:\CurrentUser\Root
```

Recovery after cert rotation or Docker volume reset:

1. `docker compose down`
2. `docker volume rm junkmail_caddy_data junkmail_caddy_config` (only if you intentionally reset Caddy cert state)
3. `bun run dev:infra`
4. `bun run dev:infra:export-caddy-ca`
5. Re-import the new cert in Windows trust store
