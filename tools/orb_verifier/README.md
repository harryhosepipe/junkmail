# ORB Verifier Service

Python service for crop-robust duplicate verification (ORB + RANSAC) used by the API image worker.

## Run locally

```bash
cd tools/orb_verifier
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export ORB_SHARED_SECRET=replace-me
uvicorn app:app --host 0.0.0.0 --port 9090
```

Health:

```bash
curl http://localhost:9090/health
```

The API worker expects:

- `IMAGE_DEDUPE_ORB_ENABLED=true`
- `IMAGE_DEDUPE_ORB_VERIFIER_URL=http://localhost:9090/verify/orb`
- `IMAGE_DEDUPE_ORB_SHARED_SECRET=replace-me`

## Docker Compose (optional)

```bash
docker compose --profile orb up -d orb-verifier
```
