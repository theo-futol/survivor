#!/bin/bash

set -e

SEED_FILE=$1

if [ -z "$SEED_FILE" ]; then
  echo "Usage: $0 <seed_file>"
  exit 1
fi

cd "$(dirname "$0")/.."

echo "Migrating the database..."

docker exec -i ticket_tout_app_dev bash -c 'npm run db:migrate'

echo "Database migrated."
echo "--------------------------------"
echo "Seeding the database with mock data..."

docker exec -i ticket_tout_db bash -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1' < "$SEED_FILE"
