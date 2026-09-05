#!/usr/bin/env bash

# Arrêt immédiat du script en cas d'erreur
set -e

cd "$(dirname "$0")/.."

ENV_FILE=$1

if [ -z "$ENV_FILE" ]; then
    echo "Usage: $0 <path_to_env_file>"
    exit 1
fi

echo "ATTENTION : Cette action va supprimer les conteneurs, images et volumes du projet Ticket Tout (définis dans docker-compose.yml)."
read -p "Voulez-vous vraiment continuer ? (y/N) : " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Opération annulée."
    exit 0
fi

echo "Arrêt et suppression des conteneurs, images, volumes et réseaux du projet..."
docker compose --env-file $1 --profile '*' down --rmi all --volumes --remove-orphans

echo "Purge du projet Ticket Tout terminée avec succès."
