import { DatabaseSync } from "node:sqlite"

import { auth, databasePath } from "@/lib/auth"
import { ensureAuthSchema } from "@/lib/auth-schema"
import { BRAND } from "@/lib/brand"

/**
 * @openapi
 * /api/demo/employee:
 *   post:
 *     summary: Provisionnement d'un compte salarié de démonstration
 *     description: Crée (ou réinitialise l'accès de) le compte salarié de démonstration défini par `BRAND.demoEmployee`. Idempotent — un compte déjà existant n'est pas recréé. Désactivé en production sauf si `ENABLE_DEMO_EMPLOYEE=true`.
 *     servers:
 *       - url: http://localhost:3000
 *         description: Serveur de développement local
 *     responses:
 *       '200':
 *         description: Compte de démonstration prêt.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DemoEmployeeResponse'
 *       '404':
 *         description: Démo désactivée en production.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEMO_EMPLOYEE !== "true") {
    return Response.json({ error: "Demo disabled" }, { status: 404 })
  }

  await ensureAuthSchema()

  try {
    await auth.api.signUpEmail({
      body: {
        name: BRAND.demoEmployee.name,
        email: BRAND.demoEmployee.email,
        password: BRAND.demoEmployee.password,
        accountType: "employee",
        organizationName: "Atelier Numérique SARL",
        phone: "",
        registrationNumber: "",
        legalRepresentative: "",
        jobTitle: "Salariée",
        address: "",
        postalCode: "",
        city: "Saint-Denis",
        partnerCategory: "",
      },
    })
  } catch {
    // Le compte existe probablement déjà : l'endpoint reste idempotent.
  }

  const database = new DatabaseSync(databasePath)
  database
    .prepare('UPDATE "user" SET "employeeAccess" = 1, "accountType" = ? WHERE "email" = ?')
    .run("employee", BRAND.demoEmployee.email)
  database.close()

  return Response.json({ ok: true })
}
