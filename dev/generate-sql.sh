#!/bin/bash

set -e

docker exec -i cartepro_app_dev bash -c 'npm run db:migrate'

docker exec -i cartepro_db bash -c 'PGPASSWORD=$POSTGRES_PASSWORD pg_dump -U $POSTGRES_USER -d $POSTGRES_DB --schema-only' > schema.sql
