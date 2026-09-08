#!/usr/bin/env bash
# Issues the mkcert HTTPS certificate the app serves in both the dev and the
# prod profile, valid for localhost *and* this machine's LAN IP so phones and
# laptops on the same network can reach it.
#
# Sourced by dev/start-dev.sh and dev/start-prod.sh; can also be run directly
# after switching networks:
#
#   ./dev/generate-certs.sh
#   APP_HOST_IP=192.168.1.42 ./dev/generate-certs.sh
#
# Exports APP_HOST_IP so the calling script can report the URL to use.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CERT_DIR="$REPO_ROOT/CartePro/certificates"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "Error: mkcert is not installed on this machine." >&2
  echo "Install it first (e.g. 'sudo apt install mkcert' or see https://github.com/FiloSottile/mkcert)," >&2
  echo "then run 'mkcert -install' and re-run this script." >&2
  exit 1
fi

# The address other devices dial. Docker bridge addresses (172.17.x, 172.18.x,
# 172.19.x …) also show up on this machine but are reachable from the host only,
# so they must never be picked: asking the routing table which source address
# reaches the outside world returns the LAN interface and nothing else. The
# older `hostname -I | awk '{print $1}'` returned whichever address happened to
# be listed first, which is how a docker bridge IP once ended up in the
# certificate.
detect_local_ip() {
  case "$(uname -s)" in
    Darwin)
      local iface ip
      iface="$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}')"
      if [ -n "$iface" ]; then
        ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
        [ -n "$ip" ] && { echo "$ip"; return; }
      fi
      for iface in en0 en1; do
        ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
        [ -n "$ip" ] && { echo "$ip"; return; }
      done
      ;;
    *)
      local ip
      ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')"
      [ -n "$ip" ] && { echo "$ip"; return; }
      # No default route (offline): fall back to the first global address that
      # does not sit on a container bridge.
      ip -4 -o addr show scope global 2>/dev/null \
        | grep -vE '^[0-9]+: (docker|br-|veth)' \
        | awk '{print $4}' | cut -d/ -f1 | head -n 1
      ;;
  esac
}

if [ -n "${APP_HOST_IP:-}" ]; then
  echo "Using APP_HOST_IP from environment: $APP_HOST_IP"
else
  echo "APP_HOST_IP not set in environment, attempting to determine local IP..."
  APP_HOST_IP="$(detect_local_ip)"
fi

if [ -z "$APP_HOST_IP" ]; then
  echo "Error: could not determine this machine's local IP address." >&2
  echo "Set it explicitly, e.g. 'APP_HOST_IP=192.168.1.42 ./dev/start-dev.sh'." >&2
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
