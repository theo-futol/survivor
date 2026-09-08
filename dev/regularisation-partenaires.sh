#!/usr/bin/env bash

# Régularisation du 07/09 (voir docs/CHANGEMENT_CARTEPRO.md).
#
# Repasse en état « non validé » (company.verified = FALSE) les partenaires
# antérieurs au 07/09 — ceux dont updatedAt est strictement avant la date de
# bascule — et rattache leur dossier au motif « régularisation du 07/09 »,
# inséré dans companyValidationReason s'il n'y est pas encore.
#
# Ne sont donc jamais touchés : les entreprises employeuses (isPartner = FALSE)
# et les partenaires modifiés le 07/09 ou après (dossiers déjà à jour).
#
# Le script est rejouable : le motif n'est inséré qu'une fois, et la
# régularisation pose updatedAt = now(), ce qui sort les lignes traitées de la
# fenêtre — un second passage ne modifie plus rien.
#
#   ./dev/regularisation-partenaires.sh cartepro_db
#   ./dev/regularisation-partenaires.sh cartepro_db autre_base       # autre base que $POSTGRES_DB

set -eu

CONTAINER=${1:-}
# Par défaut la base applicative du conteneur ; un second argument permet de
# viser une autre base (bac à sable, restauration de dump…).
DB_NAME=${2:-}
REASON="régularisation du 07/09"
# Date de bascule, explicite en UTC : seuls les dossiers plus anciens sont
# régularisés. `company.updatedAt` est un timestamptz.
CUTOFF="2026-09-07 00:00:00+00"

if [ -z "$CONTAINER" ]; then
  echo "Usage: $0 <db_container> [db_name]   (ex: $0 cartepro_db)"
  exit 1
fi

if ! docker exec "$CONTAINER" true 2>/dev/null; then
  echo "Conteneur '$CONTAINER' introuvable ou arrêté."
  exit 1
fi

# psql lit POSTGRES_USER / POSTGRES_DB / POSTGRES_PASSWORD depuis
# l'environnement du conteneur, comme dev/seed-db.sh.
psql_run() {
  docker exec -i -e TARGET_DB="$DB_NAME" "$CONTAINER" bash -c \
    'PGPASSWORD=$POSTGRES_PASSWORD psql -U $POSTGRES_USER -d "${TARGET_DB:-$POSTGRES_DB}" -v ON_ERROR_STOP=1 "$@"' bash "$@"
}

# `docker exec -i` transmet stdin : sans cette variante, les requêtes
# d'affichage consomment la réponse destinée au read de confirmation (et le
# script s'arrête alors en silence sur un EOF). Seul le bloc SQL en heredoc a
# besoin de stdin.
psql_show() {
  psql_run "$@" < /dev/null
}

echo "Partenaires concernés dans '$CONTAINER' :"
psql_show -c "SELECT count(*) FILTER (WHERE \"updatedAt\" < TIMESTAMPTZ '${CUTOFF}')
                      AS \"à régulariser (avant le ${CUTOFF})\",
                    count(*) FILTER (WHERE \"updatedAt\" >= TIMESTAMPTZ '${CUTOFF}')
                      AS \"ignorés (${CUTOFF} ou après)\",
                    count(*) AS \"partenaires au total\"
             FROM public.company
             WHERE \"isPartner\" IS TRUE;"



echo "Cette action passe en non validé les partenaires antérieurs au ${CUTOFF}, motif « $REASON »."
read -p "Continuer ? (y/N) : " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Opération annulée."
  exit 0
fi

# Un seul BEGIN/COMMIT : le motif et les entreprises qui le référencent sont
# écrits ensemble, ou pas du tout.
psql_run <<SQL
BEGIN;

INSERT INTO public."companyValidationReason" (reason)
SELECT '${REASON}'
WHERE NOT EXISTS (
  SELECT 1 FROM public."companyValidationReason" WHERE reason = '${REASON}'
);

-- updatedAt n'a ni valeur par défaut ni trigger en base (il est piloté par
-- l'ORM), donc une écriture en SQL brut doit le poser elle-même.
UPDATE public.company
SET verified    = FALSE,
    "reasonId"  = (SELECT min(id) FROM public."companyValidationReason" WHERE reason = '${REASON}'),
    "updatedAt" = now()
WHERE "isPartner" IS TRUE
  -- La vérification : un dossier modifié le ${CUTOFF} ou après est déjà à jour, on
  -- n'y touche pas. C'est aussi ce qui rend le script rejouable.
  AND "updatedAt" < TIMESTAMPTZ '${CUTOFF}';

COMMIT;
SQL

echo "État après régularisation :"
psql_show -c "SELECT r.reason AS motif,
                    c.verified AS \"validé\",
                    count(*) AS partenaires,
                    max(c.\"updatedAt\") AS \"dernière modification\"
             FROM public.company c
             JOIN public.\"companyValidationReason\" r ON r.id = c.\"reasonId\"
             WHERE c.\"isPartner\" IS TRUE
             GROUP BY 1, 2
             ORDER BY 1;"
