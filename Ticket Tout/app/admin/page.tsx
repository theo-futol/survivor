"use client"

import { useEffect, useState } from "react"
import {
  Building2,
  ChevronRight,
  Download,
  FileText,
  Mail,
  MapPin,
  Shield,
  Users,
  WalletCards,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar-admin"
import { SiteHeader } from "@/components/site-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  apiFetch,
  formatMoney,
  type ApiCompany,
  type ApiSalary,
  type MeResponse,
  type PaginationMeta,
} from "@/lib/api-client"

export type AdminTab = "employee" | "account" | "business" 

export const iframeHeight = "800px"
export const description = "An administration page with dynamic tab navigation."

type PagedResponse<T> = {
  data: T[]
  meta: PaginationMeta
}

export interface Person {
  id: string
  name: string
  email?: string
}

export interface AdminEmployee extends Person {
  businessName: string
  balance: number
  isBanned: boolean
  transactionCount: number
  transactionTotal: number
  createdAt: string
}

export interface Business {
  id: string
  name: string
  email: string
  siret: string
  kbisUrl: string
  address: string
  postalCode: string
  verified: boolean
  employees: Person[]
}

export interface AdminAccount extends Person {
  role: string
  createdAt: string
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const all: T[] = []
  let page = 1

  while (true) {
    const separator = path.includes("?") ? "&" : "?"
    const response = await apiFetch<PagedResponse<T>>(`${path}${separator}page=${page}&limit=100`)

    all.push(...response.data)

    const totalPages =
      response.meta.totalPages ??
      Math.max(1, Math.ceil(response.meta.total / Math.max(1, response.meta.limit)))

    if (page >= totalPages || all.length >= response.meta.total || response.data.length === 0) {
      break
    }

    page += 1
  }

  return all
}

const dbService = {
  async getEmployees(): Promise<AdminEmployee[]> {
    const [employees, companies] = await Promise.all([
      fetchAllPages<ApiSalary>("/api/v1/salaries"),
      fetchAllPages<ApiCompany>("/api/v1/employeurs"),
    ])

    const companyNames = new Map(companies.map((company) => [company.id, company.name]))

    return employees.map((employee) => ({
      id: employee.id,
      name: `${employee.name} ${employee.surname}`.trim(),
      email: employee.email,
      businessName: employee.companyId ? (companyNames.get(employee.companyId) ?? "Entreprise inconnue") : "Non rattaché",
      balance: employee.balance,
      isBanned: employee.isBanned,
      transactionCount: employee.transactionCount,
      transactionTotal: employee.transactionTotal,
      createdAt: employee.createdAt,
    }))
  },

  async getBusinesses(): Promise<Business[]> {
    const [companies, employees] = await Promise.all([
      fetchAllPages<ApiCompany>("/api/v1/employeurs"),
      fetchAllPages<ApiSalary>("/api/v1/salaries"),
    ])

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      email: company.email,
      siret: company.siret,
      kbisUrl: `/api/v1/admin/employeurs/${company.id}/kbis`,
      address: company.address,
      postalCode: company.postalCode,
      verified: company.verified,
      employees: employees
        .filter((employee) => employee.companyId === company.id)
        .map((employee) => ({
          id: employee.id,
          name: `${employee.name} ${employee.surname}`.trim(),
          email: employee.email,
        })),
    }))
  },

  async getAdminAccount(): Promise<AdminAccount> {
    const response = await apiFetch<MeResponse>("/api/v1/me")
    const user = response.user

    return {
      id: user.id,
      name: `${user.name} ${user.surname}`.trim(),
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    }
  },
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<AdminTab>("employee")

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar activeTab={activeTab} onSelectTab={setActiveTab} />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
              {activeTab === "employee" && <EmployeeView />}
              {activeTab === "account" && <AccountView />}
              {activeTab === "business" && <BusinessView />}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}

function EmployeeView() {
  const [employees, setEmployees] = useState<AdminEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dbService
      .getEmployees()
      .then(setEmployees)
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Impossible de charger les salariés.")
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Chargement...</div>

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const bannedCount = employees.filter((employee) => employee.isBanned).length
  const transactionCount = employees.reduce((sum, employee) => sum + employee.transactionCount, 0)

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Employés</h2>
        <p className="text-sm text-muted-foreground">
          Liste des comptes salariés enregistrés dans la base de données Carte Pro.
        </p>
      </div>

      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <StatCard label="Employés" value={employees.length} />
        <StatCard label="Comptes bannis" value={bannedCount} />
        <StatCard label="Transactions" value={transactionCount} />
      </div>

      {employees.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">Aucun salarié enregistré en base.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/20">
          <div className="divide-y">
            {employees.map((employee) => (
              <div key={employee.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(employee.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium leading-tight">{employee.name}</p>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{employee.businessName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Créé le {formatDate(employee.createdAt)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Badge variant={employee.isBanned ? "destructive" : "secondary"}>
                    {employee.isBanned ? "Banni" : "Actif"}
                  </Badge>
                  <Badge variant="outline">
                    <WalletCards className="mr-1 h-3 w-3" />
                    {formatMoney(employee.balance)}
                  </Badge>
                  <Badge variant="outline">{employee.transactionCount} transaction{employee.transactionCount > 1 ? "s" : ""}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AccountView() {
  const [adminAccount, setAdminAccount] = useState<AdminAccount | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dbService.getAdminAccount().then(setAdminAccount).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Impossible de charger le compte administrateur.")
    })
  }, [])

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!adminAccount) return <div className="p-4 text-sm text-muted-foreground">Chargement...</div>

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h2 className="text-2xl font-bold tracking-tight">Compte administrateur</h2>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">{initials(adminAccount.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold leading-tight">{adminAccount.name}</p>
            <Badge variant="secondary" className="mt-1">
              <Shield className="mr-1 h-3 w-3" />
              {adminAccount.role}
            </Badge>
          </div>
        </div>

        <Separator className="my-4" />

        <dl className="grid gap-3 sm:grid-cols-2">
          {adminAccount.email && <InfoRow icon={Mail} label="Email" value={adminAccount.email} />}
          <InfoRow icon={Users} label="Identifiant" value={adminAccount.id} />
          <InfoRow icon={Shield} label="Rôle" value={adminAccount.role} />
          <InfoRow icon={WalletCards} label="Compte créé" value={formatDate(adminAccount.createdAt)} />
        </dl>
      </div>
    </div>
  )
}

function BusinessView() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dbService
      .getBusinesses()
      .then(setBusinesses)
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Impossible de charger les entreprises.")
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Chargement...</div>

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Entreprises employeuses</h2>
        <p className="text-sm text-muted-foreground">
          Entreprises enregistrées dans la base de données, avec leurs salariés rattachés.
        </p>
      </div>

      <div className="grid auto-rows-min gap-4 md:grid-cols-4">
        <StatCard label="Entreprises" value={businesses.length} />
        <StatCard label="Employés au total" value={businesses.reduce((sum, business) => sum + business.employees.length, 0)} />
        <StatCard label="Sans employé" value={businesses.filter((business) => business.employees.length === 0).length} />
        <StatCard label="Vérifiées" value={businesses.filter((business) => business.verified).length} />
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">Aucune entreprise enregistrée en base.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {businesses.map((business) => (
            <button
              type="button"
              key={business.id}
              onClick={() => setSelectedBusiness(business)}
              className="group relative w-full cursor-pointer rounded-xl border bg-muted/20 p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="flex items-center gap-2 font-semibold transition-colors group-hover:text-primary">
                    <Building2 className="h-4 w-4" />
                    {business.name}
                    <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{business.email}</p>
                  {business.address && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {business.address} {business.postalCode}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-xs text-muted-foreground">SIRET : {business.siret}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={business.verified ? "default" : "outline"} className="w-fit">
                    {business.verified ? "Vérifiée" : "À vérifier"}
                  </Badge>
                  <Badge variant="secondary" className="w-fit">
                    <Users className="mr-1 h-3 w-3" />
                    {business.employees.length} employé{business.employees.length > 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>

              {business.employees.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="flex flex-wrap gap-2">
                    {business.employees.map((employee) => (
                      <span key={employee.id} className="rounded-full border bg-background px-3 py-1 text-xs">
                        {employee.name}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selectedBusiness} onOpenChange={(open) => !open && setSelectedBusiness(null)}>
        {selectedBusiness && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5" />
                {selectedBusiness.name}
              </DialogTitle>
              <DialogDescription>Informations enregistrées dans la base Carte Pro.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <DetailRow label="Email" value={selectedBusiness.email} />
                <Separator />
                <DetailRow label="SIRET" value={selectedBusiness.siret} mono />
                <Separator />
                <DetailRow
                  label="Adresse"
                  value={`${selectedBusiness.address} ${selectedBusiness.postalCode}`.trim()}
                />
                <Separator />
                <DetailRow label="Statut" value={selectedBusiness.verified ? "Vérifiée" : "À vérifier"} />
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Document administratif</p>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">Extrait KBIS</p>
                      <p className="text-xs text-muted-foreground">Document stocké de manière sécurisée dans Garage</p>
                    </div>
                  </div>
                  <Button size="sm" variant="default" asChild>
                    <a href={selectedBusiness.kbisUrl}>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="aspect-video rounded-xl bg-muted/50 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-all text-sm">{value}</dd>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label} :</span>
      <span className={mono ? "font-mono font-medium" : "text-right font-medium"}>{value || "—"}</span>
    </div>
  )
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
