# Application carte avantages salariés

Prototype Next.js 16 avec authentification email/mot de passe, espace salarié protégé, inscription entreprise/partenaire, historique, partenaires géolocalisés, QR de paiement de démonstration et thème clair/sombre.

## Démarrage

Prérequis : Node.js 22.13+.

```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`. La racine est protégée : un visiteur non connecté est redirigé vers `/login`.

## Parcours disponibles

- **Salarié** : connexion uniquement, puis accès à la carte, au montant disponible, aux transactions, à la recherche/localisation des partenaires et au QR de paiement.
- **Entreprise** : création de compte avec raison sociale, SIRET, adresse, représentant, fonction, email professionnel et téléphone.
- **Partenaire** : même socle légal, avec catégorie d'activité en plus.
- L'inscription salarié n'est pas exposée publiquement. Un bouton de démonstration sur la connexion crée/ouvre un salarié de test en développement. En production, il est désactivé par défaut ; `ENABLE_DEMO_EMPLOYEE=true` l’active explicitement.

## QR code

`public/payment-qr-demo.png` est un **vrai QR code scannable**. La donnée encodée est volontairement statique pour la maquette. Il pourra ensuite être remplacé par un jeton de paiement signé côté serveur sans changer l'interface.

## Palette : source unique

Toute la palette se trouve dans :

```text
app/palette.css
```

Les thèmes clair et sombre y utilisent des variables CSS nommées. Les écrans consomment ces variables via Tailwind/CSS. Modifier une valeur dans ce fichier modifie donc l'ensemble de l'interface concernée.

## Nom de l'application : source unique

Le nom runtime se trouve uniquement dans :

```text
lib/brand.ts
```

Les titres d'onglet, écrans, en-têtes, pieds de page, erreurs et composants importent cette configuration. Les helpers `lib/app-copy.ts` servent aussi à construire les objets de mails et noms d'exports sans recopier le nom en dur.

Contrôle anti-duplication :

```bash
npm run brand:check
```

Le script échoue si le nom runtime a été recopié ailleurs dans le dépôt.

## Authentification

L'authentification utilise Better Auth et SQLite (`data/app-auth.sqlite`). Les routes protégées sont contrôlées dans `proxy.ts` avec validation de session côté serveur. Les comptes professionnels ne peuvent pas ouvrir les écrans réservés au salarié.

Variables utiles en déploiement :

```text
BETTER_AUTH_SECRET=une-cle-secrete-forte
BETTER_AUTH_URL=https://votre-domaine.fr
BETTER_AUTH_TRUSTED_ORIGINS=https://votre-domaine.fr
BETTER_AUTH_DB_PATH=/chemin/persistant/app-auth.sqlite
```

En production, stocker la base hors du répertoire éphémère de build et définir un secret fort.

## Structure principale

```text
app/
  login/          entrée publique
  signup/         inscription entreprise / partenaire
  page.tsx        tableau de bord salarié protégé
  transactions/   historique protégé
  partners/       recherche, carte et QR protégé
  profile/        profil connecté
  palette.css     palette unique clair / sombre
components/
lib/
  brand.ts        nom et identité runtime
  auth.ts         configuration Better Auth
  app-copy.ts     helpers mails / exports
public/
  payment-qr-demo.png
proxy.ts          contrôle d'accès Next.js 16
```

## Vérification Lighthouse

Pour mesurer les performances, ne lancez pas Lighthouse sur `npm run dev` : le mode développement charge HMR, source maps et JavaScript non minifié.

```bash
npm run build
npm run start
```

Puis lancez Lighthouse sur `http://localhost:3000/login`.

## Authentification locale

- URL locale par défaut : `http://localhost:3000`.
- Base locale persistante par défaut : `data/app-auth.sqlite`.
- L'ancien fichier `app-auth.sqlite` est migré automatiquement vers `data/app-auth.sqlite` si vous mettez à jour les fichiers dans le même dossier.
- En production, configurez `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_TRUSTED_ORIGINS` et un chemin/base persistant.
- L'avertissement Node concernant `node:sqlite` vient du runtime Node.js et n'empêche pas l'authentification. Pour une production durable, une base partagée (PostgreSQL/MySQL) reste préférable si l'application tourne sur plusieurs instances.

Pour contrôler rapidement la persistance des comptes locaux :

```bash
npm run auth:check
```

La commande affiche la base utilisée, les emails enregistrés, le type de compte et la présence du compte d'authentification associé, sans afficher de mot de passe.
