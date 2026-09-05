#!/usr/bin/env bash
# Starts the "prod" Docker Compose profile with a local, mkcert-issued
# HTTPS certificate valid for this machine's own local IP.
#
# Usage: ./scripts/start-prod.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CERT_DIR="$REPO_ROOT/Ticket Tout/certificates"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "Error: mkcert is not installed on this machine." >&2
  echo "Install it first (e.g. 'sudo apt install mkcert' or see https://github.com/FiloSottile/mkcert)," >&2
  echo "then run 'mkcert -install' and re-run this script." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed on this machine." >&2
  exit 1
fi

detect_local_ip() {
  case "$(uname -s)" in
    Darwin)
      for iface in en0 en1; do
        ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
        [ -n "$ip" ] && { echo "$ip"; return; }
      done
      iface="$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}')"
      [ -n "$iface" ] && ipconfig getifaddr "$iface" 2>/dev/null
      ;;
    *)
      hostname -I 2>/dev/null | awk '{print $1}'
      ;;
  esac
}

APP_HOST_IP="${APP_HOST_IP:-}"
if [ -n "$APP_HOST_IP" ]; then
  echo "Using APP_HOST_IP from environment: $APP_HOST_IP"
else
  echo "APP_HOST_IP not set in environment, attempting to determine local IP..."
  APP_HOST_IP="$(detect_local_ip)"
fi

if [ -z "$APP_HOST_IP" ]; then
  echo "Error: could not determine this machine's local IP address." >&2
  echo "Set it explicitly, e.g. 'APP_HOST_IP=192.168.1.42 ./dev/start-prod.sh'." >&2
  exit 1
fi

export APP_HOST_IP

echo "Using local IP: $APP_HOST_IP"

mkdir -p "$CERT_DIR"

CERT_FILE="$CERT_DIR/localhost.pem"
KEY_FILE="$CERT_DIR/localhost-key.pem"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ] \
  && openssl x509 -in "$CERT_FILE" -noout -checkend 0 >/dev/null 2>&1 \
  && SAN="$(openssl x509 -in "$CERT_FILE" -noout -ext subjectAltName 2>/dev/null)" \
  && echo "$SAN" | grep -q "IP Address:$APP_HOST_IP" \
  && echo "$SAN" | grep -q "DNS:localhost"; then
  echo "Certificate for $APP_HOST_IP already exists, skipping generation."
else
  echo "No valid certificate found for $APP_HOST_IP, generating one..."

  # Idempotent: does nothing if the local CA is already installed.
  mkcert -install

  (
    cd "$CERT_DIR"
    mkcert -cert-file "localhost.pem" -key-file "localhost-key.pem" \
      "$APP_HOST_IP" localhost 127.0.0.1 ::1
  )
fi

cd "$REPO_ROOT"

ENV_FILE="$REPO_ROOT/.env.production"
if [ ! -s "$ENV_FILE" ]; then
  echo "Error: .env.production is missing or empty." >&2
  echo "Create it from the template first: cp .env.example .env.production" >&2
  echo "then fill in the production POSTGRES_*, DATABASE_URL, JWT_SECRET," >&2
  echo "BETTER_AUTH_*, REDIS_* and GARAGE_* values." >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" --profile prod up
