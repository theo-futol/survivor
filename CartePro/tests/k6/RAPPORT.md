# Rapport de charge k6 — 10/09/2026

## Résultats

| Profil | Charge | Échecs | Checks | Verdict |
| --- | --- | --- | --- | --- |
| `smoke` | 1 VU, 5 iters  | 0 % | 100 % | ✅ |
| `average-load` | 20 VUs / 7 min — 6 040 iters, 57 req/s  | 0 % | 100 % | ✅ |
| `stress` | 10→50→100 VUs / 3 min — 5 565 iters, 123 req/s | 0 % | 100 % | ✅ |

Latence par endpoint en stress : `health` 170 ms · `categories` 273 ms · `login` 284 ms ·
`qrcode` 354 ms.

Ressources (pic à 41 VUs) : **`app-dev` 105 % CPU (un cœur saturé)**, `db` 2,9 %,
`redis` 0,4 %, 1 connexion Postgres active.

## Ce qui peut casser

| Risque | Pourquoi | Correctif |
| --- | --- | --- |
| **Node saturé à 1 cœur** — observé | Un cœur à 100 % dès ~40 VUs alors que Postgres est à 3 % : le goulot est le process JS, pas la base. La latence x3,5 entre 20 et 100 VUs vient de là. | Scaler horizontalement (plusieurs instances derrière nginx) ; le mode `dev` amplifie, à re-mesurer sur `--profile prod`. |
| **Pool PG `max: 10`** — non déclenché | `lib/services/postgres_client.ts:10`. Non atteint ici car les routes testées passent par l'ORM Prisma, pas par ce pool. Mais `withTransaction` (paiement, abondements, signup pro) garde une connexion du `BEGIN` au `COMMIT` : ~10 paiements concurrents suffisent à mettre tout le reste en attente. | Dimensionner `max` (25–50) et poser un `connectionTimeoutMillis` pour échouer vite au lieu de pendre. |

## Limite du test

Le jeu de seeds ne contient **qu'un salarié** (`employee@cartepro.test`) et **6 entreprises
partenaires**. La réutilisation étant indexée sur `(userId, companyId)`, il n'existe que
6 QR codes possibles simultanément : au-delà de 6 VUs, tout est du `200 reused` et le chemin
d'écriture (`INSERT`) n'est quasiment plus sollicité. Pour vraiment charger l'écriture, il
faut seeder N salariés et faire logger chaque VU avec un compte distinct.
