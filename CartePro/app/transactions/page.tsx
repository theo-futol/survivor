"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Filter, LoaderCircle, RotateCcw } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { AccountHeader } from "@/components/account-header"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/hooks/use-current-user"
import { apiFetch, formatMoney, type ApiPartner, type ApiTransaction, type PaginationMeta } from "@/lib/api-client"

type FilterKind = "all" | "credited" | "consumed"
type TransactionResponse = { transactions: ApiTransaction[] }
type PartnerResponse = { data: ApiPartner[]; meta: PaginationMeta }

type UiTransaction = {
  id: string
  date: string
  label: string
  amount: number
  type: "credited" | "consumed"
  status: string
  operation: ApiTransaction["type"]
}

function TransactionsPageContent() {
  const searchParams = useSearchParams()
  const requestedFilter = searchParams.get("filter")
  const [filter, setFilter] = useState<FilterKind>(requestedFilter === "credited" || requestedFilter === "consumed" ? requestedFilter : "all")
  const { data: session, loading: sessionLoading, error: sessionError } = useCurrentUser()
  const [rawTransactions, setRawTransactions] = useState<ApiTransaction[]>([])
  const [partners, setPartners] = useState<ApiPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const employee = session?.user

  useEffect(() => {
    if (!employee || employee.role !== "EMPLOYEE") return
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.allSettled([
      apiFetch<TransactionResponse>(`/api/v1/salaries/${employee.id}/transactions`),
      apiFetch<PartnerResponse>("/api/v1/partenaires?limit=100"),
    ])
      .then(([transactionResult, partnerResult]) => {
        if (cancelled) return

        if (transactionResult.status === "fulfilled") {
          setRawTransactions(transactionResult.value.transactions ?? [])
        } else {
          setError(transactionResult.reason instanceof Error ? transactionResult.reason.message : "Impossible de charger l'historique.")
        }

        if (partnerResult.status === "fulfilled") {
          setPartners(partnerResult.value.data ?? [])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [employee?.id, employee?.role])

  const partnerNames = useMemo(() => new Map(partners.map((partner) => [partner.id, partner.name])), [partners])

  const transactions = useMemo<UiTransaction[]>(() => {
    const employerName = session?.company?.name ?? "Crédit employeur"
    return rawTransactions.map((transaction) => {
      if (transaction.type === "PAYMENT") {
        return {
          id: transaction.id,
          date: transaction.createdAt,
          label: transaction.companyId ? (partnerNames.get(transaction.companyId) ?? "Paiement partenaire") : "Paiement partenaire",
          amount: -transaction.amount,
          type: "consumed" as const,
          status: transaction.status === "VALIDER" ? "Validé" : "Refusé",
          operation: transaction.type,
        }
      }

      return {
        id: transaction.id,
        date: transaction.createdAt,
        label:
          transaction.type === "REFUND"
            ? transaction.companyId
              ? `Remboursement · ${partnerNames.get(transaction.companyId) ?? "Partenaire"}`
              : "Remboursement"
            : employerName,
        amount: transaction.amount,
        type: "credited" as const,
        status: transaction.status === "VALIDER" ? "Validé" : "Refusé",
        operation: transaction.type,
      }
    })
  }, [partnerNames, rawTransactions, session?.company?.name])

  const visible = filter === "all" ? transactions : transactions.filter((item) => item.type === filter)

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />
      <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Historique</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Vos mouvements, en toute simplicité</h1>
            <p className="mt-2 text-muted-foreground">Crédits, remboursements et achats chargés depuis l&apos;historique PostgreSQL.</p>
          </div>
          <div className="rounded-2xl bg-secondary px-5 py-4 sm:text-right">
            <p className="text-sm font-semibold text-primary">Disponible aujourd&apos;hui</p>
            <p className="text-xl font-black sm:text-2xl">{employee ? `${formatMoney(employee.balance)} à dépenser !` : "—"}</p>
          </div>
        </div>

        {(sessionError || error) && (
          <p role="alert" className="mt-6 rounded-2xl bg-brand-red-soft p-4 text-sm font-semibold text-brand-red-dark">{sessionError ?? error}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2" aria-label="Filtrer les transactions">
          <span className="mr-2 inline-flex items-center gap-2 text-sm font-bold"><Filter className="size-4" aria-hidden="true" /> Filtrer</span>
          <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")} aria-pressed={filter === "all"}>Tout</Button>
          <Button variant={filter === "credited" ? "default" : "outline"} onClick={() => setFilter("credited")} aria-pressed={filter === "credited"}>Crédits / remboursements</Button>
          <Button variant={filter === "consumed" ? "default" : "outline"} onClick={() => setFilter("consumed")} aria-pressed={filter === "consumed"}>Achats</Button>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border bg-card shadow-sm">
          {sessionLoading || loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement des transactions…
            </div>
          ) : visible.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Aucune transaction pour ce filtre.</div>
          ) : (
            <div className="divide-y">
              {visible.map((transaction) => {
                const credited = transaction.type === "credited"
                return (
                  <article key={transaction.id} className="flex flex-wrap items-center gap-4 p-5 sm:flex-nowrap">
                    <div className={`grid size-11 shrink-0 place-items-center rounded-full ${credited ? "bg-brand-success-soft text-brand-success" : "bg-secondary text-primary"}`}>
                      {transaction.operation === "REFUND" ? <RotateCcw aria-hidden="true" /> : credited ? <ArrowDownLeft aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black">{transaction.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(transaction.date))}
                        {" · "}{transaction.status}
                      </p>
                    </div>
                    <p className={`ml-auto text-lg font-black ${credited ? "text-brand-success" : "text-foreground"}`}>
                      {transaction.amount > 0 ? "+" : ""}{formatMoney(transaction.amount)}
                    </p>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh bg-background">
          <AccountHeader />
          <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement des transactions…
            </div>
          </main>
        </div>
      }
    >
      <TransactionsPageContent />
    </Suspense>
  )
}
