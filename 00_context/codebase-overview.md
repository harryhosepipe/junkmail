# Junkmail Codebase Overview

This document explains the purpose, architecture, and file structure of the `junkmail` repository.

## What this project is

Junkmail is a public image gallery for junkmail photos with:
- Invite-only uploads
- Pairwise voting (choose image A vs B)
- Ranking and feed endpoints backed by Convex
- Background processing for image normalization/deduping

## Tech stack

- Runtime/package manager: Bun workspaces
- Frontend: Astro + Svelte (`web/`)
- API: Hono on Node (`api/`)
- Queue/worker: BullMQ + Redis (`api/src/queue`)
- Runtime data + domain model: Convex (`convex/`)
- Object storage: MinIO/S3-compatible
- Local infra/dev routing: Docker Compose + Caddy + optional Cloudflare tunnel

## High-level architecture

1. Browser loads Astro pages and Svelte components from `web/`.
2. Frontend calls API routes under `/api/v1/*` (Hono app in `api/`).
3. API writes/reads domain data via Convex helper modules in `api/src/convex/*`.
4. Upload/image jobs are queued into BullMQ and processed by worker code in `api/src/queue/*`.
5. Image assets live in MinIO (S3 API); API exposes storage URLs and metadata.
6. Convex schema (`convex/schema.ts`) is the source of truth for app entities.

## Monorepo layout

```text
.
├── 00_context/                 # Project notes and planning docs
├── api/                        # Hono API + queue worker + tests
├── convex/                     # Convex schema and functions
├── infra/                      # Docker, Caddy, tunnel helpers
├── packages/
│   └── config/                 # Shared env loader/schema/spawn helpers
├── tools/                      # Guardrails + external verifier service
├── web/                        # Astro/Svelte frontend
├── .env.defaults               # Baseline env defaults
├── .env.example                # Example env file template
├── .env.local                  # Local development env overrides
├── package.json                # Workspace scripts and top-level commands
└── README.md                   # Main setup and developer instructions
```

## Top-level files and folders

- `README.md`: Setup, local services, main workflows.
- `AGENTS.md`: Agent-specific operating instructions (issue tracking via `bd`, session workflow).
- `package.json`: Workspace scripts:
  - `dev` starts infra + apps
  - `check` runs formatting/lint/type/env guardrails
  - `test` runs API tests
- `Makefile`: Convenience shortcuts.
- `.beads/`: `bd` issue tracker data.

## API (`api/`)

### Main entrypoints

- `api/src/index.ts`: process start; validates env and starts HTTP server.
- `api/src/app.ts`: Hono app composition, middleware, CORS, and route mounting under `/api/v1`.

### Directory structure

```text
api/src
├── auth/                       # Session/csrf/token/email/voter identity helpers
├── contracts/                  # Shared request/response contract types
├── convex/                     # API-side wrappers for Convex reads/writes
├── db/                         # Local scripts (seed/clear)
├── http/                       # HTTP helpers (errors, payload parsing)
├── queue/                      # BullMQ connection, job processors, worker entrypoint
├── routes/                     # HTTP route handlers + route tests
├── scripts/                    # Backfill/check/validation scripts
├── services/
│   ├── auth/                   # Auth domain service logic
│   ├── images/                 # Image actions, cards, pHash/orb verification
│   ├── matchups/               # Matchup payload generation logic
│   └── votes/                  # Vote submit business logic
└── storage/                    # MinIO/S3 client + path/url helpers
```

### Important routes

- `routes/auth.ts`: profile/auth verification endpoints.
- `routes/feed.ts`: feed data for gallery UI.
- `routes/images.ts`: image listing/detail/delete/comment-related operations.
- `routes/uploads.ts`: upload workflow.
- `routes/matchups.ts`: pairwise comparison pair generation.
- `routes/votes.ts`: vote submit endpoint.
- `routes/telegram.ts`: Telegram webhook ingest path.
- `routes/convex.ts`: Convex-facing API utility endpoints.

### Queue/worker path

- `queue/index.ts` and `queue/connection.ts`: queue setup.
- `queue/processors.ts`: job processing logic.
- `queue/worker.ts`: worker runtime process (`bun --cwd api worker:dev`).

## Frontend (`web/`)

### App structure

```text
web/src
├── components/                 # Svelte UI modules (feed, voting, upload, profile)
├── layouts/                    # Astro base layout
├── lib/                        # Shared frontend helpers (API base, Convex client)
├── pages/                      # Astro routes
│   └── image/[id].astro        # Dynamic image detail route
└── styles/                     # Global CSS
```

### Key pages

- `pages/index.astro`: home page with vote module + blended feed.
- `pages/top.astro`: ranking/top list view.
- `pages/upload.astro`: upload screen.
- `pages/profile.astro`: user profile screen.
- `pages/login.astro`: auth entry.
- `pages/image/[id].astro`: image details.

## Convex backend (`convex/`)

- `schema.ts`: primary data model (users, sessions, images, votes, ratings, comments, dedupe/fingerprint data).
- `auth.ts`, `users.ts`, `content.ts`, `voting.ts`: domain-specific Convex functions.
- `health.ts`: backend health helpers.
- `backfill.ts`: maintenance/backfill functions.
- `_generated/*`: Convex generated types/clients; do not hand-edit.

### Core entities in schema

- Identity/auth: `userProfiles`, `authTokens`, `sessions`
- Image lifecycle: `images`, `imageFingerprints`, `dedupeEvents`
- Ranking/voting: `votes`, `matchupTokens`, `imageRatings`
- Social: `imageComments`

## Shared config package (`packages/config/`)

- `src/env.schema.ts`: central env variable schema (zod).
- `src/env.ts`: env loading/validation utilities.
- `src/spawn.ts`: process spawn helper used by scripts/runtime tooling.

This package prevents ad-hoc `process.env` use and keeps runtime config consistent.

## Infra (`infra/`)

- `docker/docker-compose.yml`: local Redis, MinIO, Convex, Caddy services.
- `caddy/Caddyfile`: local reverse proxy routes.
- `cloudflared/dev-staging.mjs`: optional tunnel/bootstrap for staging-like local flow.

## Tooling (`tools/`)

- `check-env-guardrails.mjs`: enforces env usage rules.
- `orb_verifier/`: Python microservice/container for image verification logic used by API image services.

## Runtime processes in dev

Running `bun run dev` at repo root starts:
- Docker infra (`redis`, `minio`, `convex-backend`, `convex-dashboard`, `caddy`)
- API server (`api/src/index.ts`)
- Web dev server (`web` Astro)
- Worker process (`api/src/queue/worker.ts`)

## Typical change map

- UI/component change: edit `web/src/components/*` and/or `web/src/pages/*`
- API endpoint behavior: edit `api/src/routes/*` + `api/src/services/*`
- Background job behavior: edit `api/src/queue/*`
- Data model/indexes: edit `convex/schema.ts` (+ regenerate Convex code as needed)
- Env/config behavior: edit `packages/config/src/*` and env files
