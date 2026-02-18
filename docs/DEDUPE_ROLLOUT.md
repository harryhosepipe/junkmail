# Dedupe Rollout Checklist

This checklist is for enabling and validating the dedupe v2 workflow in staging/production.

## 1) Required env

Set in API worker runtime:

- `IMAGE_DEDUPE_V2_ENABLED=true`
- `IMAGE_DEDUPE_ORB_ENABLED=true`
- `IMAGE_DEDUPE_ORB_REQUIRED=false` (set `true` only after verifier is stable)
- `IMAGE_DEDUPE_ORB_VERIFIER_URL=http://orb-verifier:9090/verify/orb` (or your deployed URL)
- `IMAGE_DEDUPE_ORB_SHARED_SECRET=<secret>`
- `IMAGE_DEDUPE_ORB_TIMEOUT_MS=3500`
- `IMAGE_DEDUPE_ORB_RETRIES=2`

Set in ORB verifier runtime:

- `ORB_SHARED_SECRET=<same secret>`

## 2) Bring up verifier (local compose)

```bash
docker compose --profile orb up -d orb-verifier
```

Health check:

```bash
curl http://localhost:9090/health
```

## 3) Validate upload behavior

Test matrix:

- exact duplicate -> rejected (`sha256_exact`)
- near duplicate/crop variant -> rejected (`orb_verified` or `phash_near`)
- different image control -> accepted

Use fixture harness:

```bash
bun run --cwd api images:evaluate-duplicates
```

## 4) Observe dedupe health

API endpoints:

- `GET /api/v1/uploads/dedupe/stats?windowHours=24&sampleLimit=2000`
- `GET /api/v1/uploads/dedupe/events?limit=100`

CLI helper:

```bash
bun run --cwd api images:dedupe-stats -- --window-hours 24 --sample-limit 2000 --events 20
```

Watch for:

- high `orb_error_fallback` count
- p95 latency spikes in dedupe events
- unexpected accept/reject distribution changes

## 5) Tighten policy

After stable staging runs:

1. keep `IMAGE_DEDUPE_ORB_ENABLED=true`
2. switch `IMAGE_DEDUPE_ORB_REQUIRED=true` to fail closed on verifier outages
3. tune thresholds if needed (`IMAGE_DEDUPE_PHASH_MAX_DISTANCE_*`, ORB thresholds)
