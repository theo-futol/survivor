#!/usr/bin/env bash
# Starts the "dev" Docker Compose profile with a local, mkcert-issued HTTPS
# certificate valid for this machine's own LAN IP, so the app is reachable both
# from this machine and from phones or laptops on the same network.
#
# Usage: ./dev/start-dev.sh
#        APP_HOST_IP=192.168.1.42 ./dev/start-dev.sh
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

ENV_FILE="$REPO_ROOT/.env.development"
if [ ! -s "$ENV_FILE" ]; then
  echo "Error: .env.development is missing or empty." >&2
  echo "Create it from the template first: cp .env.example .env.development" >&2
  exit 1
fi

echo
echo "The app will be reachable at:"
echo "  https://localhost:3000        (this machine)"
echo "  https://$APP_HOST_IP:3000     (other devices on the same network)"
echo
echo "The QR scanner needs camera access, which browsers only grant on a"
echo "trusted origin. On another device, install this machine's mkcert root CA"
echo "($(mkcert -CAROOT 2>/dev/null)/rootCA.pem) to get one; otherwise accept the"
echo "certificate warning before opening the scanner."
echo

docker compose --env-file "$ENV_FILE" --profile dev up
