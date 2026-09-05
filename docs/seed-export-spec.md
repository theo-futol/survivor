# Spec — Seed reproductible, export CSV, endpoint admin

## Livrables attendus

### 1. Script de seed reproductible
Une seule commande avec un script dans dev/ qui injecte en base :
- **50 salariés** avec des soldes variés, dont **3 à zéro** et **2 sous les 5 €**.
- **12 partenaires** répartis sur **au moins 4 catégories** et **3 régions**.
- **200 transactions** étalées sur **90 jours**, montants réalistes, dont **au moins 5 refusées pour solde insuffisant**.

### 2. Export CSV des 200 transactions
- Encodage **UTF-8**, séparateur **point-virgule**.
- Colonnes, ordre et noms **exacts** (le script de lecture côté client est déjà écrit et ne sera pas modifié) :
  ```
  id;date_iso8601;employee_id;partner_id;amount_cents;status
  ```

### 3. Endpoint d'export admin
- `GET /api/v1/admin/transactions.csv`
- Réservé au rôle `admin`.
- Doit produire **strictement le même fichier** que l'export du seed, **ligne pour ligne**. Deux chemins de code qui produisent presque le même CSV = bug latent.

## Trois conditions sur le contenu

### Déterminisme
Deux exécutions du seed sur une base vide doivent produire le même jeu de données : mêmes identifiants, mêmes montants, mêmes dates.
- Graine aléatoire fixée.
- Dates ancrées sur une **date de référence explicite** (pas `now()`), pour permettre de comparer deux exécutions entre elles, et le CSV à la base.

### Cohérence avec les règles métier
Le jeu de données doit être un historique plausible, pas 200 lignes tirées au sort :
- Sur la ligne du temps, un salarié n'a **jamais dépensé plus qu'il n'avait reçu** à cet instant.
- Les **5 refus** sont refusés parce que le solde était **réellement insuffisant** au moment du débit — pas un statut posé à la main.
- Le solde affiché par l'application après le seed doit être **égal au solde recalculé** à partir des écritures.

### Pas de triche sur l'immuabilité
- Le seed ne corrige jamais un solde par un `UPDATE` sur une transaction validée.
- Il écrit des abondements et des débits **dans l'ordre**, comme le ferait l'application.
- Si le script a besoin de modifier une écriture existante pour que les comptes tombent juste, c'est le **modèle** qu'il faut revoir, pas le script.

## Justificatif à fournir
Pour un des trois salariés à solde zéro, fournir en trois lignes :
- ses abondements,
- ses débits,
- le total recalculé.

Un seul cas détaillé suffit (pas les 50).

## Contraintes de forme
- Données fictives mais **plausibles** : pas de "Jean Test", pas de montants à 999999.
- Volume généré par script, jamais saisi à la main.

## Output

- A seed.sql file in mocks/ that can be run to populate the database with the specified data.
- Update the README.md file to include instructions on how to run the seed script.
- In dev/, add a script which inserts the content of the mocks/*.sql files into the database (provided by the environment).

## Verification

If container is running, down it, rebuild it, and run the seed script. Then check that the database contains the expected data, and the endpoint produces the expected output. Also verify that the CSV export matches the expected output according to the specification and the seed.sql file. Finally down the container.