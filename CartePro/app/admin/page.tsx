"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  Store,
  Trash2,
  UserCheck,
  Users,
  WalletCards,
  XCircle,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  ApiError,
  apiFetch,
  formatMoney,
  parsePoint,
  type ApiCompany,
  type ApiPartner,
  type ApiSalary,
  type ApiTransaction,
  type MeResponse,
  type PaginationMeta,
} from "@/lib/api-client"

export type AdminTab = "dashboard" | "partners" | "employee" | "business" | "topups" | "account"

export const iframeHeight = "800px"
export const description = "Espace d'administration national Carte Pro."

type PagedResponse<T> = {
  data: T[]
  meta: PaginationMeta
}

type TransactionPaginationMeta = {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNextPage?: boolean
  hasPrevPage?: boolean
}

type TransactionsResponse = {
  transactions: ApiTransaction[]
  meta: TransactionPaginationMeta
}

type TopupResponse = {
  montant: number
  salariesCredites: number
  montantTotal: number
}

export interface Person {
  id: string
  name: string
  email?: string
}

export interface AdminEmployee extends Person {
  businessName: string
  companyId: string | null
  balance: number
  accountStatus: "PENDING" | "ACCEPTED" | "REFUSED"
  active: boolean
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
  active: boolean
  description?: string
  createdAt?: string
  employees: Person[]
}

export interface AdminAccount extends Person {
  role: string
  createdAt: string
}

type NationalTransaction = ApiTransaction & {
  partnerId: string
  partnerName: string
  partnerCategory: string
  partnerPostalCode: string
  partnerAddress: string
}

type AdminPartner = ApiPartner & {
  categoryName: string
  latitude: number | null
  longitude: number | null
  transactionCount: number
  transactionAmount: number
  paymentCount: number
  refundCount: number
  validatedCount: number
  refusedCount: number
  lastTransactionAt: string | null
  transactions: NationalTransaction[]
}

type TopupTransaction = ApiTransaction & {
  employeeId: string
  employeeName: string
  employerId: string | null
  employerName: string
}

type NationalData = {
  partners: AdminPartner[]
  transactions: NationalTransaction[]
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

    if (page >= totalPages || all.length >= response.meta.total || response.data.length === 0) break
    page += 1
  }

  return all
}

async function fetchAllTransactions(path: string, allowNotFound = false): Promise<ApiTransaction[]> {
  const all: ApiTransaction[] = []
  let page = 1

  while (true) {
    const separator = path.includes("?") ? "&" : "?"

    try {
      const response = await apiFetch<TransactionsResponse>(`${path}${separator}page=${page}&limit=100`)
      all.push(...(response.transactions ?? []))

      if (page >= Math.max(1, response.meta.totalPages) || response.transactions.length === 0) break
      page += 1
    } catch (caught) {
      if (allowNotFound && caught instanceof ApiError && caught.status === 404) return []
      throw caught
    }
  }

  return all
}

function buildDemoNationalData(): NationalData {
  const partners: AdminPartner[] = [
    {
      id: "demo-partner-1",
      name: "Le Comptoir des Saveurs",
      email: "contact@saveurs-demo.fr",
      siret: "123 456 789 00012",
      address: "12 avenue des Écoles",
      postalCode: "75015",
      verified: true,
      isPartner: true,
      categoryId: 9,
      category: { id: 9, category: "Restaurant" },
      categoryName: "Restaurant",
      latitude: 48.8425,
      longitude: 2.3237,
      transactionCount: 12,
      transactionAmount: 184500,
      paymentCount: 10,
      refundCount: 1,
      validatedCount: 12,
      refusedCount: 1,
      lastTransactionAt: "2026-09-09T08:15:00Z",
      transactions: [
        {
          id: "demo-tx-1",
          type: "PAYMENT",
          userId: "demo-user-1",
          companyId: "demo-company-1",
          amount: 1750,
          originalTransactionId: null,
          status: "VALIDER",
          createdAt: "2026-09-09T08:15:00Z",
          partnerId: "demo-partner-1",
          partnerName: "Le Comptoir des Saveurs",
          partnerCategory: "Restaurant",
          partnerPostalCode: "75015",
          partnerAddress: "12 avenue des Écoles",
        },
        {
          id: "demo-tx-2",
          type: "PAYMENT",
          userId: "demo-user-2",
          companyId: "demo-company-2",
          amount: 2450,
          originalTransactionId: null,
          status: "VALIDER",
          createdAt: "2026-09-08T12:45:00Z",
          partnerId: "demo-partner-1",
          partnerName: "Le Comptoir des Saveurs",
          partnerCategory: "Restaurant",
          partnerPostalCode: "75015",
          partnerAddress: "12 avenue des Écoles",
        },
        {
          id: "demo-tx-3",
          type: "REFUND",
          userId: "demo-user-3",
          companyId: "demo-company-3",
          amount: 500,
          originalTransactionId: null,
          status: "VALIDER",
          createdAt: "2026-09-08T18:10:00Z",
          partnerId: "demo-partner-1",
          partnerName: "Le Comptoir des Saveurs",
          partnerCategory: "Restaurant",
          partnerPostalCode: "75015",
          partnerAddress: "12 avenue des Écoles",
        },
      ],
      location: { type: "Point", coordinates: [2.3237, 48.8425] },
    },
    {
      id: "demo-partner-2",
      name: "Boutique Énergie",
      email: "bonjour@energie-demo.fr",
      siret: "564 789 321 00014",
      address: "28 rue de la République",
      postalCode: "69002",
      verified: true,
      isPartner: true,
      categoryId: 7,
      category: { id: 7, category: "Commerce" },
      categoryName: "Commerce",
      latitude: 45.7591,
      longitude: 4.8312,
      transactionCount: 8,
      transactionAmount: 112300,
      paymentCount: 7,
      refundCount: 0,
      validatedCount: 8,
      refusedCount: 1,
      lastTransactionAt: "2026-09-07T17:40:00Z",
      transactions: [
        {
          id: "demo-tx-4",
          type: "PAYMENT",
          userId: "demo-user-4",
          companyId: "demo-company-4",
          amount: 2300,
          originalTransactionId: null,
          status: "VALIDER",
          createdAt: "2026-09-07T17:40:00Z",
          partnerId: "demo-partner-2",
          partnerName: "Boutique Énergie",
          partnerCategory: "Commerce",
          partnerPostalCode: "69002",
          partnerAddress: "28 rue de la République",
        },
        {
          id: "demo-tx-5",
          type: "PAYMENT",
          userId: "demo-user-5",
          companyId: "demo-company-5",
          amount: 3100,
          originalTransactionId: null,
          status: "VALIDER",
          createdAt: "2026-09-06T11:05:00Z",
          partnerId: "demo-partner-2",
          partnerName: "Boutique Énergie",
          partnerCategory: "Commerce",
          partnerPostalCode: "69002",
          partnerAddress: "28 rue de la République",
        },
      ],
      location: { type: "Point", coordinates: [4.8312, 45.7591] },
    },
    {
      id: "demo-partner-3",
      name: "Café des Arts",
      email: "contact@cafedesarts-demo.fr",
      siret: "852 369 741 00027",
      address: "4 boulevard Voltaire",
      postalCode: "33000",
      verified: false,
      isPartner: true,
      categoryId: 4,
      category: { id: 4, category: "Café" },
      categoryName: "Café",
      latitude: 45.4846,
      longitude: -0.7681,
      transactionCount: 5,
      transactionAmount: 63000,
      paymentCount: 4,
      refundCount: 1,
      validatedCount: 5,
      refusedCount: 0,
      lastTransactionAt: "2026-09-05T10:20:00Z",
      transactions: [
        {
          id: "demo-tx-6",
          type: "PAYMENT",
          userId: "demo-user-6",
          companyId: "demo-company-6",
          amount: 1200,
          originalTransactionId: null,
          status: "VALIDER",
          createdAt: "2026-09-05T10:20:00Z",
          partnerId: "demo-partner-3",
          partnerName: "Café des Arts",
          partnerCategory: "Café",
          partnerPostalCode: "33000",
          partnerAddress: "4 boulevard Voltaire",
        },
        {
          id: "demo-tx-7",
          type: "PAYMENT",
          userId: "demo-user-7",
          companyId: "demo-company-7",
          amount: 1800,
          originalTransactionId: null,
          status: "VALIDER",
          createdAt: "2026-09-03T15:10:00Z",
          partnerId: "demo-partner-3",
          partnerName: "Café des Arts",
          partnerCategory: "Café",
          partnerPostalCode: "33000",
          partnerAddress: "4 boulevard Voltaire",
        },
      ],
      location: { type: "Point", coordinates: [-0.7681, 45.4846] },
    },
  ]

  return {
    partners,
    transactions: partners.flatMap((partner) => partner.transactions),
  }
}

const dbService = {
  async getEmployees(): Promise<AdminEmployee[]> {
    const [employees, companies] = await Promise.all([
      fetchAllPages<ApiSalary>("/api/v1/salaries?includeInactive=true"),
      fetchAllPages<ApiCompany>("/api/v1/employeurs"),
    ])

    const companyNames = new Map(companies.map((company) => [company.id, company.name]))

    return employees.map((employee) => ({
      id: employee.id,
      name: `${employee.name} ${employee.surname}`.trim(),
      email: employee.email,
      businessName: employee.companyId ? (companyNames.get(employee.companyId) ?? "Entreprise inconnue") : "Non rattaché",
      companyId: employee.companyId,
      balance: employee.balance,
      accountStatus: employee.accountStatus,
      active: employee.active,
      isBanned: employee.isBanned,
      transactionCount: employee.transactionCount,
      transactionTotal: employee.transactionTotal,
      createdAt: employee.createdAt,
    }))
  },

  async getBusinesses(): Promise<Business[]> {
    const [companies, employees] = await Promise.all([
      fetchAllPages<ApiCompany>("/api/v1/employeurs?includeInactive=true"),
      fetchAllPages<ApiSalary>("/api/v1/salaries?includeInactive=true"),
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
      active: company.active ?? true,
      description: company.description,
      createdAt: company.createdAt,
      employees: employees
        .filter((employee) => employee.companyId === company.id)
        .map((employee) => ({
          id: employee.id,
          name: `${employee.name} ${employee.surname}`.trim(),
          email: employee.email,
        })),
    }))
  },

  async getNationalData(): Promise<NationalData> {
    const partners = await fetchAllPages<ApiPartner>("/api/v1/partenaires?includeInactive=true")

    const withTransactions = await Promise.all(
      partners.map(async (partner): Promise<AdminPartner> => {
        const transactions = await fetchAllTransactions(
          `/api/v1/partenaires/${encodeURIComponent(partner.id)}/transactions`,
          true,
        )
        const location = parsePoint(partner.location)
        const partnerTransactions: NationalTransaction[] = transactions.map((transaction) => ({
          ...transaction,
          partnerId: partner.id,
          partnerName: partner.name,
          partnerCategory: partner.category?.category ?? "Non catégorisé",
          partnerPostalCode: partner.postalCode,
          partnerAddress: partner.address,
        }))

        return {
          ...partner,
          categoryName: partner.category?.category ?? "Non catégorisé",
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          transactionCount: transactions.length,
          transactionAmount: transactions
            .filter((transaction) => transaction.status === "VALIDER")
            .reduce((sum, transaction) => sum + transaction.amount, 0),
          paymentCount: transactions.filter((transaction) => transaction.type === "PAYMENT").length,
          refundCount: transactions.filter((transaction) => transaction.type === "REFUND").length,
          validatedCount: transactions.filter((transaction) => transaction.status === "VALIDER").length,
          refusedCount: transactions.filter((transaction) => transaction.status === "REFUSER").length,
          lastTransactionAt: transactions[0]?.createdAt ?? null,
          transactions: partnerTransactions,
        }
      }),
    )

    return {
      partners: withTransactions,
      transactions: withTransactions
        .flatMap((partner) => partner.transactions)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }
  },

  async getTopups(): Promise<TopupTransaction[]> {
    const [employees, companies] = await Promise.all([
      fetchAllPages<ApiSalary>("/api/v1/salaries?includeInactive=true"),
      fetchAllPages<ApiCompany>("/api/v1/employeurs"),
    ])
    const companyNames = new Map(companies.map((company) => [company.id, company.name]))

    const histories = await Promise.all(
      employees.map(async (employee) => {
        const transactions = await fetchAllTransactions(
          `/api/v1/salaries/${encodeURIComponent(employee.id)}/transactions`,
          true,
        )

        return transactions
          .filter((transaction) => transaction.type === "TOPUP")
          .map((transaction): TopupTransaction => ({
            ...transaction,
            employeeId: employee.id,
            employeeName: `${employee.name} ${employee.surname}`.trim(),
            employerId: employee.companyId,
            employerName: employee.companyId
              ? (companyNames.get(employee.companyId) ?? "Entreprise inconnue")
              : "Non rattaché",
          }))
      }),
    )

    return histories
      .flat()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard")

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar activeTab={activeTab} onSelectTab={setActiveTab} />
          <SidebarInset>
            <main id="contenu-principal" tabIndex={-1} className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
              {activeTab === "dashboard" && <NationalDashboardView />}
              {activeTab === "partners" && <PartnerView />}
              {activeTab === "employee" && <EmployeeView />}
              {activeTab === "business" && <BusinessView />}
              {activeTab === "topups" && <TopupView />}
              {activeTab === "account" && <AccountView />}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}

function NationalDashboardView() {
  const [data, setData] = useState<NationalData>({ partners: [], transactions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [usingDemoData, setUsingDemoData] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextData = await dbService.getNationalData()
      const shouldUseDemo = nextData.partners.length === 0 && nextData.transactions.length === 0
      const resolvedData = shouldUseDemo ? buildDemoNationalData() : nextData
      setData(resolvedData)
      setUsingDemoData(shouldUseDemo)
    } catch {
      const demoData = buildDemoNationalData()
      setData(demoData)
      setUsingDemoData(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const validatedTransactions = data.transactions.filter((transaction) => transaction.status === "VALIDER")
    return {
      volume: validatedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
      transactions: data.transactions.length,
      activePartners: data.partners.filter((partner) => partner.verified).length,
      pendingPartners: data.partners.filter((partner) => !partner.verified).length,
    }
  }, [data])

  const geography = useMemo(() => {
    const zones = new Map<string, { partners: number; transactions: number; amount: number }>()

    for (const partner of data.partners) {
      const zone = geographicArea(partner.postalCode)
      const current = zones.get(zone) ?? { partners: 0, transactions: 0, amount: 0 }
      current.partners += 1
      current.transactions += partner.transactionCount
      current.amount += partner.transactionAmount
      zones.set(zone, current)
    }

    return [...zones.entries()]
      .map(([zone, values]) => ({ zone, ...values }))
      .sort((a, b) => b.partners - a.partners || b.amount - a.amount)
  }, [data.partners])

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR")
    if (!query) return data.transactions

    return data.transactions.filter((transaction) =>
      [
        transaction.partnerName,
        transaction.partnerCategory,
        transaction.partnerPostalCode,
        transaction.partnerAddress,
        transaction.userId,
        transaction.id,
        transaction.type,
        transaction.status,
      ]
        .join(" ")
        .toLocaleLowerCase("fr-FR")
        .includes(query),
    )
  }, [data.transactions, search])

  if (loading) return <LoadingBlock label="Chargement des données nationales…" />
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Tableau de bord national"
        description="Vue consolidée du réseau Carte Pro : transactions partenaires, activité, validation et répartition géographique."
        action={
          <Button type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> Actualiser
          </Button>
        }
      />

      {usingDemoData && (
        <p className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
          Données de démonstration : montants et transactions simulés pour la prévisualisation.
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs nationaux">
        <MetricCard icon={<CircleDollarSign />} label="Volume validé" value={formatMoney(stats.volume)} />
        <MetricCard icon={<Activity />} label="Transactions" value={stats.transactions.toLocaleString("fr-FR")} />
        <MetricCard icon={<Store />} label="Partenaires validés" value={String(stats.activePartners)} />
        <MetricCard icon={<UserCheck />} label="Demandes à valider" value={String(stats.pendingPartners)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b p-5">
            <h3 className="text-lg font-bold">Activité par partenaire</h3>
            <p className="text-sm text-muted-foreground">Tous les partenaires actifs retournés par l’API et leurs agrégats de transactions.</p>
          </div>
          {data.partners.length === 0 ? (
            <EmptyBlock label="Aucun partenaire enregistré." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Partenaire</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold">Zone</th>
                    <th className="px-4 py-3 text-right font-semibold">Transactions</th>
                    <th className="px-4 py-3 text-right font-semibold">Volume</th>
                    <th className="px-4 py-3 font-semibold">Dernière activité</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.partners.map((partner) => (
                    <tr key={partner.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{partner.name}</p>
                        <p className="text-xs text-muted-foreground">{partner.categoryName} · {partner.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <PartnerStatusBadge verified={partner.verified} />
                      </td>
                      <td className="px-4 py-3">
                        <p>{geographicArea(partner.postalCode)}</p>
                        <p className="text-xs text-muted-foreground">{partner.postalCode}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{partner.transactionCount}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(partner.transactionAmount)}</td>
                      <td className="px-4 py-3">{partner.lastTransactionAt ? formatDateTime(partner.lastTransactionAt) : "Aucune"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b p-5">
            <h3 className="text-lg font-bold">Répartition géographique</h3>
            <p className="text-sm text-muted-foreground">Répartition calculée à partir des codes postaux partenaires.</p>
          </div>
          {geography.length === 0 ? (
            <EmptyBlock label="Aucune donnée géographique." />
          ) : (
            <div className="divide-y">
              {geography.map((zone) => (
                <div key={zone.zone} className="grid grid-cols-[1fr_auto] gap-3 p-4">
                  <div>
                    <p className="font-semibold">{zone.zone}</p>
                    <p className="text-xs text-muted-foreground">{zone.transactions} transaction{zone.transactions > 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{zone.partners} partenaire{zone.partners > 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground">{formatMoney(zone.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card" aria-labelledby="national-transactions-title">
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 id="national-transactions-title" className="text-lg font-bold">Toutes les transactions partenaires</h3>
            <p className="text-sm text-muted-foreground">
              Historique national enrichi avec le partenaire, sa catégorie et sa localisation.
            </p>
          </div>
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Rechercher partenaire, ID, type…"
              aria-label="Rechercher dans les transactions nationales"
            />
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <EmptyBlock label={search ? "Aucune transaction ne correspond à la recherche." : "Aucune transaction partenaire."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Partenaire</th>
                  <th className="px-4 py-3 font-semibold">Localisation</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">Montant</th>
                  <th className="px-4 py-3 font-semibold">Salarié</th>
                  <th className="px-4 py-3 font-semibold">Transaction</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(transaction.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{transaction.partnerName}</p>
                      <p className="text-xs text-muted-foreground">{transaction.partnerCategory}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{transaction.partnerPostalCode}</p>
                      <p className="max-w-[250px] truncate text-xs text-muted-foreground">{transaction.partnerAddress}</p>
                    </td>
                    <td className="px-4 py-3"><TransactionTypeBadge type={transaction.type} /></td>
                    <td className="px-4 py-3"><TransactionStatusBadge status={transaction.status} /></td>
                    <td className="px-4 py-3 text-right font-bold">{formatMoney(transaction.amount)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{shortId(transaction.userId)}</td>
                    <td className="px-4 py-3 font-mono text-xs" title={transaction.id}>{shortId(transaction.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function PartnerView() {
  const [partners, setPartners] = useState<AdminPartner[]>([])
  const [selectedPartner, setSelectedPartner] = useState<AdminPartner | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await dbService.getNationalData()
      setPartners(data.partners)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les partenaires.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function validatePartner(partner: AdminPartner) {
    setActionId(partner.id)
    setActionError(null)
    try {
      await apiFetch(`/api/v1/partenaires/${encodeURIComponent(partner.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ verified: true }),
      })
      setPartners((current) => current.map((item) => item.id === partner.id ? { ...item, verified: true } : item))
      setSelectedPartner((current) => current?.id === partner.id ? { ...current, verified: true } : current)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Impossible de valider ce partenaire.")
    } finally {
      setActionId(null)
    }
  }

  async function setPartnerActive(partner: AdminPartner, active: boolean) {
    const confirmed = active || window.confirm(`Suspendre le compte partenaire « ${partner.name} » ? Il n'apparaîtra plus dans le réseau et ne pourra plus se connecter, mais reste réactivable à tout moment.`)
    if (!confirmed) return

    setActionId(partner.id)
    setActionError(null)
    try {
      await apiFetch(`/api/v1/partenaires/${encodeURIComponent(partner.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      })
      setPartners((current) => current.map((item) => item.id === partner.id ? { ...item, active } : item))
      setSelectedPartner((current) => current?.id === partner.id ? { ...current, active } : current)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Impossible de mettre à jour ce partenaire.")
    } finally {
      setActionId(null)
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR")
    if (!query) return partners
    return partners.filter((partner) =>
      [partner.name, partner.email, partner.siret, partner.address, partner.postalCode, partner.categoryName]
        .join(" ")
        .toLocaleLowerCase("fr-FR")
        .includes(query),
    )
  }, [partners, search])

  if (loading) return <LoadingBlock label="Chargement des partenaires…" />
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Partenaires"
        description="Validation des demandes d'inscription, consultation complète des profils et clôture des comptes partenaires."
        action={
          <Button type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> Actualiser
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Résumé partenaires">
        <MetricCard icon={<Store />} label="Partenaires" value={String(partners.length)} />
        <MetricCard icon={<BadgeCheck />} label="Validés" value={String(partners.filter((partner) => partner.verified).length)} />
        <MetricCard icon={<UserCheck />} label="En attente" value={String(partners.filter((partner) => !partner.verified).length)} />
        <MetricCard icon={<Ban />} label="Suspendus" value={String(partners.filter((partner) => !(partner.active ?? true)).length)} />
        <MetricCard icon={<CircleDollarSign />} label="Volume validé" value={formatMoney(partners.reduce((sum, partner) => sum + partner.transactionAmount, 0))} />
      </section>

      {actionError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{actionError}</div>}

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold">Demandes et comptes partenaires</h3>
            <p className="text-sm text-muted-foreground">Un compte non vérifié apparaît comme « En attente » jusqu’à validation par le ministère.</p>
          </div>
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Nom, SIRET, email, catégorie…" aria-label="Rechercher un partenaire" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyBlock label="Aucun partenaire trouvé." />
        ) : (
          <div className="divide-y">
            {filtered.map((partner) => (
              <article key={partner.id} className="grid gap-4 p-5 xl:grid-cols-[1.35fr_0.8fr_0.8fr_auto] xl:items-center">
                <button type="button" onClick={() => setSelectedPartner(partner)} className="group min-w-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex items-center gap-2">
                    <Store className="size-4 text-primary" aria-hidden="true" />
                    <p className="truncate font-bold group-hover:text-primary">{partner.name}</p>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{partner.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">SIRET {partner.siret} · {partner.categoryName}</p>
                </button>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PartnerStatusBadge verified={partner.verified} />
                    {!(partner.active ?? true) && <Badge variant="destructive">Suspendu</Badge>}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{partner.address} {partner.postalCode}</p>
                </div>

                <div>
                  <p className="font-bold">{partner.transactionCount} transaction{partner.transactionCount > 1 ? "s" : ""}</p>
                  <p className="text-sm text-muted-foreground">{formatMoney(partner.transactionAmount)} validés</p>
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {!partner.verified && (
                    <Button type="button" size="sm" disabled={actionId === partner.id} onClick={() => void validatePartner(partner)}>
                      <CheckCircle2 aria-hidden="true" /> Valider
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPartner(partner)}>
                    Détails
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={(partner.active ?? true) ? "outline" : "default"}
                    disabled={actionId === partner.id}
                    onClick={() => void setPartnerActive(partner, !(partner.active ?? true))}
                  >
                    {(partner.active ?? true) ? <XCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                    {(partner.active ?? true) ? "Suspendre" : "Réactiver"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!selectedPartner} onOpenChange={(open) => !open && setSelectedPartner(null)}>
        {selectedPartner && (
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Store className="size-5" aria-hidden="true" /> {selectedPartner.name}
              </DialogTitle>
              <DialogDescription>Informations disponibles via les routes partenaires existantes.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2 md:grid-cols-2">
              <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
                <h4 className="font-bold">Identité</h4>
                <DetailRow label="Statut" value={selectedPartner.verified ? "Validé" : "En attente de validation"} />
                <Separator />
                <DetailRow label="Compte" value={(selectedPartner.active ?? true) ? "Actif" : "Suspendu"} />
                <Separator />
                <DetailRow label="Email" value={selectedPartner.email} />
                <Separator />
                <DetailRow label="SIRET" value={selectedPartner.siret} mono />
                <Separator />
                <DetailRow label="Catégorie" value={selectedPartner.categoryName} />
                <Separator />
                <DetailRow label="Catégorie ID" value={String(selectedPartner.categoryId)} mono />
                <Separator />
                <DetailRow label="Partenaire ID" value={selectedPartner.id} mono />
                {selectedPartner.kbisId && <><Separator /><DetailRow label="KBIS ID" value={selectedPartner.kbisId} mono /></>}
                {selectedPartner.agentId && <><Separator /><DetailRow label="Agent ID" value={String(selectedPartner.agentId)} mono /></>}
                {selectedPartner.reasonId != null && <><Separator /><DetailRow label="Motif ID" value={String(selectedPartner.reasonId)} mono /></>}
              </div>

              <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
                <h4 className="font-bold">Localisation et activité</h4>
                <DetailRow label="Adresse" value={selectedPartner.address} />
                <Separator />
                <DetailRow label="Code postal" value={selectedPartner.postalCode} />
                <Separator />
                <DetailRow label="Zone" value={geographicArea(selectedPartner.postalCode)} />
                <Separator />
                <DetailRow label="Coordonnées" value={selectedPartner.latitude != null && selectedPartner.longitude != null ? `${selectedPartner.latitude.toFixed(5)}, ${selectedPartner.longitude.toFixed(5)}` : "Non disponibles"} />
                <Separator />
                <DetailRow label="Transactions" value={String(selectedPartner.transactionCount)} />
                <Separator />
                <DetailRow label="Volume validé" value={formatMoney(selectedPartner.transactionAmount)} />
                <Separator />
                <DetailRow label="Paiements / remboursements" value={`${selectedPartner.paymentCount} / ${selectedPartner.refundCount}`} />
                <Separator />
                <DetailRow label="Validées / refusées" value={`${selectedPartner.validatedCount} / ${selectedPartner.refusedCount}`} />
                <Separator />
                <DetailRow label="Dernière activité" value={selectedPartner.lastTransactionAt ? formatDateTime(selectedPartner.lastTransactionAt) : "Aucune"} />
              </div>
            </div>

            {selectedPartner.description && (
              <div className="rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="mt-2 text-sm">{selectedPartner.description}</p>
              </div>
            )}

            {(selectedPartner.createdAt || selectedPartner.updatedAt) && (
              <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                {selectedPartner.createdAt && <DetailRow label="Créé le" value={formatDateTime(selectedPartner.createdAt)} />}
                {selectedPartner.updatedAt && <DetailRow label="Mis à jour le" value={formatDateTime(selectedPartner.updatedAt)} />}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border">
              <div className="border-b p-4">
                <h4 className="font-bold">Dernières transactions</h4>
              </div>
              {selectedPartner.transactions.length === 0 ? (
                <EmptyBlock label="Aucune transaction pour ce partenaire." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Statut</th>
                        <th className="px-3 py-2 text-right">Montant</th>
                        <th className="px-3 py-2">ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedPartner.transactions.slice(0, 10).map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="px-3 py-2">{formatDateTime(transaction.createdAt)}</td>
                          <td className="px-3 py-2"><TransactionTypeBadge type={transaction.type} /></td>
                          <td className="px-3 py-2"><TransactionStatusBadge status={transaction.status} /></td>
                          <td className="px-3 py-2 text-right font-bold">{formatMoney(transaction.amount)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{shortId(transaction.id)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {!selectedPartner.verified ? (
                <Button type="button" disabled={actionId === selectedPartner.id} onClick={() => void validatePartner(selectedPartner)}>
                  <CheckCircle2 aria-hidden="true" /> Valider la demande
                </Button>
              ) : <span />}
              <Button
                type="button"
                variant={(selectedPartner.active ?? true) ? "destructive" : "default"}
                disabled={actionId === selectedPartner.id}
                onClick={() => void setPartnerActive(selectedPartner, !(selectedPartner.active ?? true))}
              >
                {(selectedPartner.active ?? true) ? <XCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                {(selectedPartner.active ?? true) ? "Suspendre le compte" : "Réactiver le compte"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function EmployeeView() {
  const [employees, setEmployees] = useState<AdminEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<AdminEmployee | null>(null)
  const [suspendReason, setSuspendReason] = useState("")
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEmployees(await dbService.getEmployees())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les salariés.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function validateEmployee(employee: AdminEmployee) {
    setActionId(employee.id)
    setActionError(null)

    try {
      await apiFetch(`/api/v1/salaries/${encodeURIComponent(employee.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          accountStatus: "ACCEPTED",
          active: true,
        }),
      })

      setEmployees((current) =>
        current.map((item) =>
          item.id === employee.id
            ? { ...item, accountStatus: "ACCEPTED", active: true }
            : item,
        ),
      )
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Impossible de valider le compte salarié.",
      )
    } finally {
      setActionId(null)
    }
  }

  async function setActive(employee: AdminEmployee, active: boolean) {
    setActionId(employee.id)
    setActionError(null)
    try {
      await apiFetch(`/api/v1/salaries/${encodeURIComponent(employee.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      })
      setEmployees((current) => current.map((item) => item.id === employee.id ? { ...item, active } : item))
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Impossible de modifier le statut du salarié.")
    } finally {
      setActionId(null)
    }
  }

  async function suspendEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!suspendTarget) return

    setActionId(suspendTarget.id)
    setActionError(null)
    try {
      await apiFetch("/api/v1/admin/ban", {
        method: "POST",
        body: JSON.stringify({ userId: suspendTarget.id, reason: suspendReason.trim() }),
      })
      setEmployees((current) => current.map((item) => item.id === suspendTarget.id ? { ...item, isBanned: true } : item))
      setSuspendTarget(null)
      setSuspendReason("")
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Impossible de suspendre le salarié.")
    } finally {
      setActionId(null)
    }
  }

  async function closeEmployee(employee: AdminEmployee) {
    const confirmed = window.confirm(`Clôturer le compte salarié de ${employee.name} ?`)
    if (!confirmed) return

    setActionId(employee.id)
    setActionError(null)

    try {
      await apiFetch(`/api/v1/salaries/${encodeURIComponent(employee.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          accountStatus: "REFUSED",
          active: false,
        }),
      })

      setEmployees((current) =>
        current.map((item) =>
          item.id === employee.id
            ? { ...item, accountStatus: "REFUSED", active: false }
            : item,
        ),
      )
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Impossible de clôturer le compte salarié.",
      )
    } finally {
      setActionId(null)
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR")
    if (!query) return employees
    return employees.filter((employee) =>
      [employee.name, employee.email, employee.businessName, employee.id]
        .join(" ")
        .toLocaleLowerCase("fr-FR")
        .includes(query),
    )
  }, [employees, search])

  if (loading) return <LoadingBlock label="Chargement des salariés…" />
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />

  const pendingCount = employees.filter(
    (employee) => employee.accountStatus === "PENDING",
  ).length

  const closedCount = employees.filter(
    (employee) => employee.accountStatus === "REFUSED",
  ).length

  const suspendedCount = employees.filter(
    (employee) =>
      employee.accountStatus === "ACCEPTED" &&
      employee.isBanned,
  ).length

  const inactiveCount = employees.filter(
    (employee) =>
      employee.accountStatus === "ACCEPTED" &&
      !employee.isBanned &&
      !employee.active,
  ).length

  const activeCount = employees.filter(
    (employee) =>
      employee.accountStatus === "ACCEPTED" &&
      !employee.isBanned &&
      employee.active,
  ).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Gestion des comptes salariés"
        description="Validation des demandes puis gestion de l’état des comptes salariés : actif, désactivé, suspendu ou clôturé."
        action={<Button type="button" variant="outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Actualiser</Button>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={<Users />} label="Salariés" value={String(employees.length)} />
        <MetricCard icon={<UserCheck />} label="À valider" value={String(pendingCount)} />
        <MetricCard icon={<CheckCircle2 />} label="Actifs" value={String(activeCount)} />
        <MetricCard icon={<XCircle />} label="Désactivés" value={String(inactiveCount)} />
        <MetricCard icon={<Ban />} label="Suspendus" value={String(suspendedCount)} />
        <MetricCard icon={<Trash2 />} label="Clôturés" value={String(closedCount)} />
      </section>

      {actionError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{actionError}</div>}

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold">Tous les comptes salariés</h3>
            <p className="text-sm text-muted-foreground">Les comptes désactivés restent visibles grâce à includeInactive=true.</p>
          </div>
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Nom, email, entreprise, ID…" aria-label="Rechercher un salarié" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyBlock label="Aucun salarié trouvé." />
        ) : (
          <div className="divide-y">
            {filtered.map((employee) => (
              <article key={employee.id} className="grid gap-4 p-5 xl:grid-cols-[1.3fr_0.8fr_0.8fr_auto] xl:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(employee.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{employee.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{employee.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{employee.businessName} · créé le {formatDate(employee.createdAt)}</p>
                  </div>
                </div>

                <div>
                  <EmployeeStatusBadge employee={employee} />
                  <p className="mt-2 font-mono text-xs text-muted-foreground" title={employee.id}>{shortId(employee.id)}</p>
                </div>

                <div>
                  <p className="font-bold">{formatMoney(employee.balance)}</p>
                  <p className="text-sm text-muted-foreground">{employee.transactionCount} transaction{employee.transactionCount > 1 ? "s" : ""} · {formatMoney(employee.transactionTotal)}</p>
                </div>

                <div className="flex flex-wrap gap-2 xl:max-w-[420px] xl:justify-end">
                  {employee.accountStatus === "PENDING" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={actionId === employee.id}
                      onClick={() => void validateEmployee(employee)}
                    >
                      <UserCheck aria-hidden="true" />
                      Valider
                    </Button>
                  )}

                  {employee.accountStatus === "ACCEPTED" && !employee.isBanned && (
                    <Button
                      type="button"
                      size="sm"
                      variant={employee.active ? "outline" : "default"}
                      disabled={actionId === employee.id}
                      onClick={() => void setActive(employee, !employee.active)}
                    >
                      {employee.active
                        ? <XCircle aria-hidden="true" />
                        : <CheckCircle2 aria-hidden="true" />}
                      {employee.active ? "Désactiver" : "Activer"}
                    </Button>
                  )}

                  {employee.accountStatus === "ACCEPTED" && !employee.isBanned && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={actionId === employee.id}
                      onClick={() => {
                        setSuspendTarget(employee)
                        setSuspendReason("")
                      }}
                    >
                      <Ban aria-hidden="true" />
                      Suspendre
                    </Button>
                  )}

                  {employee.accountStatus !== "REFUSED" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={actionId === employee.id}
                      onClick={() => void closeEmployee(employee)}
                    >
                      <Trash2 aria-hidden="true" />
                      Clôturer
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!suspendTarget} onOpenChange={(open) => { if (!open) { setSuspendTarget(null); setSuspendReason("") } }}>
        {suspendTarget && (
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={suspendEmployee}>
              <DialogHeader>
                <DialogTitle>Suspendre {suspendTarget.name}</DialogTitle>
                <DialogDescription>
                  La suspension utilise le bannissement administrateur existant et révoque immédiatement l’accès au compte.
                </DialogDescription>
              </DialogHeader>
              <div className="py-5">
                <Label htmlFor="suspend-reason">Motif de suspension</Label>
                <Input
                  id="suspend-reason"
                  value={suspendReason}
                  onChange={(event) => setSuspendReason(event.target.value)}
                  className="mt-2"
                  maxLength={500}
                  required
                  placeholder="Ex. contrôle administratif en cours"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setSuspendTarget(null); setSuspendReason("") }}>Annuler</Button>
                <Button type="submit" variant="destructive" disabled={actionId === suspendTarget.id || !suspendReason.trim()}>
                  <Ban aria-hidden="true" /> Confirmer la suspension
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function BusinessView() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBusinesses(await dbService.getBusinesses())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les entreprises.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function validateBusiness(business: Business) {
    setActionId(business.id)
    setActionError(null)

    try {
      await apiFetch(`/api/v1/employeurs/${encodeURIComponent(business.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ verified: true }),
      })

      setBusinesses((current) =>
        current.map((item) =>
          item.id === business.id ? { ...item, verified: true } : item,
        ),
      )

      setSelectedBusiness((current) =>
        current?.id === business.id ? { ...current, verified: true } : current,
      )
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Impossible de valider cette entreprise.",
      )
    } finally {
      setActionId(null)
    }
  }

  async function setBusinessActive(business: Business, active: boolean) {
    const confirmed = active || window.confirm(`Suspendre le compte employeur « ${business.name} » ? Il n'apparaîtra plus dans les listings et ne pourra plus se connecter, mais reste réactivable à tout moment.`)
    if (!confirmed) return

    setActionId(business.id)
    setActionError(null)
    try {
      await apiFetch(`/api/v1/employeurs/${encodeURIComponent(business.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      })
      setBusinesses((current) => current.map((item) => item.id === business.id ? { ...item, active } : item))
      setSelectedBusiness((current) => current?.id === business.id ? { ...current, active } : current)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Impossible de mettre à jour cette entreprise.")
    } finally {
      setActionId(null)
    }
  }

  if (loading) return <LoadingBlock label="Chargement des entreprises…" />
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Comptes employeurs"
        description="Validation des demandes d'inscription, salariés rattachés, KBIS et gestion de clôture."
        action={<Button type="button" variant="outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Actualiser</Button>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<Building2 />} label="Entreprises" value={String(businesses.length)} />
        <MetricCard icon={<Users />} label="Salariés rattachés" value={String(businesses.reduce((sum, business) => sum + business.employees.length, 0))} />
        <MetricCard icon={<BadgeCheck />} label="Vérifiées" value={String(businesses.filter((business) => business.verified).length)} />
        <MetricCard icon={<UserCheck />} label="À vérifier" value={String(businesses.filter((business) => !business.verified).length)} />
        <MetricCard icon={<Ban />} label="Suspendues" value={String(businesses.filter((business) => !business.active).length)} />
      </section>

      {actionError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{actionError}</div>}

      {businesses.length === 0 ? (
        <EmptyBlock label="Aucune entreprise enregistrée." />
      ) : (
        <section className="flex flex-col gap-3">
          {businesses.map((business) => (
            <article key={business.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <button type="button" onClick={() => setSelectedBusiness(business)} className="group min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <p className="flex items-center gap-2 font-semibold group-hover:text-primary">
                    <Building2 className="size-4" aria-hidden="true" /> {business.name} <ChevronRight className="size-4" aria-hidden="true" />
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{business.email}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" aria-hidden="true" /> {business.address} {business.postalCode}</p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">SIRET : {business.siret}</p>
                </button>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Badge variant={business.verified ? "default" : "outline"}>{business.verified ? "Vérifiée" : "À vérifier"}</Badge>
                  {!business.active && <Badge variant="destructive">Suspendue</Badge>}
                  <Badge variant="secondary"><Users className="mr-1 size-3" aria-hidden="true" /> {business.employees.length} salarié{business.employees.length > 1 ? "s" : ""}</Badge>
                  {!business.verified && (
                    <Button type="button" size="sm" disabled={actionId === business.id} onClick={() => void validateBusiness(business)}>
                      <UserCheck aria-hidden="true" /> Valider
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedBusiness(business)}>Détails</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={business.active ? "outline" : "default"}
                    disabled={actionId === business.id}
                    onClick={() => void setBusinessActive(business, !business.active)}
                  >
                    {business.active ? <XCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                    {business.active ? "Suspendre" : "Réactiver"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      <Dialog open={!!selectedBusiness} onOpenChange={(open) => !open && setSelectedBusiness(null)}>
        {selectedBusiness && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl"><Building2 className="size-5" aria-hidden="true" /> {selectedBusiness.name}</DialogTitle>
              <DialogDescription>Informations enregistrées dans la base Carte Pro.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <DetailRow label="Email" value={selectedBusiness.email} />
                <Separator />
                <DetailRow label="SIRET" value={selectedBusiness.siret} mono />
                <Separator />
                <DetailRow label="Adresse" value={`${selectedBusiness.address} ${selectedBusiness.postalCode}`.trim()} />
                <Separator />
                <DetailRow label="Statut" value={selectedBusiness.verified ? "Vérifiée" : "À vérifier"} />
                <Separator />
                <DetailRow label="Compte" value={selectedBusiness.active ? "Actif" : "Suspendu"} />
                <Separator />
                <DetailRow label="Salariés" value={String(selectedBusiness.employees.length)} />
                {selectedBusiness.createdAt && <><Separator /><DetailRow label="Créée le" value={formatDateTime(selectedBusiness.createdAt)} /></>}
              </div>

              {selectedBusiness.description && <div className="rounded-lg border p-3 text-sm">{selectedBusiness.description}</div>}

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Document administratif</p>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-red-500" aria-hidden="true" />
                    <div><p className="text-sm font-medium">Extrait KBIS</p><p className="text-xs text-muted-foreground">Document stocké dans Garage</p></div>
                  </div>
                  <Button size="sm" asChild><a href={selectedBusiness.kbisUrl}><Download aria-hidden="true" /> Télécharger</a></Button>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {!selectedBusiness.verified ? (
                <Button type="button" disabled={actionId === selectedBusiness.id} onClick={() => void validateBusiness(selectedBusiness)}>
                  <UserCheck aria-hidden="true" /> Valider la demande
                </Button>
              ) : <span />}
              <Button
                type="button"
                variant={selectedBusiness.active ? "destructive" : "default"}
                disabled={actionId === selectedBusiness.id}
                onClick={() => void setBusinessActive(selectedBusiness, !selectedBusiness.active)}
              >
                {selectedBusiness.active ? <XCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                {selectedBusiness.active ? "Suspendre le compte" : "Réactiver le compte"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function TopupView() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [topups, setTopups] = useState<TopupTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [businessData, topupData] = await Promise.all([dbService.getBusinesses(), dbService.getTopups()])
      setBusinesses(businessData)
      setTopups(topupData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les abondements.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formElement = event.currentTarget
    const form = new FormData(formElement)

    setSubmitting(true)
    setSubmitError(null)
    setSuccess(null)

    const employerId = String(form.get("employerId") ?? "")
    const amount = Math.round(Number(form.get("amount") ?? 0) * 100)

    if (!employerId) {
      setSubmitError("Sélectionnez une entreprise.")
      setSubmitting(false)
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setSubmitError("Le montant doit être supérieur à 0 €.")
      setSubmitting(false)
      return
    }

    try {
      const payload = await apiFetch<TopupResponse>(
        `/api/v1/employeurs/${encodeURIComponent(employerId)}/abondements`,
        {
          method: "POST",
          body: JSON.stringify({
            montant: amount,
            type: "fixe",
            date: String(form.get("date") ?? "") || undefined,
            comment: String(form.get("comment") ?? "").trim() || undefined,
          }),
        }
      )

      setSuccess(
        `${payload.salariesCredites} salarié${
          payload.salariesCredites > 1 ? "s" : ""
        } crédité${
          payload.salariesCredites > 1 ? "s" : ""
        } de ${formatMoney(payload.montant)} — total ${formatMoney(
          payload.montantTotal
        )}.`
      )

      formElement.reset()

      await load()
    } catch (caught) {
      setSubmitError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’effectuer l’abondement."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const totalTopup = topups.filter((topup) => topup.status === "VALIDER").reduce((sum, topup) => sum + topup.amount, 0)
  const employersFunded = new Set(topups.map((topup) => topup.employerId).filter(Boolean)).size

  if (loading) return <LoadingBlock label="Chargement des abondements…" />
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Abondements employeurs"
        description="Le crédit des salariés est centralisé dans l’espace administrateur. L’espace employeur ne propose plus cette action."
        action={<Button type="button" variant="outline" onClick={() => void load()}><RefreshCw aria-hidden="true" /> Actualiser</Button>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<CircleDollarSign />} label="Montant crédité" value={formatMoney(totalTopup)} />
        <MetricCard icon={<Activity />} label="Lignes d’abondement" value={String(topups.length)} />
        <MetricCard icon={<Building2 />} label="Employeurs concernés" value={String(employersFunded)} />
        <MetricCard icon={<Users />} label="Entreprises disponibles" value={String(businesses.length)} />
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="admin-topup-title">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-primary">Ministère</p>
          <h3 id="admin-topup-title" className="mt-1 text-xl font-bold">Créditer les salariés d’une entreprise</h3>
          <p className="mt-1 text-sm text-muted-foreground">Utilise la route d’abondement existante, déjà autorisée pour le rôle ADMIN.</p>
        </div>

        <form className="mt-5 grid gap-4 lg:grid-cols-4" onSubmit={createTopup}>
          <div className="lg:col-span-2">
            <Label htmlFor="admin-topup-employer">Entreprise</Label>
            <select id="admin-topup-employer" name="employerId" required defaultValue="" className="mt-2 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="" disabled>Sélectionner une entreprise</option>
              {businesses.map((business) => <option key={business.id} value={business.id}>{business.name} — {business.siret}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="admin-topup-amount">Montant / salarié (€)</Label>
            <Input id="admin-topup-amount" name="amount" type="number" min="0.01" step="0.01" className="mt-2" required />
          </div>
          <div>
            <Label htmlFor="admin-topup-date">Date</Label>
            <Input id="admin-topup-date" name="date" type="date" className="mt-2" />
          </div>
          <div className="lg:col-span-4">
            <Label htmlFor="admin-topup-comment">Commentaire</Label>
            <Input id="admin-topup-comment" name="comment" maxLength={500} className="mt-2" placeholder="Facultatif" />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={submitting || businesses.length === 0}>
              <CircleDollarSign aria-hidden="true" /> {submitting ? "Crédit en cours…" : "Créditer"}
            </Button>
          </div>
        </form>

        {submitError && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{submitError}</p>}
        {success && <p role="status" className="mt-4 rounded-xl bg-brand-success-soft px-4 py-3 text-sm font-semibold text-brand-success">{success}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b p-5">
          <h3 className="text-lg font-bold">Historique des abondements</h3>
          <p className="text-sm text-muted-foreground">
            L’historique est reconstitué à partir des transactions TOPUP des salariés. L’API actuelle ne fournit aucune route d’annulation ou de contre-passation d’un TOPUP.
          </p>
        </div>

        {topups.length === 0 ? (
          <EmptyBlock label="Aucun abondement enregistré." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Employeur</th>
                  <th className="px-4 py-3">Salarié</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Montant crédité</th>
                  <th className="px-4 py-3 text-right">Nouveau solde</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topups.map((topup) => (
                  <tr key={topup.id}>
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(topup.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{topup.employerName}</td>
                    <td className="px-4 py-3"><p className="font-medium">{topup.employeeName}</p><p className="font-mono text-xs text-muted-foreground">{shortId(topup.employeeId)}</p></td>
                    <td className="px-4 py-3"><TransactionStatusBadge status={topup.status} /></td>
                    <td className="px-4 py-3 text-right font-bold">{formatMoney(topup.amount)}</td>
                    <td className="px-4 py-3 text-right">{topup.newBalance == null ? "—" : formatMoney(topup.newBalance)}</td>
                    <td className="px-4 py-3">
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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

  if (error) return <ErrorBlock message={error} />
  if (!adminAccount) return <LoadingBlock label="Chargement du compte administrateur…" />

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Compte administrateur" description="Informations du compte ministère actuellement connecté." />

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14"><AvatarFallback className="text-lg">{initials(adminAccount.name)}</AvatarFallback></Avatar>
          <div>
            <p className="text-lg font-semibold leading-tight">{adminAccount.name}</p>
            <Badge variant="secondary" className="mt-1"><Shield className="mr-1 size-3" aria-hidden="true" /> {adminAccount.role}</Badge>
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

function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-primary"><span className="[&>svg]:size-5" aria-hidden="true">{icon}</span><p className="text-sm font-bold">{label}</p></div>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  )
}

function PartnerStatusBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge><CheckCircle2 className="mr-1 size-3" aria-hidden="true" /> Validé</Badge>
  ) : (
    <Badge variant="outline"><RefreshCw className="mr-1 size-3" aria-hidden="true" /> En attente</Badge>
  )
}

function EmployeeStatusBadge({ employee }: { employee: AdminEmployee }) {
  if (employee.accountStatus === "PENDING") {
    return (
      <Badge variant="outline">
        <UserCheck className="mr-1 size-3" aria-hidden="true" />
        En attente de validation
      </Badge>
    )
  }

  if (employee.accountStatus === "REFUSED") {
    return (
      <Badge variant="destructive">
        <Trash2 className="mr-1 size-3" aria-hidden="true" />
        Clôturé
      </Badge>
    )
  }

  if (employee.isBanned) {
    return (
      <Badge variant="destructive">
        <Ban className="mr-1 size-3" aria-hidden="true" />
        Suspendu
      </Badge>
    )
  }

  if (!employee.active) {
    return (
      <Badge variant="outline">
        <XCircle className="mr-1 size-3" aria-hidden="true" />
        Désactivé
      </Badge>
    )
  }

  return (
    <Badge>
      <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
      Actif
    </Badge>
  )
}

function TransactionTypeBadge({ type }: { type: ApiTransaction["type"] }) {
  if (type === "PAYMENT") return <Badge variant="secondary">Paiement</Badge>
  if (type === "REFUND") return <Badge variant="outline">Remboursement</Badge>
  return <Badge variant="outline">Abondement</Badge>
}

function TransactionStatusBadge({ status }: { status: ApiTransaction["status"] }) {
  return status === "VALIDER"
    ? <Badge><CheckCircle2 className="mr-1 size-3" aria-hidden="true" /> Validée</Badge>
    : <Badge variant="destructive"><XCircle className="mr-1 size-3" aria-hidden="true" /> Refusée</Badge>
}

function LoadingBlock({ label }: { label: string }) {
  return <div className="rounded-xl border bg-card p-8 text-sm text-muted-foreground">{label}</div>
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && <Button type="button" size="sm" variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" /> Réessayer</Button>}
      </div>
    </div>
  )
}

function EmptyBlock({ label }: { label: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{label}</div>
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-all text-sm">{value}</dd></div>
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label} :</span>
      <span className={mono ? "break-all text-right font-mono font-medium" : "text-right font-medium"}>{value || "—"}</span>
    </div>
  )
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function shortId(id: string) {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`
}

function geographicArea(postalCode: string) {
  const code = postalCode.trim()
  const overseas: Record<string, string> = {
    "971": "971 — Guadeloupe",
    "972": "972 — Martinique",
    "973": "973 — Guyane",
    "974": "974 — La Réunion",
    "975": "975 — Saint-Pierre-et-Miquelon",
    "976": "976 — Mayotte",
    "977": "977 — Saint-Barthélemy",
    "978": "978 — Saint-Martin",
  }
  const prefix3 = code.slice(0, 3)
  if (overseas[prefix3]) return overseas[prefix3]
  if (code.startsWith("20")) return "20 — Corse"
  if (/^\d{5}$/.test(code)) return `Département ${code.slice(0, 2)}`
  return "Zone non renseignée"
}
