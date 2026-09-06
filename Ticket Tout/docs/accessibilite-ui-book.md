# Book UI & accessibilité — nom défini dans `lib/brand.ts`

## Palette

La palette est construite autour du bleu institutionnel demandé **#1B3A6B** et des couleurs visibles/dérivées du logo.

| Rôle | Couleur | Usage |
|---|---|---|
| Bleu institutionnel | `#1B3A6B` | CTA principaux, titres de repère, carte salarié |
| Rouge accent | `#D7263D` | Coups de cœur, accents éditoriaux, états forts |
| Bleu accent lumineux | `#2F6FB2` | focus, accent secondaire, éléments interactifs |
| Rouge foncé | `#C51F34` | texte d’erreur et montant consommé |
| Bleu nuit texte | `#13253F` | texte principal |
| Bleu gris texte | `#49627F` | texte secondaire |
| Bleu très clair | `#EAF1FB` | surfaces secondaires |
| Rose très clair | `#FFF0F2` | fond des messages d’erreur |
| Fond général | `#F7F9FC` | fond de page |
| Blanc | `#FFFFFF` | cartes et texte inversé |

## Contrastes texte / fond réellement utilisés

**Outil de mesure :** script Python appliquant la formule de luminance relative et de contraste WCAG 2.x (mêmes ratios utilisés pour le contrôle RGAA des contrastes). Seuil retenu pour le texte normal : **4,5:1**.

| Couple réellement utilisé | Texte | Fond | Ratio | AA texte normal |
|---|---:|---:|---:|---|
| Texte principal / fond page | `#13253F` | `#F7F9FC` | **14.60:1** | ✅ Conforme |
| Texte principal / carte blanche | `#13253F` | `#FFFFFF` | **15.39:1** | ✅ Conforme |
| Texte principal / fond secondaire | `#13253F` | `#EAF1FB` | **13.54:1** | ✅ Conforme |
| Texte secondaire / fond page | `#49627F` | `#F7F9FC` | **5.97:1** | ✅ Conforme |
| Texte secondaire / carte blanche | `#49627F` | `#FFFFFF` | **6.29:1** | ✅ Conforme |
| Texte secondaire / annonce fond page | `#49627F` | `#F7F9FC` | **5.97:1** | ✅ Conforme |
| Bleu institutionnel / fond page | `#1B3A6B` | `#F7F9FC` | **10.68:1** | ✅ Conforme |
| Bleu institutionnel / blanc | `#1B3A6B` | `#FFFFFF` | **11.27:1** | ✅ Conforme |
| Bleu institutionnel / secondaire | `#1B3A6B` | `#EAF1FB` | **9.91:1** | ✅ Conforme |
| Blanc / bleu institutionnel | `#FFFFFF` | `#1B3A6B` | **11.27:1** | ✅ Conforme |
| Blanc / rouge accent | `#FFFFFF` | `#D7263D` | **4.96:1** | ✅ Conforme |
| Rouge accent / fond page | `#D7263D` | `#F7F9FC` | **4.70:1** | ✅ Conforme |
| Rouge accent / blanc | `#D7263D` | `#FFFFFF` | **4.96:1** | ✅ Conforme |
| Rouge foncé / rose très clair | `#C51F34` | `#FFF0F2` | **5.25:1** | ✅ Conforme |
| Rouge foncé / blanc | `#C51F34` | `#FFFFFF` | **5.80:1** | ✅ Conforme |

**Couples sous 4,5:1 utilisés dans l’interface : aucun.** Le couple le plus serré est le rouge d’accent `#D7263D` sur le fond général `#F7F9FC`, à environ **4,70:1** ; il reste donc conforme AA pour du texte normal, mais ne doit pas être éclairci sans nouveau contrôle.

## Contrastes non textuels utiles au RGAA/WCAG 1.4.11

| Élément | Premier plan | Fond | Ratio | Seuil 3:1 |
|---|---:|---:|---:|---|
| Bordure de contrôles / blanc | `#7086A1` | `#FFFFFF` | **3.74:1** | ✅ Conforme |
| Bordure de contrôles / fond page | `#7086A1` | `#F7F9FC` | **3.55:1** | ✅ Conforme |
| Anneau de focus / blanc | `#2F6FB2` | `#FFFFFF` | **5.20:1** | ✅ Conforme |
| Anneau de focus / fond page | `#2F6FB2` | `#F7F9FC` | **4.93:1** | ✅ Conforme |

## États de la carte dans l’espace salarié

- **Au repos :** carte grand format, titulaire et solde visibles, pas de numéro de carte sensible.
- **Au paiement :** après clic sur « Payer » chez un partenaire, la même carte passe en état paiement et affiche le partenaire, le montant estimé et un QR visuel de confirmation.
- **Hiérarchie de page :** la zone carte occupe volontairement la majorité de la largeur ; les annonces partenaires sont compactes et secondaires.

## Inscription et authentification

- `/signup` contient deux formulaires distincts : **Entreprise** et **Partenaire**.
- Les deux formulaires envoient maintenant un `multipart/form-data` vers `POST /api/v1/signup`.
- Le Kbis PDF est stocké dans Garage ; sa `storageKey` est enregistrée dans `Document`.
- L'organisation est créée dans `Company` et son compte propriétaire dans `Users`, avec le rôle `COMPANY` ou `PARTNER`.
- La route ouvre immédiatement la session web avec le même cookie JWT HttpOnly que `POST /api/v1/login`.
- `/login`, `/profile`, `/employer` et `/partner` utilisent donc PostgreSQL comme source d'authentification principale.
- Le compte professionnel est créé avec `verified = false` afin qu'il puisse être contrôlé dans l'administration avant validation.
- Les anciennes routes Better Auth/SQLite restent présentes pour les prototypes historiques qui les utilisent encore, mais elles ne pilotent plus l'inscription professionnelle ni la page de connexion principale.

## Pré-requis d’exécution

- Node.js **22.13+**.
- PostgreSQL/PostGIS, Redis et Garage doivent être disponibles via l'environnement Docker prévu par le projet.
- Définir `JWT_SECRET`, `DATABASE_URL`, `GARAGE_DEFAULT_ACCESS_KEY` et `GARAGE_DEFAULT_SECRET_KEY` dans l'environnement d'exécution.
