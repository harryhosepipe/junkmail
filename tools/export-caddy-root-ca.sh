#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_PATH="${1:-$ROOT_DIR/infra/caddy/caddy-local-root-ca.crt}"
INSTALL_WINDOWS="${INSTALL_WINDOWS_CERT:-0}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required." >&2
  exit 1
fi

if ! docker compose -f "$ROOT_DIR/docker-compose.yml" ps --status running --services | grep -qx 'caddy'; then
  echo "Caddy is not running. Start infra first: bun run dev:infra" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT_PATH")"
if ! docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T caddy sh -lc \
  'test -f /data/caddy/pki/authorities/local/root.crt'; then
  echo "Caddy root CA not found yet." >&2
  echo "Trigger cert generation first by opening https://web.localhost once, then rerun." >&2
  exit 1
fi

docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T caddy sh -lc \
  'cat /data/caddy/pki/authorities/local/root.crt' >"$OUT_PATH"

if [[ ! -s "$OUT_PATH" ]]; then
  echo "Failed to export Caddy root certificate." >&2
  exit 1
fi

echo "Exported Caddy local root CA to:"
echo "  $OUT_PATH"

if command -v wslpath >/dev/null 2>&1; then
  WIN_PATH="$(wslpath -w "$OUT_PATH")"
  echo
  echo "Windows path:"
  echo "  $WIN_PATH"
  echo
  echo "Import manually in elevated PowerShell:"
  echo "  Import-Certificate -FilePath '$WIN_PATH' -CertStoreLocation Cert:\\LocalMachine\\Root"
  echo
  echo "Or import for current user (no elevation):"
  echo "  Import-Certificate -FilePath '$WIN_PATH' -CertStoreLocation Cert:\\CurrentUser\\Root"

  if [[ "$INSTALL_WINDOWS" == "1" ]]; then
    powershell.exe -NoProfile -Command "Import-Certificate -FilePath '$WIN_PATH' -CertStoreLocation Cert:\CurrentUser\Root | Out-Null"
    echo
    echo "Installed certificate into Windows CurrentUser Root store."
  fi
fi
