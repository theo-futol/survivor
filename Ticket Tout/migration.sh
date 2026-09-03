#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
migrations_dir="$script_dir/migrations/app"

echo "▸ Recherche des migration.json dans $migrations_dir..."

if [ ! -d "$migrations_dir" ]; then
  echo "✘ Dossier introuvable : $migrations_dir"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "▸ 'jq' est requis mais absent, installation en cours..."

  if command -v apt-get >/dev/null 2>&1; then
    if [ "$(id -u)" -eq 0 ]; then
      apt-get update -qq && apt-get install -y -qq jq
    elif command -v sudo >/dev/null 2>&1; then
      sudo apt-get update -qq && sudo apt-get install -y -qq jq
    fi
  elif command -v apk >/dev/null 2>&1; then
    if [ "$(id -u)" -eq 0 ]; then
      apk add --no-cache jq
    elif command -v sudo >/dev/null 2>&1; then
      sudo apk add --no-cache jq
    fi
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "✘ Échec de l'installation de 'jq'. Installe-le manuellement puis relance ce script."
    exit 1
  fi

  echo "✔ 'jq' installé."
fi

# Chaque dossier de migration est préfixé par un timestamp (ex: 20260901T1428_...),
# donc un tri lexicographique des chemins suffit à retrouver l'ordre chronologique.
migration_files=()
while IFS= read -r f; do
  migration_files+=("$f")
done < <(find "$migrations_dir" -mindepth 2 -maxdepth 2 -name migration.json | sort)

if [ "${#migration_files[@]}" -eq 0 ]; then
  echo "✘ Aucun migration.json trouvé sous $migrations_dir."
  exit 1
fi

echo "▸ ${#migration_files[@]} migration(s) trouvée(s)."

last_ok=""
for f in "${migration_files[@]}"; do
  name=$(basename "$(dirname "$f")")
  hash=$(jq -r '.to' "$f")

  if [ -z "$hash" ] || [ "$hash" = "null" ]; then
    echo "✘ Champ 'to' manquant dans $f, arrêt."
    exit 1
  fi

  echo ""
  echo "=== ▸ [$name] Migration vers $hash ==="
  if npx prisma db migrate --to "$hash"; then
    echo "✔ OK jusqu'à $hash ($name)"
    last_ok="$hash ($name)"
  else
    echo ""
    echo "✘ ÉCHEC à la migration vers $hash"
    echo "→ Dernier hash réussi : ${last_ok:-<aucun>}"
    echo "→ La migration '$name' est donc la coupable."
    exit 1
  fi
done

echo ""
echo "✔ Toutes les migrations sont passées jusqu'à $last_ok"
