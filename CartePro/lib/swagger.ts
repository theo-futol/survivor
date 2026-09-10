import { createSwaggerSpec } from "next-swagger-doc"
import { version } from "@/package.json"

export async function getApiDocs() {
  return createSwaggerSpec({
    apiFolder: "app/api",

    definition: {
      openapi: "3.0.0",

      info: {
        title: "Carte Pro API",
        version,
        description: `
### Spécification officielle de l'API REST Carte Pro

Cette API assure la gestion complète de la plateforme **Carte Pro** : gestion des entreprises clientes, des dotations aux salariés, du réseau de partenaires marchands, ainsi que du flux transactionnel sécurisé par QR Code.

---

### 1. Rôles & Modèle de Sécurité
Les autorisations sont strictement appliquées par le middleware d'authentification (\`authorize\`) selon la matrice des rôles :
- **\`ADMIN\`** : Accès global de supervision, validation des comptes entreprises/partenaires, gestion des abondements, téléchargement des KBIS, bannissement d'utilisateurs et export comptable CSV.
- **\`COMPANY\`** : Espace entreprise employeur. Gestion de la fiche entreprise, gestion de ses salariés (création, consultation, édition, désactivation).
- **\`PARTNER\`** : Espace partenaire marchand agréé. Consultation de sa fiche, encaissement de transactions par scan de QR code, consultation de l'historique de caisse.
- **\`EMPLOYEE\`** : Espace salarié bénéficiaire. Consultation du solde en temps réel, génération de QR codes de paiement éphémères, historique personnel de transactions.

---

### 2. Authentification & Sessions
Deux modes d'authentification interchangeables sont pris en charge :
1. **Header HTTP** : \`Authorization: Bearer <token>\`
2. **Cookie de session** : Cookie HttpOnly \`cartepro_token\` (\`SameSite=Lax\`, sécurisé en production) déposé automatiquement lors des requêtes \`POST /api/v1/login\` ou \`POST /api/v1/signup\`.

L'invalidation de session s'effectue via \`DELETE /api/v1/login\`.

---

### 3. Conventions Techniques & Monétaires
- **Montants financiers** : Tous les montants (\`balance\`, \`amount\`, \`montant\`) sont impérativement exprimés en **centimes d'euro** sous forme d'**entiers strictement positifs** (\`1500\` = 15,00 €).
- **Suppression logique** : Afin de préserver l'intégrité de l'historique comptable et transactionnel immuable, les suppressions ne détruisent jamais les lignes :
  - Pour une entreprise (\`Company\`) : \`active = false\`.
  - Pour un utilisateur / salarié (\`Users\`) : \`expiredAt\` est horodaté à l'instant de la révocation.
- **Protection contre les injections** : Les champs de saisie textuelle rejettent explicitement les caractères \`< > ' " &\`.
- **Formats de pagination** :
  - **Format A** (Entreprises, Partenaires, Salariés) : \`{ data: [...], meta: { page, limit, total } }\`
  - **Format B** (Transactions) : \`{ transactions: [...], meta: { page, limit, totalCount, totalPages, hasNextPage, hasPrevPage } }\`

---

### 4. Format Uniforme des Erreurs
En cas d'échec (codes HTTP \`4xx\` ou \`5xx\`), le corps de réponse respecte toujours la structure :
\`\`\`json
{
  "error": "Message explicatif de l'erreur survenue"
}
\`\`\`
`,
        contact: {
          name: "Équipe Technique Carte Pro",
          url: "https://localhost:3000",
        },
      },

      servers: [
        {
          url: "/",
          description: "Serveur API courant",
        },
        {
          url: "https://localhost:3000",
          description: "Environnement local de développement",
        },
      ],

      tags: [
        {
          name: "Authentification",
          description: "Gestion des connexions, déconnexions et inscriptions des entreprises / partenaires.",
        },
        {
          name: "Utilisateurs",
          description: "Consultation du profil utilisateur connecté et de son entreprise de rattachement.",
        },
        {
          name: "Employeurs",
          description: "Gestion des entreprises employeurs, mise à jour administrative et suppression logique.",
        },
        {
          name: "Abondements",
          description: "Distribution collective de dotations financières aux salariés d'une entreprise employeur.",
        },
        {
          name: "Salariés",
          description: "Gestion des salariés bénéficiaires, activation, édition de profil et consultation des soldes.",
        },
        {
          name: "Partenaires",
          description: "Annuaire et gestion des partenaires marchands acceptant la Carte Pro.",
        },
        {
          name: "Transactions",
          description: "Encaissement des paiements salariés par QR code et historique des transactions.",
        },
        {
          name: "QR Code",
          description: "Génération de codes de paiement éphémères (5 minutes) et résolution d'encaissement marchand.",
        },
        {
          name: "Administration",
          description: "Supervision système : bannissement d'utilisateurs, export CSV complet et consultation des KBIS.",
        },
        {
          name: "Catégories",
          description: "Référentiel des secteurs d'activité professionnelle.",
        },
      ],

      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Jeton JWT transmis dans l'en-tête HTTP 'Authorization: Bearer <token>'",
          },
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "cartepro_token",
            description: "Cookie de session HttpOnly 'cartepro_token' posé automatiquement lors de la connexion",
          },
        },
        schemas: {
          ErrorResponse: {
            type: "object",
            required: ["error"],
            properties: {
              error: {
                type: "string",
                description: "Description de l'erreur survenue",
                example: "Paramètres de requête invalides",
              },
            },
          },
          PaginationMetaA: {
            type: "object",
            required: ["page", "limit", "total"],
            properties: {
              page: {
                type: "integer",
                description: "Numéro de la page courante (commence à 1)",
                example: 1,
              },
              limit: {
                type: "integer",
                description: "Nombre d'éléments par page",
                example: 20,
              },
              total: {
                type: "integer",
                description: "Nombre total d'éléments disponibles",
                example: 42,
              },
            },
          },
          PaginationMetaB: {
            type: "object",
            required: ["page", "limit", "totalCount", "totalPages", "hasNextPage", "hasPrevPage"],
            properties: {
              page: {
                type: "integer",
                description: "Numéro de la page courante (commence à 1)",
                example: 1,
              },
              limit: {
                type: "integer",
                description: "Nombre d'éléments par page",
                example: 20,
              },
              totalCount: {
                type: "integer",
                description: "Nombre total de transactions",
                example: 42,
              },
              totalPages: {
                type: "integer",
                description: "Nombre total de pages",
                example: 3,
              },
              hasNextPage: {
                type: "boolean",
                description: "Indique si une page suivante existe",
                example: true,
              },
              hasPrevPage: {
                type: "boolean",
                description: "Indique si une page précédente existe",
                example: false,
              },
            },
          },
          UserSummary: {
            type: "object",
            required: ["id", "email", "surname", "name", "role", "balance", "createdAt"],
            properties: {
              id: {
                type: "string",
                format: "uuid",
                example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
              },
              email: {
                type: "string",
                format: "email",
                example: "j.dupont@entreprise.fr",
              },
              surname: {
                type: "string",
                description: "Nom de famille",
                example: "Dupont",
              },
              name: {
                type: "string",
                description: "Prénom",
                example: "Jean",
              },
              role: {
                type: "string",
                enum: ["ADMIN", "COMPANY", "PARTNER", "EMPLOYEE"],
                example: "EMPLOYEE",
              },
              balance: {
                type: "integer",
                description: "Solde disponible en centimes d'euro",
                example: 15000,
              },
              companyId: {
                type: "string",
                format: "uuid",
                nullable: true,
                example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              },
              createdAt: {
                type: "string",
                format: "date-time",
                example: "2026-09-01T10:00:00.000Z",
              },
            },
          },
          CompanyDetail: {
            type: "object",
            required: ["id", "name", "email", "siret", "address", "postalCode", "verified", "isPartner", "categoryId"],
            properties: {
              id: {
                type: "string",
                format: "uuid",
                example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              },
              name: {
                type: "string",
                example: "Acme Corp SAS",
              },
              email: {
                type: "string",
                format: "email",
                example: "contact@acmepartner.fr",
              },
              siret: {
                type: "string",
                pattern: "^\\d{14}$",
                example: "12345678901234",
              },
              address: {
                type: "string",
                example: "12 rue de la République",
              },
              postalCode: {
                type: "string",
                pattern: "^\\d{5}$",
                example: "13001",
              },
              verified: {
                type: "boolean",
                description: "Indique si l'entreprise a été validée par un administrateur",
                example: true,
              },
              isPartner: {
                type: "boolean",
                description: "true pour un partenaire marchand, false pour une entreprise employeur",
                example: false,
              },
              categoryId: {
                type: "integer",
                example: 1,
              },
              description: {
                type: "string",
                nullable: true,
                example: "Entreprise de conseil et ingénierie",
              },
              category: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "integer", example: 1 },
                  category: { type: "string", example: "Services" },
                },
              },
            },
          },
          TransactionDetail: {
            type: "object",
            required: ["id", "amount", "status", "type", "createdAt", "updatedAt"],
            properties: {
              id: {
                type: "string",
                format: "uuid",
                example: "c71a3932-d17e-4629-9dc4-1b4d3752eef5",
              },
              amount: {
                type: "integer",
                description: "Montant de la transaction en centimes d'euro",
                example: 2450,
              },
              status: {
                type: "string",
                enum: ["VALIDER", "REFUSER"],
                example: "VALIDER",
              },
              type: {
                type: "string",
                enum: ["PAYMENT", "REFUND", "TOPUP"],
                example: "PAYMENT",
              },
              userId: {
                type: "string",
                format: "uuid",
                example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
              },
              companyId: {
                type: "string",
                format: "uuid",
                nullable: true,
                example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              },
              createdAt: {
                type: "string",
                format: "date-time",
                example: "2026-09-02T12:30:00.000Z",
              },
              updatedAt: {
                type: "string",
                format: "date-time",
                example: "2026-09-02T12:30:00.000Z",
              },
            },
          },
        },
      },
    },
  })
}
