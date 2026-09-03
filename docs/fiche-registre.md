# Fiche de référence — Registre des activités de traitement (RGPD)

### Activité : Ticket Tout — Le dispositif de crédit pour les salariés chez les partenaires référencés par le Ministère

#### Informations générales

| Champ | Valeur |
|---|---|
| Date de création de la fiche | 1 septembre 2026 |
| Date de dernière mise à jour de la fiche | 2 septembre 2026 |

#### Objectifs poursuivis

**Finalité principale**

Permettre aux employeurs de créditer leurs salariés de crédits (simulation) utilisables auprès d'un réseau de partenaires référencés par le Ministère.

**Finalités secondaires**

- Valider les transactions par QR code.
- Assurer le suivi des transactions et le pilotage national du dispositif.

#### Catégories de personnes concernées

| # | Valeur |
|---|---|
| 1 | Salariés |
| 2 | Employeurs |
| 3 | Partenaires |
| 4 | Agents de l'administration (Ministère) |

#### Catégories de données collectées

| Catégorie | Cochée (Oui/Non) | Détail |
|---|---|---|
| État-civil, identité, données d'identification, images | Oui | Nom, prénom, coordonnées des comptes salarié, employeur, partenaire et administration |
| Vie personnelle | Non | |
| Vie professionnelle | Oui | Informations employeur (éligibilité des salariés), activité du partenaire |
| Situation économique et financière | Non | Crédits/soldes purement simulés (aucune valeur monétaire réelle) |
| Données de connexion | Oui | Identifiants de connexion aux comptes, historique des transactions |
| Données de localisation | Oui | Géolocalisation optionnelle de l'utilisateur pour la recherche de partenaires |
| Données Internet | Oui | Cookies analytiques |
| Autres catégories de données | Oui | QR code de paiement, historique des transactions |

#### Durées de conservation

| Champ | Valeur |
|---|---|
| Durée | Crédits/solde non consommé : reste utilisable jusqu'au dernier jour de février de l'année suivante, reporté automatiquement un an (une seule fois) ou converti en don. Données de compte (identité, connexion, transactions) : 13 mois avant purge. |

#### Catégories de destinataires des données

**Destinataires internes**

| # | Valeur |
|---|---|
| 1 | Administration (Ministère) |
| 2 | Entreprise de services |

**Organismes externes**

| # | Valeur |
|---|---|
| 1 | Partenaires référencés par le Ministère |

**Hebergement des données et de l'application**

*Non déterminé dans le cadre de ce projet.*

#### Mesures de sécurité

| Mesure | Valeur |
|---|---|
| Contrôle d'accès des utilisateurs | Authentification par identifiant/mot de passe, gestion des rôles par type de compte (salarié, employeur, partenaire, administration), déconnexion automatique après inactivité / bannissement et token valide 30 minutes |
| Mesures de traçabilité | Journalisation des transactions (identifiant, date et heure), conservée 13 mois |
| Mesures de protection des logiciels | Mises à jour régulières et correctifs de sécurité, antivirus sur les postes d'administration, tests avant mise en production + tests automatisés à chaque nouvelle version |
| Sauvegarde des données | Sauvegardes régulières automatisées de la base de données |
| Chiffrement des données | Site accessible en HTTPS, chiffrement TLS des échanges, mots de passe stockés hachés, contenu des QR codes de paiement haché (SHA-256) |
| Contrôle des sous-traitants | Clause de confidentialité et de sécurité des données intégrée aux contrats avec les prestataires techniques |

---

## Schéma de données technique

Détail des tables et colonnes de la base applicative, avec la mesure de sécurisation retenue pour chaque donnée.

### `users`

| Colonne | Type | Donnée personnelle | Sécurisation |
|---|---|---|---|
| id | text | Non (identifiant technique) | — |
| name | text | Oui (identité) | Accès restreint par rôle applicatif ; chiffrement de la base au repos (base64) |
| surname | text | Oui (identité) | Accès restreint par rôle applicatif ; chiffrement de la base au repos (base64) |
| email | text | Oui (identité/contact) | Accès restreint par rôle applicatif ; chiffrement de la base au repos (base64) |
| password | text | Oui (donnée d'authentification) | Haché avant stockage (SHA-256), jamais stocké ni journalisé en clair |
| role | text | Non (référence technique ; valeurs possibles : EMPLOYEE, COMPANY, PARTNER, ADMIN) | — |
| documentId | text | Non (référence technique) | Contrôle d'accès sur le document référencé (KBIS) |
| balance | integer | Non (solde simulé, aucune valeur monétaire réelle) | — |
| expiredAt | timestamp | Non (métadonnée technique) | — |
| createdAt / updatedAt | timestamp | Non (métadonnée technique) | — |

### `company`

| Colonne | Type | Donnée personnelle | Sécurisation |
|---|---|---|---|
| id | text | Non (identifiant technique) | — |
| name | text | Oui (identité de l'entreprise/partenaire) | Accès restreint par rôle applicatif ; chiffrement de la base au repos (base64) |
| email | text | Oui (contact professionnel) | Accès restreint par rôle applicatif ; chiffrement de la base au repos (base64) |
| address | text | Oui (adresse professionnelle) | Accès restreint par rôle applicatif ; chiffrement de la base au repos (base64) |
| postalCode | text | Oui (adresse professionnelle) | Accès restreint par rôle applicatif ; chiffrement de la base au repos (base64) |
| siret | text | Oui (identifiant d'entreprise) | Accès restreint par rôle applicatif ; chiffrement de la base au repos (base64) |
| kbisId | text | Non (référence technique) | Contrôle d'accès sur le document KBIS référencé |
| agentId | integer | Non (référence technique) | — |
| categoryId | integer | Non (référence technique) | — |
| reasonId | integer | Non (référence technique) | — |
| isPartner | boolean | Non | — |
| isFeatured | boolean | Non (mise en avant du partenaire, sans lien avec une personne) | — |
| verified | boolean | Non | — |
| createdAt / updatedAt | timestamp | Non (métadonnée technique) | — |

### `document`

| Colonne | Type | Donnée personnelle | Sécurisation |
|---|---|---|---|
| id | text | Non (identifiant technique) | — |
| storageKey | text | Non (pointeur de stockage) | Accès restreint au stockage de fichiers (KBIS), URL/clé non exposée publiquement |
| mimeType | text | Non (métadonnée technique) | — |
| size | integer | Non (métadonnée technique) | — |
| createdAt | timestamp | Non (métadonnée technique) | — |

### `transaction`

| Colonne | Type | Donnée personnelle | Sécurisation |
|---|---|---|---|
| id | text | Non (identifiant technique) | — |
| originalTransactionId | text | Non (référence technique, relie un `REFUND` à sa transaction d'origine) | — |
| amount | integer | Non (valeur simulée, aucune valeur monétaire réelle) | — |
| type | text | Non (`PAYMENT` / `REFUND`) | — |
| userId | text | Oui (relie la transaction à un salarié identifié) | Accès restreint par rôle applicatif (salarié concerné + administration) |
| companyId | text | Oui (relie la transaction à une entreprise/un partenaire identifié) | Accès restreint par rôle applicatif (partenaire concerné + administration) |
| createdAt | timestamp | Non (métadonnée technique) | — |

### `qrCode`

QR code de paiement généré côté salarié pour valider une transaction ; courte durée de vie (expiration à 5 minutes).

| Colonne | Type | Donnée personnelle | Sécurisation |
|---|---|---|---|
| id | integer | Non (identifiant technique) | — |
| content | text | Oui (jeton de validation d'un paiement, lié indirectement à une personne) | **Haché en SHA-256 avant stockage**, jamais stocké ni journalisé en clair (même traitement que `users.password`) |
| userId | text | Oui (relie le QR code au salarié) | Accès restreint par rôle applicatif |
| companyId | text | Non (référence technique) | — |
| expiredAt | timestamp | Non (métadonnée technique) | Expiration à 5 minutes |

### `ministerFavorite`

| Colonne | Type | Donnée personnelle | Sécurisation |
|---|---|---|---|
| id | integer | Non (identifiant technique) | — |
| companyId | text | Non (référence technique, favori du Ministère sur une entreprise) | — |

### `administration`

| Colonne | Type | Donnée personnelle | Sécurisation |
|---|---|---|---|
| id | integer | Non (identifiant technique) | — |
| name | text | Oui (nom de l'agent/service administratif) | Accès restreint aux comptes administration |

*Les tables de données sont toujours sujet à modification en fonction des besoins et des évolutions du service, c'est pourquoi ce document est régulièrement révisé et mis à jour.*
