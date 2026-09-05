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

APP_HOST_IP="${APP_HOST_IP:-}"
if [ -n "$APP_HOST_IP" ]; then
  echo "Using APP_HOST_IP from environment: $APP_HOST_IP"
else
  echo "APP_HOST_IP not set in environment, attempting to determine local IP..."
  APP_HOST_IP="$(hostname -I | awk '{print $1}')"
fi

if [ -z "$APP_HOST_IP" ]; then
  echo "Error: could not determine local IP address via 'hostname -I'." >&2
  exit 1
fi

export APP_HOST_IP

echo "Using local IP: $APP_HOST_IP"

mkdir -p "$CERT_DIR"

CERT_FILE="$CERT_DIR/${APP_HOST_IP}.pem"
KEY_FILE="$CERT_DIR/${APP_HOST_IP}-key.pem"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "Certificate for $APP_HOST_IP already exists, skipping generation."
else
  echo "No certificate found for $APP_HOST_IP, generating one..."

  # Idempotent: does nothing if the local CA is already installed.
  mkcert -install

  (
    cd "$CERT_DIR"
    mkcert -cert-file "${APP_HOST_IP}.pem" -key-file "${APP_HOST_IP}-key.pem" "$APP_HOST_IP"
  )
fi

cd "$REPO_ROOT"
docker compose --profile prod up
