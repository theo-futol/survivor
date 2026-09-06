"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BadgeCheck,
  CircleDollarSign,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react"

import { AccountHeader } from "@/components/account-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCurrentUser } from "@/hooks/use-current-user"
import { apiFetch, formatMoney, type ApiSalary, type PaginationMeta } from "@/lib/api-client"

type SalariesResponse = {
  data: ApiSalary[]
  meta: PaginationMeta
}

type TopupResponse = {
  montant: number
  salariesCredites: number
  montantTotal: number
}

type EditingEmployee = ApiSalary | null

export default function EmployerPage() {
  const { data: me, loading: sessionLoading, error: sessionError } = useCurrentUser()
  const company = me?.company ?? null
  const isCompany = me?.user.role === "COMPANY"

  const [salaries, setSalaries] = useState<ApiSalary[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [editing, setEditing] = useState<EditingEmployee>(null)
  const [showTopupForm, setShowTopupForm] = useState(false)

  const loadSalaries = useCallback(async () => {
    if (!company?.id || !isCompany) return

    setLoading(true)
    setLoadError(null)

    try {
      const payload = await apiFetch<SalariesResponse>(
        `/api/v1/salaries?employeurId=${encodeURIComponent(company.id)}&page=1&limit=100`,
      )
      setSalaries(payload.data ?? [])
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Impossible de charger les salariés.")
    } finally {
      setLoading(false)
    }
  }, [company?.id, isCompany])

  useEffect(() => {
    void loadSalaries()
  }, [loadSalaries])

  const stats = useMemo(() => {
    return {
      employees: salaries.length,
      totalBalance: salaries.reduce((sum, salary) => sum + salary.balance, 0),
      transactionCount: salaries.reduce((sum, salary) => sum + salary.transactionCount, 0),
      transactionTotal: salaries.reduce((sum, salary) => sum + salary.transactionTotal, 0),
    }
  }, [salaries])

  if (sessionLoading) {
    return (
      <div className="min-h-svh bg-background">
        <AccountHeader />
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">Chargement de votre espace employeur…</main>
      </div>
    )
  }

  if (sessionError) {
    return (
      <div className="min-h-svh bg-background">
        <AccountHeader />
        <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <p role="alert" className="rounded-3xl bg-brand-red-soft p-6 font-semibold text-brand-red-dark">{sessionError}</p>
        </main>
      </div>
    )
  }

  if (!isCompany || !company) {
    return (
      <div className="min-h-svh bg-background">
        <AccountHeader />
        <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-3xl border bg-card p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto size-12 text-primary" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-black">Espace réservé aux entreprises</h1>
            <p className="mt-3 text-muted-foreground">Ce tableau de bord est disponible uniquement pour un compte entreprise connecté.</p>
            <Link href="/profile" className={buttonVariants({ className: "mt-6" })}>Retour à mon profil</Link>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />
      <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <section className="overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-sm sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary-foreground/80">Espace employeur</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{company.name}</h1>
              <p className="mt-3 max-w-2xl text-primary-foreground/85">
                Consultez les salariés rattachés à votre entreprise, leurs soldes et leurs transactions depuis la base de données Ticket Tout.
              </p>
              <p className="mt-3 text-sm font-semibold text-primary-foreground/80">
                SIRET {company.siret} · {company.address}, {company.postalCode}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(null)
                  setShowEmployeeForm(true)
                  setShowTopupForm(false)
                  window.requestAnimationFrame(() => document.getElementById("employee-form-title")?.focus())
                }}
              >
                <UserPlus aria-hidden="true" /> Demander un compte salarié
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowTopupForm(true)
                  setShowEmployeeForm(false)
                  setEditing(null)
                  window.requestAnimationFrame(() => document.getElementById("topup-form-title")?.focus())
                }}
              >
                <CircleDollarSign aria-hidden="true" /> Abonder les salariés
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Résumé des salariés">
          <StatCard icon={<Users />} label="Salariés actifs" value={String(stats.employees)} />
          <StatCard icon={<WalletCards />} label="Soldes cumulés" value={formatMoney(stats.totalBalance)} />
          <StatCard icon={<RefreshCw />} label="Transactions" value={String(stats.transactionCount)} />
          <StatCard icon={<BadgeCheck />} label="Montants enregistrés" value={formatMoney(stats.transactionTotal)} />
        </section>

        {(showEmployeeForm || editing) && (
          <section className="mt-6 rounded-3xl border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="employee-form-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">{editing ? "Modification" : "Nouvelle demande"}</p>
                <h2 id="employee-form-title" tabIndex={-1} className="mt-1 text-2xl font-black">
                  {editing ? `${editing.name} ${editing.surname}` : "Créer une demande de compte salarié"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  {editing
                    ? "Modifiez uniquement les informations prises en charge par l’API salarié actuelle."
                    : "La demande est envoyée à la route API salarié existante. L’upload du justificatif sera branché dans un patch séparé."}
                </p>
              </div>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowEmployeeForm(false)
                  setEditing(null)
                }}
              >
                Fermer
              </Button>
            </div>

            <EmployeeForm
              key={editing?.id ?? "new"}
              employee={editing}
              companyId={company.id}
              onSaved={() => {
                setEditing(null)
                setShowEmployeeForm(false)
                void loadSalaries()
              }}
            />
          </section>
        )}

        {showTopupForm && (
          <section className="mt-6 rounded-3xl border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="topup-form-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">Abondement</p>
                <h2 id="topup-form-title" tabIndex={-1} className="mt-1 text-2xl font-black">Créditer les salariés actifs</h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Le montant saisi est envoyé à la route d’abondement existante pour votre entreprise.
                </p>
              </div>
              <Button variant="outline" type="button" onClick={() => setShowTopupForm(false)}>Fermer</Button>
            </div>
            <TopupForm
              companyId={company.id}
              employeeCount={salaries.length}
              onCompleted={() => {
                setShowTopupForm(false)
                void loadSalaries()
              }}
            />
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-3xl border bg-card shadow-sm" aria-labelledby="employees-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5 sm:px-7">
            <div>
              <h2 id="employees-title" className="text-2xl font-black">Salariés</h2>
              <p className="mt-1 text-sm text-muted-foreground">Liste chargée depuis la route API salariés existante.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadSalaries()} disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />} Actualiser
            </Button>
          </div>

          {loadError ? (
            <p role="alert" className="m-5 rounded-2xl bg-brand-red-soft p-4 text-sm font-semibold text-brand-red-dark sm:m-7">{loadError}</p>
          ) : loading ? (
            <div className="p-7 text-sm text-muted-foreground">Chargement des salariés…</div>
          ) : salaries.length === 0 ? (
            <div className="p-7 sm:p-10">
              <div className="mx-auto max-w-xl text-center">
                <UserPlus className="mx-auto size-11 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-black">Aucun salarié actif</h3>
                <p className="mt-2 text-muted-foreground">Commencez par transmettre une demande de création de compte salarié.</p>
                <Button
                  className="mt-5"
                  onClick={() => {
                    setEditing(null)
                    setShowEmployeeForm(true)
                  }}
                >
                  <Plus aria-hidden="true" /> Ajouter un salarié
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {salaries.map((salary) => (
                <article key={salary.id} className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[1.4fr_1fr_1fr_auto] xl:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black">{salary.name} {salary.surname}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{salary.email}</p>
                    {salary.isBanned && <p className="mt-2 text-sm font-bold text-brand-red-dark">Compte banni</p>}
                  </div>

                  <div className="rounded-2xl bg-secondary p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Solde disponible</p>
                    <p className="mt-1 text-xl font-black">{formatMoney(salary.balance)}</p>
                  </div>

                  <div className="rounded-2xl bg-secondary p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Activité</p>
                    <p className="mt-1 font-black">{salary.transactionCount} transaction{salary.transactionCount > 1 ? "s" : ""}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatMoney(salary.transactionTotal)} enregistrés</p>
                  </div>

                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setEditing(salary)
                      setShowEmployeeForm(false)
                      setShowTopupForm(false)
                      window.requestAnimationFrame(() => document.getElementById("employee-form-title")?.focus())
                    }}
                  >
                    <PencilLine aria-hidden="true" /> Modifier
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function EmployeeForm({
  employee,
  companyId,
  onSaved,
}: {
  employee: EditingEmployee
  companyId: string
  onSaved: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    const surname = String(form.get("surname") ?? "").trim()
    const email = String(form.get("email") ?? "").trim()
    const password = String(form.get("password") ?? "")
    const documentId = String(form.get("documentId") ?? "").trim()

    try {
      if (employee) {
        const patch: Record<string, string> = { name, surname, email }
        if (password) patch.password = password
        if (documentId) patch.documentId = documentId

        await apiFetch(`/api/v1/salaries/${encodeURIComponent(employee.id)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        })
      } else {
        await apiFetch("/api/v1/salaries", {
          method: "POST",
          body: JSON.stringify({
            name,
            surname,
            email,
            password,
            documentId,
            companyId,
          }),
        })
      }

      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’enregistrer le salarié.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="mt-7 space-y-6" onSubmit={onSubmit}>
      <fieldset className="grid gap-5 rounded-2xl border p-5 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="px-2 text-sm font-black">Salarié</legend>
        <div>
          <Label htmlFor="employee-first-name">Prénom</Label>
          <Input id="employee-first-name" name="name" className="mt-2" defaultValue={employee?.name} required autoComplete="given-name" />
        </div>
        <div>
          <Label htmlFor="employee-last-name">Nom</Label>
          <Input id="employee-last-name" name="surname" className="mt-2" defaultValue={employee?.surname} required autoComplete="family-name" />
        </div>
        <div>
          <Label htmlFor="employee-email">Email professionnel</Label>
          <Input id="employee-email" name="email" type="email" className="mt-2" defaultValue={employee?.email} required autoComplete="email" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="employee-password">{employee ? "Nouveau mot de passe (facultatif)" : "Mot de passe initial"}</Label>
          <Input
            id="employee-password"
            name="password"
            type="password"
            className="mt-2"
            required={!employee}
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div>
          <Label htmlFor="employee-document-id">{employee ? "Nouveau document ID (facultatif)" : "Document ID"}</Label>
          <Input
            id="employee-document-id"
            name="documentId"
            className="mt-2"
            required={!employee}
            placeholder="UUID du justificatif"
          />
        </div>
      </fieldset>

      <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
        Le champ Document ID est temporaire : le prochain patch branchera le sélecteur PDF sur le stockage Garage sans modifier les routes API existantes.
      </p>

      {error && <p role="alert" className="rounded-xl bg-brand-red-soft px-4 py-3 text-sm font-semibold text-brand-red-dark">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : employee ? <RefreshCw aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        {employee ? "Enregistrer les modifications" : "Envoyer la demande de création"}
      </Button>
    </form>
  )
}

function TopupForm({
  companyId,
  employeeCount,
  onCompleted,
}: {
  companyId: string
  employeeCount: number
  onCompleted: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const form = new FormData(event.currentTarget)
    const euros = Number(form.get("amount") ?? 0)
    const amount = Math.round(euros * 100)

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Le montant doit être supérieur à 0 €.")
      setSubmitting(false)
      return
    }

    try {
      const payload = await apiFetch<TopupResponse>(
        `/api/v1/employeurs/${encodeURIComponent(companyId)}/abondements`,
        {
          method: "POST",
          body: JSON.stringify({
            montant: amount,
            type: String(form.get("type") ?? "fixe"),
            date: String(form.get("date") ?? "") || undefined,
            comment: String(form.get("comment") ?? "").trim() || undefined,
          }),
        },
      )

      setSuccess(`${payload.salariesCredites} salarié${payload.salariesCredites > 1 ? "s" : ""} crédité${payload.salariesCredites > 1 ? "s" : ""} de ${formatMoney(payload.montant)}.`)
      onCompleted()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’effectuer l’abondement.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="mt-7 space-y-5" onSubmit={onSubmit}>
      <div className="grid gap-5 rounded-2xl border p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="topup-amount">Montant par salarié (€)</Label>
          <Input id="topup-amount" name="amount" type="number" min="0.01" step="0.01" className="mt-2" required />
        </div>
        <div>
          <Label htmlFor="topup-type">Type</Label>
          <select
            id="topup-type"
            name="type"
            defaultValue="fixe"
            className="mt-2 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="fixe">Fixe</option>
            <option value="variable">Variable</option>
          </select>
        </div>
        <div>
          <Label htmlFor="topup-date">Date (facultatif)</Label>
          <Input id="topup-date" name="date" type="date" className="mt-2" />
        </div>
        <div className="rounded-xl bg-secondary p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Salariés concernés</p>
          <p className="mt-1 text-2xl font-black">{employeeCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tous les salariés actifs de l’entreprise.</p>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <Label htmlFor="topup-comment">Commentaire (facultatif)</Label>
          <Input id="topup-comment" name="comment" className="mt-2" maxLength={500} />
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-brand-red-soft px-4 py-3 text-sm font-semibold text-brand-red-dark">{error}</p>}
      {success && <p role="status" className="rounded-xl bg-brand-success-soft px-4 py-3 text-sm font-semibold text-brand-success">{success}</p>}

      <Button type="submit" disabled={submitting || employeeCount === 0}>
        {submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <CircleDollarSign aria-hidden="true" />}
        Confirmer l’abondement
      </Button>
    </form>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-primary"><span className="[&>svg]:size-5" aria-hidden="true">{icon}</span><p className="text-sm font-bold">{label}</p></div>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  )
}
