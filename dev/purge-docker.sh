#!/usr/bin/env bash

# Arrêt immédiat du script en cas d'erreur
set -e

cd "$(dirname "$0")/.."

echo "ATTENTION : Cette action va supprimer les conteneurs, images et volumes du projet CartePro (définis dans docker-compose.yml)."
read -p "Voulez-vous vraiment continuer ? (y/N) : " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Opération annulée."
    exit 0
fi

echo "Arrêt et suppression des conteneurs, images, volumes et réseaux du projet..."
docker compose --profile '*' down --rmi all --volumes --remove-orphans

echo "Purge du projet CartePro terminée avec succès."
