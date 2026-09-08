#!/bin/sh

set -e

npm run db:migrate

./migration.sh

exec "$@"
