import { readFile } from "node:fs/promises"
import path from "node:path"
import type { NextRequest } from "next/server"

import { auth } from "@/lib/auth"
import { employeeContractsDirectory, getEmployerEmployeeRequest } from "@/lib/employer-employees"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return Response.json({ error: "Non authentifié." }, { status: 401 })

  const user = session.user as typeof session.user & { accountType?: string }
  if (user.accountType !== "company") {
    return Response.json({ error: "Accès réservé aux comptes entreprise." }, { status: 403 })
  }

  const { id } = await context.params
  const employeeRequest = getEmployerEmployeeRequest(id, session.user.id)
  if (!employeeRequest) return Response.json({ error: "Contrat introuvable." }, { status: 404 })

  try {
    const file = await readFile(path.join(employeeContractsDirectory, employeeRequest.contractStoredName))
    const safeName = employeeRequest.contractFileName.replace(/[\r\n"]/g, "_")
    return new Response(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    return Response.json({ error: "Le fichier du contrat n’est plus disponible." }, { status: 404 })
  }
}
