#!/bin/bash

set -e

CONTAINER=$1

if [ -z "$CONTAINER" ]; then
  echo "Please provide the name of the container as an argument."
  exit 1
fi

docker exec -i $CONTAINER bash -c 'npm run db:migrate'

docker exec -i cartepro_db bash -c 'PGPASSWORD=$POSTGRES_PASSWORD pg_dump -U $POSTGRES_USER -d $POSTGRES_DB --schema-only' > schema.sql
