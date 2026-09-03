import { DatabaseSync } from "node:sqlite"

import { auth, databasePath } from "@/lib/auth"
import { ensureAuthSchema } from "@/lib/auth-schema"
import { BRAND } from "@/lib/brand"

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
