# Note de déploiement — TicketTout (Ticket Tout)

## Hébergement

**Où ce service serait-il hébergé en production ?**

OVHCloud, partenaire de l'État, ou un autre hébergeur agréé par l'État. Localisation de préférence en France, ou à défaut en Europe. L'hébergement doit être conforme aux normes de sécurité et de confidentialité des données, notamment le RGPD.

## Ressources nécessaires

**Quelles ressources cela demanderait-il ?**

Le service ne nécessite pas énormément de ressources, mais il faut prévoir un serveur disposant de ressources suffisantes pour gérer les utilisateurs et les transactions. Plusieurs serveurs pourraient également être mis en place pour la redondance et la haute disponibilité, avec de l'équilibrage de charge (load balancing).

Un serveur type pourrait être configuré avec les ressources suivantes :

| Ressource  | Valeur       |
|------------|--------------|
| CPU        | 4 vCPU       |
| RAM        | 8 Go         |
| Stockage   | 100 Go SSD   |

*CPU et RAM non figés, à ajuster selon la charge réelle du service et le nombre d'utilisateurs simultanés (pourra être calculer une fois l'application fonctionnelle).*

## Données sortantes

**Quelles données sortiraient de l'infrastructure et vers qui ?**

> Les données sortent de l'infrastructure vers les utilisateurs finaux (salariés, entreprises) et vers les partenaires du service (administrations, partenaires commerciaux), via l'API REST documentée dans `docs/API.md`.

---

## Volumétrie du schéma SQL

Cette section chiffre le coût de stockage et d'insertion de chaque table définie dans le schéma SQL, afin de dimensionner le stockage et d'anticiper la croissance de la base.

### Méthodologie et hypothèses

Les calculs se basent sur le modèle de stockage physique de PostgreSQL :

- **En-tête de ligne (heap tuple)** : `HeapTupleHeaderData` = 23 octets, arrondi à **24 octets** avec l'alignement `MAXALIGN` (8 octets).
- **Pointeur de ligne (line pointer)** dans la page : **4 octets**.
- **Champ `text`/`varchar`** (varlena) : longueur réelle + **1 octet** d'en-tête pour une chaîne ≤ 127 octets (cas de toutes nos colonnes).
- **`Int` (int4)** : 4 octets. **`Boolean`** : 1 octet. **`DateTime`** : 8 octets. **`enum`** natif Postgres : 4 octets.
- Un identifiant `String @default(uuid())` est stocké sous forme de texte (36 caractères) : 36 + 1 = **37 octets**.
- Chaque colonne indexée ajoute une entrée de type B-Tree : taille de la clé + **8 octets** (pointeur de tuple `TID`), arrondie à 8 octets.
- Le WAL (Write-Ahead Log) d'une insertion inclut la ligne elle-même, les entrées d'index associées, et un surcoût lié aux "full page images" après checkpoint. On retient un facteur d'amplification **× 2,5** (valeur usuelle observée en écriture aléatoire sur PostgreSQL 15+), à titre d'estimation.

Longueurs moyennes de chaînes retenues pour les colonnes de texte libre :

| Colonne                       | Longueur moyenne estimée |
|--------------------------------|--------------------------|
| `email`                       | 25 caractères            |
| `name` / `surname`            | 12 caractères            |
| `password` (hash bcrypt)      | 60 caractères            |
| `address`                     | 35 caractères            |
| `postalCode`                  | 5 caractères             |
| `siret`                       | 14 caractères            |
| `mimeType`                    | 20 caractères            |
| `category` / `reason` / `name` (référentiels) | 20-40 caractères |
| `content` (QrCode, jeton signé) | 180 caractères         |

### Coût d'insertion par table

| Table                      | Données (octets) | Ligne (en-tête+ptr+données) | Index (nb, octets) | Coût insertion (ligne+index) | WAL estimé (×2,5) |
|-----------------------------|-------------------|-------------------------------|----------------------|--------------------------------|---------------------|
| `CompanyCategory`          | 25  (id 4 + category 21)                                                    | 56 o  | 1 (PK) → 16 o                                                                        | 72 o   | 180 o   |
| `CompanyValidationReason`  | 45  (id 4 + reason 41)                                                      | 80 o  | 1 (PK) → 16 o                                                                        | 96 o   | 240 o   |
| `Administration`           | 30  (id 4 + name 26)                                                        | 64 o  | 1 (PK) → 16 o                                                                        | 80 o   | 200 o   |
| `Document`                 | 107 (id 37 + storageKey 37 + mimeType 21 + size 4 + createdAt 8)            | 136 o | 4 → PK 48 + unique(storageKey) 48 + index(storageKey) 48 + index(createdAt) 16 = 160 o | 296 o  | 740 o   |
| `Users`                    | 219 (id 37 + email 26 + surname 13 + name 13 + role 4 + balance 4 + password 61 + createdAt 8 + updatedAt 8 + expiredAt 8 + documentId 37) | 248 o | 6 → PK 48 + unique(email) 40 + unique(documentId) 48 + index(role) 16 + index(createdAt) 16 + index(updatedAt) 16 = 184 o | 432 o | 1 080 o |
| `Company`                  | 209 (id 37 + name 21 + email 26 + siret 15 + kbisId 37 + address 36 + postalCode 6 + agentId 4 + reasonId 4 + verified 1 + isFeatured 1 + categoryId 4 + isPartner 1 + createdAt 8 + updatedAt 8) | 240 o | 9 → PK 48 + unique(email) 40 + unique(siret) 24 + unique(kbisId) 48 + index(verified) 16 + index(createdAt) 16 + index(updatedAt) 16 + index(agentId) 16 + index(reasonId) 16 = 240 o | 480 o | 1 200 o |
| `Transaction`              | 164 (id 37 + type 4 + userId 37 + companyId 37 + amount 4 + originalTransactionId 37 + createdAt 8) | 192 o | 6 → PK 48 + unique(originalTransactionId) 48 + index(userId) 48 + index(companyId) 48 + index(type) 16 + index(createdAt) 16 = 224 o | 416 o | 1 040 o |
| `MinisterFavorite`         | 41  (id 4 + companyId 37)                                                   | 72 o  | 1 → unique(companyId) 48 o (⚠ pas de clé primaire, voir anomalies)                    | 120 o  | 300 o   |
| `QrCode`                   | 267 (id 4 + content 181 + expiredAt 8 + userId 37 + companyId 37)           | 296 o | 4 → PK 16 + index(content) 192 + index(userId) 48 + index(companyId) 48 = 304 o       | 600 o  | 1 500 o |

*(o = octets)*\
*WAL (Write-Ahead Log) estimé à 2,5× le coût d'insertion (ligne + index), pour tenir compte des "full page images" et du surcoût d'écriture aléatoire sur PostgreSQL.*

Les tables `Transaction` et `QrCode` sont, de loin, les plus coûteuses à l'insertion : `Transaction` du fait de ses trois colonnes UUID indexées, et `QrCode` du fait de l'indexation d'un champ `content` long (jeton signé de ~180 caractères), qui alourdit sensiblement chaque écriture.

### Projection de volumétrie annuelle

Hypothèses de charge retenues (à ajuster avec les chiffres réels attendus par le client) :

| Table               | Volume initial | Croissance mensuelle estimée |
|----------------------|-----------------|-------------------------------|
| `Users`             | 8 000           | + 500 / mois pour x nombre d'utilisateurs |
| `Company`           | 2 000           | + 50 / mois pour x nombre d'entreprises |
| `Document`          | 10 000          | + 550 / mois pour x nombre de documents basé sur les utilisateurs et companies |
| `Transaction`       | —               | 50 000 / mois pour x nombre de transactions moyenne |
| `QrCode`            | —               | 150 000 / mois (régénération ~3× par transaction) pour x nombre de QR codes générés |
| Tables référentielles (`CompanyCategory`, `CompanyValidationReason`, `Administration`) | < 100 | négligeable |

Coût mensuel (ligne + index, hors WAL), avec les coûts d'insertion ci-dessus :

- `Users` : 500 × 432 o ≈ 211 Ko
- `Company` : 50 × 480 o ≈ 23 Ko
- `Document` : 550 × 296 o ≈ 159 Ko
- `Transaction` : 50 000 × 416 o ≈ 19,8 Mo
- `QrCode` : 150 000 × 600 o ≈ 85,8 Mo

**Total ≈ 106 Mo / mois** de données (hors index de maintenance et fragmentation), soit environ **1,27 Go / an** en prenant une croissance linéaire du volume mensuel (hypothèse conservatrice qui sous-estime la croissance réelle, `Transaction` et `QrCode` étant cumulatifs et non remplacés).

En ajoutant une marge de 30 % pour le bloat (fragmentation liée à `VACUUM`/`MVCC`) et les index secondaires non comptés (autovacuum, statistiques), on obtient une estimation d'environ **1,65 Go la première année**.

Le WAL correspondant (~2,5× le volume ci-dessus, soit environ 265 Mo/mois) n'est pas un coût de stockage permanent : il est recyclé en continu par PostgreSQL, sauf si l'archivage WAL (PITR) est activé, auquel cas il faut prévoir un espace de stockage dédié à l'archive (~3,2 Go/an dans cette hypothèse).

**Conclusion** : les 100 Go de stockage SSD prévus dans la configuration serveur ci-dessus couvrent très largement les besoins projetés sur plusieurs années, même avec une marge de sécurité importante et une croissance du volume de transactions bien supérieure aux hypothèses retenues ici.
