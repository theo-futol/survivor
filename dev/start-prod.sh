#!/usr/bin/env bash
# Starts the "prod" Docker Compose profile with a local, mkcert-issued
# HTTPS certificate valid for this machine's own local IP.
#
# Usage: ./dev/start-prod.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed on this machine." >&2
  exit 1
fi

# shellcheck source=dev/generate-certs.sh
. "$SCRIPT_DIR/generate-certs.sh"

cd "$REPO_ROOT"

ENV_FILE="$REPO_ROOT/.env.production"
if [ ! -s "$ENV_FILE" ]; then
  echo "Error: .env.production is missing or empty." >&2
  echo "Create it from the template first: cp .env.example .env.production" >&2
  echo "then fill in the production POSTGRES_*, DATABASE_URL, JWT_SECRET," >&2
  echo "REDIS_* and GARAGE_* values." >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" --profile prod up
