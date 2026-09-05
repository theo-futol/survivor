#!/bin/sh
set -e

./migration.sh

exec "$@"
