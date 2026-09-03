"use client"

import { useMemo, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Filter } from "lucide-react"

import { AccountHeader } from "@/components/account-header"
import payments from "@/data/paiements.json"
import { Button } from "@/components/ui/button"

type FilterKind = "all" | "credited" | "consumed"
type Transaction = { id: string; date: string; label: string; amount: number; type: "credited" | "consumed"; status: string }

export default function TransactionsPage() {
  const [filter, setFilter] = useState<FilterKind>("all")
  const employee = payments.salaries[0]
  const company = payments.entreprises.find((item) => item.id === employee.entrepriseId)

  const transactions = useMemo<Transaction[]>(() => {
    const credited = employee.creditsRecus.map((credit) => ({
      id: credit.abondementId,
      date: credit.date,
      label: company?.raisonSociale ?? "Crédit employeur",
      amount: credit.montant,
      type: "credited" as const,
      status: "Crédité",
    }))
    const consumed = employee.transactionsUtilisation.map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      label: transaction.partenaireNom,
      amount: -transaction.montant,
      type: "consumed" as const,
      status: transaction.statut,
    }))
    return [...credited, ...consumed].sort((a, b) => +new Date(b.date) - +new Date(a.date))
  }, [company?.raisonSociale, employee])

  const visible = filter === "all" ? transactions : transactions.filter((item) => item.type === filter)

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />
      <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Historique</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Vos mouvements, en toute simplicité</h1>
            <p className="mt-2 text-muted-foreground">Retrouvez les crédits reçus et les achats simulés réalisés auprès des partenaires.</p>
          </div>
          <div className="rounded-2xl bg-secondary px-5 py-4 sm:text-right">
            <p className="text-sm font-semibold text-primary">Toujours disponible</p>
            <p className="text-xl font-black sm:text-2xl">{employee.soldeActuel.toFixed(2)} € simulé à dépenser !</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2" aria-label="Filtrer les transactions">
          <span className="mr-2 inline-flex items-center gap-2 text-sm font-bold"><Filter className="size-4" aria-hidden="true" /> Filtrer</span>
          <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")} aria-pressed={filter === "all"}>Tout</Button>
          <Button variant={filter === "credited" ? "default" : "outline"} onClick={() => setFilter("credited")} aria-pressed={filter === "credited"}>Crédits reçus</Button>
          <Button variant={filter === "consumed" ? "default" : "outline"} onClick={() => setFilter("consumed")} aria-pressed={filter === "consumed"}>Achats</Button>
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="divide-y">
            {visible.map((transaction) => {
              const credited = transaction.type === "credited"
              return (
                <article key={transaction.id} className="flex flex-wrap items-center gap-4 p-5 sm:flex-nowrap">
                  <div className={`grid size-11 shrink-0 place-items-center rounded-full ${credited ? "bg-brand-success-soft text-brand-success" : "bg-secondary text-primary"}`}>
                    {credited ? <ArrowDownLeft aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{transaction.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: transaction.type === "consumed" ? "short" : undefined }).format(new Date(transaction.date))}
                      {" · "}{transaction.status}
                    </p>
                  </div>
                  <p className={`ml-auto text-lg font-black ${credited ? "text-brand-success" : "text-foreground"}`}>
                    {transaction.amount > 0 ? "+" : ""}
                    {transaction.amount.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR"
                    })} simulé
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
