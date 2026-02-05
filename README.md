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

3. Run API and web

```bash
npm run dev:api
npm run dev:web
```

4. Start local services

```bash
docker compose up -d
```

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
