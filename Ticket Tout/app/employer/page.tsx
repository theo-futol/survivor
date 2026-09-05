"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BadgeCheck,
  CalendarDays,
  FileCheck2,
  FileText,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react"

import { AccountHeader } from "@/components/account-header"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"

type RequestStatus = "pending" | "accepted" | "refused"

type EmployeeRequest = {
  id: string
  companyName: string
  employeeFirstName: string
  employeeLastName: string
  employeeEmail: string
  employeePhone: string
  position: string
  contractType: string
  contractStartDate: string
  contractEndDate: string
  cardValidFrom: string
  cardValidUntil: string
  contractFileName: string
  contractSize: number
  status: RequestStatus
  version: number
  createdAt: string
  updatedAt: string
}

type EditingEmployee = EmployeeRequest | null

const CONTRACT_TYPES = ["CDI", "CDD", "Alternance", "Stage", "Intérim", "Autre"]

export default function EmployerPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const user = session?.user as
    | {
        accountType?: "employee" | "company" | "partner"
        organizationName?: string
      }
    | undefined

  const [requests, setRequests] = useState<EmployeeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<EditingEmployee>(null)

  async function loadRequests() {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch("/api/employer/employees", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Impossible de charger les demandes.")
      setRequests(payload.requests ?? [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Impossible de charger les demandes.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!sessionPending && user?.accountType === "company") void loadRequests()
    if (!sessionPending && user?.accountType !== "company") setLoading(false)
  }, [sessionPending, user?.accountType])

  const stats = useMemo(() => {
    const today = new Date()
    const inThirtyDays = new Date(today)
    inThirtyDays.setDate(inThirtyDays.getDate() + 30)

    return {
      total: requests.length,
      pending: requests.filter((request) => request.status === "pending").length,
      accepted: requests.filter((request) => request.status === "accepted").length,
      expiringSoon: requests.filter((request) => {
        const end = new Date(`${request.cardValidUntil}T23:59:59`)
        return end >= today && end <= inThirtyDays
      }).length,
    }
  }, [requests])

  if (sessionPending) {
    return (
      <div className="min-h-svh bg-background">
        <AccountHeader />
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">Chargement de votre espace employeur…</main>
      </div>
    )
  }

  if (user?.accountType !== "company") {
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
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Gérez les accès Ticket Tout de vos salariés.</h1>
              <p className="mt-3 max-w-2xl text-primary-foreground/85">
                Déposez le contrat de travail, renseignez ses dates et transmettez la demande de création de compte. La période du contrat définit automatiquement la période de validité de la carte.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
            >
              <UserPlus aria-hidden="true" /> Demander un compte salarié
            </Button>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Résumé des salariés">
          <StatCard icon={<Users />} label="Demandes suivies" value={stats.total} />
          <StatCard icon={<RefreshCw />} label="En attente" value={stats.pending} />
          <StatCard icon={<BadgeCheck />} label="Validées" value={stats.accepted} />
          <StatCard icon={<CalendarDays />} label="À renouveler sous 30 jours" value={stats.expiringSoon} />
        </section>

        {(showForm || editing) && (
          <section className="mt-6 rounded-3xl border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="employee-form-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">{editing ? "Renouvellement / modification" : "Nouvelle demande"}</p>
                <h2 id="employee-form-title" tabIndex={-1} className="mt-1 text-2xl font-black">
                  {editing ? `${editing.employeeFirstName} ${editing.employeeLastName}` : "Créer une demande de compte salarié"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  {editing
                    ? "Le dépôt d’un nouveau contrat remet la demande en attente de validation et met à jour les dates de validité de la carte."
                    : "Le salarié ne crée pas son compte lui-même : l’entreprise transmet d’abord cette demande avec son justificatif contractuel."}
                </p>
              </div>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                }}
              >
                Fermer
              </Button>
            </div>
            <EmployeeRequestForm
              key={editing?.id ?? "new"}
              employee={editing}
              onSaved={(saved) => {
                setRequests((current) => {
                  const exists = current.some((item) => item.id === saved.id)
                  return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current]
                })
                setEditing(null)
                setShowForm(false)
              }}
            />
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-3xl border bg-card shadow-sm" aria-labelledby="employees-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5 sm:px-7">
            <div>
              <h2 id="employees-title" className="text-2xl font-black">Salariés et demandes</h2>
              <p className="mt-1 text-sm text-muted-foreground">Suivez les demandes et renouvelez les contrats sans recréer le salarié.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadRequests()} disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />} Actualiser
            </Button>
          </div>

          {loadError ? (
            <p role="alert" className="m-5 rounded-2xl bg-brand-red-soft p-4 text-sm font-semibold text-brand-red-dark sm:m-7">{loadError}</p>
          ) : loading ? (
            <div className="p-7 text-sm text-muted-foreground">Chargement des salariés…</div>
          ) : requests.length === 0 ? (
            <div className="p-7 sm:p-10">
              <div className="mx-auto max-w-xl text-center">
                <UserPlus className="mx-auto size-11 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-black">Aucune demande pour le moment</h3>
                <p className="mt-2 text-muted-foreground">Commencez par transmettre le contrat et les informations d’un salarié.</p>
                <Button className="mt-5" onClick={() => setShowForm(true)}><Plus aria-hidden="true" /> Ajouter un salarié</Button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((request) => (
                <article key={request.id} className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[1.3fr_1fr_1fr_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black">{request.employeeFirstName} {request.employeeLastName}</h3>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{request.employeeEmail}</p>
                    <p className="mt-1 text-sm font-semibold">{request.position}</p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Contrat</p>
                    <p className="mt-1 font-black">{request.contractType} · version {request.version}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Du {formatDate(request.contractStartDate)} au {formatDate(request.contractEndDate)}</p>
                    <a
                      href={`/api/employer/employees/${request.id}/contract`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary underline underline-offset-4"
                    >
                      <FileText className="size-4" aria-hidden="true" /> Voir le contrat PDF
                    </a>
                  </div>

                  <div className="rounded-2xl bg-secondary p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Validité de la carte</p>
                    <p className="mt-1 font-black">{formatDate(request.cardValidFrom)} → {formatDate(request.cardValidUntil)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Synchronisée sur les dates du contrat.</p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(request)
                      setShowForm(false)
                      window.requestAnimationFrame(() => document.getElementById("employee-form-title")?.focus())
                    }}
                  >
                    <PencilLine aria-hidden="true" /> Renouveler / modifier
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

function EmployeeRequestForm({ employee, onSaved }: { employee: EditingEmployee; onSaved: (request: EmployeeRequest) => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(employee?.contractStartDate ?? "")
  const [endDate, setEndDate] = useState(employee?.contractEndDate ?? "")

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    if (String(form.get("contractStartDate")) > String(form.get("contractEndDate"))) {
      setError("La date de fin du contrat doit être postérieure ou égale à sa date de début.")
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch(employee ? `/api/employer/employees/${employee.id}` : "/api/employer/employees", {
        method: employee ? "PATCH" : "POST",
        body: form,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Impossible d’enregistrer la demande.")
      onSaved(payload.request)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’enregistrer la demande.")
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
          <Input id="employee-first-name" name="employeeFirstName" className="mt-2" defaultValue={employee?.employeeFirstName} required autoComplete="given-name" />
        </div>
        <div>
          <Label htmlFor="employee-last-name">Nom</Label>
          <Input id="employee-last-name" name="employeeLastName" className="mt-2" defaultValue={employee?.employeeLastName} required autoComplete="family-name" />
        </div>
        <div>
          <Label htmlFor="employee-position">Fonction / poste</Label>
          <Input id="employee-position" name="position" className="mt-2" defaultValue={employee?.position} required />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="employee-email">Email professionnel du salarié</Label>
          <Input id="employee-email" name="employeeEmail" type="email" className="mt-2" defaultValue={employee?.employeeEmail} required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="employee-phone">Téléphone <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
          <Input id="employee-phone" name="employeePhone" type="tel" className="mt-2" defaultValue={employee?.employeePhone} autoComplete="tel" />
        </div>
      </fieldset>

      <fieldset className="grid gap-5 rounded-2xl border p-5 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-2 text-sm font-black">Contrat et validité de la carte</legend>
        <div>
          <Label htmlFor="contract-type">Type de contrat</Label>
          <select
            id="contract-type"
            name="contractType"
            defaultValue={employee?.contractType ?? ""}
            required
            className="mt-2 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Sélectionner</option>
            {CONTRACT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="contract-start">Début du contrat</Label>
          <Input id="contract-start" name="contractStartDate" type="date" className="mt-2" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="contract-end">Fin du contrat</Label>
          <Input id="contract-end" name="contractEndDate" type="date" className="mt-2" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
        </div>
        <div className="rounded-xl bg-secondary p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Carte Ticket Tout</p>
          <p className="mt-1 text-sm font-black">{startDate && endDate ? `${formatDate(startDate)} → ${formatDate(endDate)}` : "Renseignez les dates"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Les mêmes dates seront appliquées à la carte.</p>
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <Label htmlFor="employee-contract">{employee ? "Nouveau contrat de travail (PDF)" : "Contrat de travail (PDF)"}</Label>
          <Input id="employee-contract" name="contract" type="file" accept="application/pdf,.pdf" className="mt-2 file:mr-3" required />
          <p className="mt-2 text-xs text-muted-foreground">
            PDF uniquement, 10 Mo maximum. {employee ? `Le document actuel « ${employee.contractFileName} » sera remplacé.` : "Le document reste stocké dans un espace serveur privé et n’est jamais publié dans le site."}
          </p>
        </div>
      </fieldset>

      <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4 text-sm">
        <FileCheck2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p>
          En envoyant cette demande, l’entreprise confirme que les informations saisies correspondent au contrat transmis. Toute modification ou renouvellement remet la demande en statut <strong>en attente</strong> pour contrôle.
        </p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-brand-red-soft px-4 py-3 text-sm font-semibold text-brand-red-dark">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : employee ? <RefreshCw aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        {employee ? "Envoyer le contrat renouvelé" : "Envoyer la demande de création"}
      </Button>
    </form>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-primary"><span className="[&>svg]:size-5" aria-hidden="true">{icon}</span><p className="text-sm font-bold">{label}</p></div>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: RequestStatus }) {
  if (status === "accepted") return <Badge className="bg-brand-success-soft text-brand-success">Validée</Badge>
  if (status === "refused") return <Badge variant="destructive">Refusée</Badge>
  return <Badge variant="secondary">En attente</Badge>
}

function formatDate(value: string) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`))
}
