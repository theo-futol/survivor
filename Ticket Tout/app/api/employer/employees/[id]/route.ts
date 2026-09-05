import { randomUUID } from "node:crypto"
import { unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import type { NextRequest } from "next/server"

import { auth } from "@/lib/auth"
import {
  employeeContractsDirectory,
  ensureEmployerEmployeeStorage,
  getEmployerEmployeeRequest,
  updateEmployerEmployeeRequest,
} from "@/lib/employer-employees"

const MAX_CONTRACT_SIZE = 10 * 1024 * 1024

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim()
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return Response.json({ error: "Non authentifié." }, { status: 401 })

  const user = session.user as typeof session.user & { accountType?: string }
  if (user.accountType !== "company") {
    return Response.json({ error: "Accès réservé aux comptes entreprise." }, { status: 403 })
  }

  const { id } = await context.params
  const current = getEmployerEmployeeRequest(id, session.user.id)
  if (!current) return Response.json({ error: "Demande introuvable." }, { status: 404 })

  const form = await request.formData()
  const employeeFirstName = text(form, "employeeFirstName")
  const employeeLastName = text(form, "employeeLastName")
  const employeeEmail = text(form, "employeeEmail").toLowerCase()
  const employeePhone = text(form, "employeePhone")
  const position = text(form, "position")
  const contractType = text(form, "contractType")
  const contractStartDate = text(form, "contractStartDate")
  const contractEndDate = text(form, "contractEndDate")
  const contract = form.get("contract")

  if (!employeeFirstName || !employeeLastName || !employeeEmail || !position || !contractType) {
    return Response.json({ error: "Tous les champs obligatoires doivent être renseignés." }, { status: 400 })
  }
  if (!/^\S+@\S+\.\S+$/.test(employeeEmail)) {
    return Response.json({ error: "L’adresse email du salarié n’est pas valide." }, { status: 400 })
  }
  if (!isIsoDate(contractStartDate) || !isIsoDate(contractEndDate) || contractEndDate < contractStartDate) {
    return Response.json({ error: "La période du contrat est invalide." }, { status: 400 })
  }
  if (!(contract instanceof File) || contract.size === 0) {
    return Response.json({ error: "Un nouveau contrat PDF est obligatoire pour renouveler ou modifier le contrat." }, { status: 400 })
  }
  if (contract.type !== "application/pdf" && !contract.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "Le contrat doit être fourni au format PDF." }, { status: 400 })
  }
  if (contract.size > MAX_CONTRACT_SIZE) {
    return Response.json({ error: "Le contrat ne doit pas dépasser 10 Mo." }, { status: 400 })
  }

  ensureEmployerEmployeeStorage()
  const storedName = `${randomUUID()}.pdf`
  await writeFile(path.join(employeeContractsDirectory, storedName), Buffer.from(await contract.arrayBuffer()))

  const updated = updateEmployerEmployeeRequest(id, session.user.id, {
    employeeFirstName,
    employeeLastName,
    employeeEmail,
    employeePhone,
    position,
    contractType,
    contractStartDate,
    contractEndDate,
    cardValidFrom: contractStartDate,
    cardValidUntil: contractEndDate,
    contractFileName: contract.name,
    contractStoredName: storedName,
    contractMimeType: "application/pdf",
    contractSize: contract.size,
    status: "pending",
    updatedAt: new Date().toISOString(),
  })

  if (!updated) {
    await unlink(path.join(employeeContractsDirectory, storedName)).catch(() => undefined)
    return Response.json({ error: "La mise à jour a échoué." }, { status: 500 })
  }

  await unlink(path.join(employeeContractsDirectory, current.contractStoredName)).catch(() => undefined)
  return Response.json({ request: updated })
}
