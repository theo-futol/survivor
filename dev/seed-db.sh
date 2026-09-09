#!/bin/bash

set -e

SEED_FILE=$1
CONTAINER_APP=$2
CONTAINER_DB=$3

if [ -z "$SEED_FILE" ] || [ -z "$CONTAINER_APP" ] || [ -z "$CONTAINER_DB" ]; then
  echo "Usage: $0 <seed_file> <container_app_name> <container_db_name>"
  exit 1
fi

cd "$(dirname "$0")/.."

echo "Migrating the database..."

docker exec -i $CONTAINER_APP bash -c 'npm run db:migrate'

echo "Database migrated."
echo "--------------------------------"
echo "Seeding the database with mock data..."

docker exec -i $CONTAINER_DB bash -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1' < "$SEED_FILE"
