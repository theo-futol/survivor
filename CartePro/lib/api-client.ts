export type ApiRole = "EMPLOYEE" | "COMPANY" | "PARTNER" | "ADMIN"

export type ApiUser = {
  id: string
  email: string
  surname: string
  name: string
  role: ApiRole
  balance: number
  companyId: string | null
  createdAt: string
}

export type ApiCompanyCategory = {
  id: number
  category: string
}

export type CategoriesResponse = {
  categories: ApiCompanyCategory[]
}

export type ApiCompany = {
  id: string
  name: string
  email: string
  siret: string
  address: string
  postalCode: string
  verified: boolean
  isPartner: boolean
  categoryId: number
  category?: ApiCompanyCategory | null
  location?: unknown
  description?: string
  kbisId?: string
  agentId?: string | number | null
  reasonId?: number | null
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export type MeResponse = {
  user: ApiUser
  company: ApiCompany | null
}

export type ApiTransaction = {
  id: string
  type: "PAYMENT" | "REFUND" | "TOPUP"
  userId: string
  companyId: string | null
  amount: number
  originalTransactionId: string | null
  status: "REFUSER" | "VALIDER"
  createdAt: string
  updatedAt?: string
  newBalance?: number
}

export type ApiPartner = ApiCompany & {
  category: ApiCompanyCategory
  location: unknown
}

export type ApiSalary = {
  id: string
  email: string
  surname: string
  name: string
  balance: number
  companyId: string | null
  createdAt: string
  accountStatus: "PENDING" | "ACCEPTED" | "REFUSED"
  active: boolean
  isBanned: boolean
  transactionCount: number
  transactionTotal: number
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages?: number
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function apiFetch<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const hasBody = init.body !== undefined && !(init.body instanceof FormData)
  if (hasBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: init.cache ?? "no-store",
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : typeof payload === "string" && payload
          ? payload
          : `Erreur API (${response.status})`
    throw new ApiError(message, response.status)
  }

  return payload as T
}

export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

export function parsePoint(location: unknown): { latitude: number; longitude: number } | null {
  if (!location || typeof location !== "object") return null
  const point = location as { coordinates?: unknown; x?: unknown; y?: unknown; longitude?: unknown; latitude?: unknown }

  if (Array.isArray(point.coordinates) && point.coordinates.length >= 2) {
    const longitude = Number(point.coordinates[0])
    const latitude = Number(point.coordinates[1])
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude }
  }

  const longitude = Number(point.longitude ?? point.x)
  const latitude = Number(point.latitude ?? point.y)
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude }

  return null
}

export function roleHome(role: ApiRole) {
  if (role === "EMPLOYEE") return "/employee"
  if (role === "COMPANY") return "/employer"
  if (role === "ADMIN") return "/admin"
  return "/profile"
}
