import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import type { NextRequest } from "next/server"

import { auth } from "@/lib/auth"
import {
  employeeContractsDirectory,
  ensureEmployerEmployeeStorage,
  insertEmployerEmployeeRequest,
  listEmployerEmployeeRequests,
  type EmployerEmployeeRequest,
} from "@/lib/employer-employees"

const MAX_CONTRACT_SIZE = 10 * 1024 * 1024

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim()
}

async function getCompanySession(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { error: Response.json({ error: "Non authentifié." }, { status: 401 }) }

  const user = session.user as typeof session.user & {
    accountType?: string
    organizationName?: string
  }
  if (user.accountType !== "company") {
    return { error: Response.json({ error: "Accès réservé aux comptes entreprise." }, { status: 403 }) }
  }

  return { session, user }
}

export async function GET(request: NextRequest) {
  const result = await getCompanySession(request)
  if ("error" in result) return result.error

  return Response.json({ requests: listEmployerEmployeeRequests(result.session.user.id) })
}

export async function POST(request: NextRequest) {
  const result = await getCompanySession(request)
  if ("error" in result) return result.error

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
  if (!isIsoDate(contractStartDate) || !isIsoDate(contractEndDate)) {
    return Response.json({ error: "Les dates du contrat sont invalides." }, { status: 400 })
  }
  if (contractEndDate < contractStartDate) {
    return Response.json({ error: "La date de fin doit être postérieure ou égale à la date de début." }, { status: 400 })
  }
  if (!(contract instanceof File) || contract.size === 0) {
    return Response.json({ error: "Le contrat de travail au format PDF est obligatoire." }, { status: 400 })
  }
  if (contract.type !== "application/pdf" && !contract.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "Le contrat doit être fourni au format PDF." }, { status: 400 })
  }
  if (contract.size > MAX_CONTRACT_SIZE) {
    return Response.json({ error: "Le contrat ne doit pas dépasser 10 Mo." }, { status: 400 })
  }

  ensureEmployerEmployeeStorage()
  const id = randomUUID()
  const storedName = `${id}.pdf`
  await writeFile(path.join(employeeContractsDirectory, storedName), Buffer.from(await contract.arrayBuffer()))

  const now = new Date().toISOString()
  const employeeRequest: EmployerEmployeeRequest = {
    id,
    companyUserId: result.session.user.id,
    companyName: result.user.organizationName ?? "",
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
    version: 1,
    createdAt: now,
    updatedAt: now,
  }

  insertEmployerEmployeeRequest(employeeRequest)
  return Response.json({ request: employeeRequest }, { status: 201 })
}
