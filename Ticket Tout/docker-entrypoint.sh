#!/bin/sh
set -e

./migration.sh

if [ -n "$APP_HOST_IP" ]; then
  exec npx next start --hostname 0.0.0.0 --experimental-https \
    --experimental-https-key "./certificates/${APP_HOST_IP}-key.pem" \
    --experimental-https-cert "./certificates/${APP_HOST_IP}.pem"
fi

exec "$@"
