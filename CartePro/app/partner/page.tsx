"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Hash,
  History,
  LoaderCircle,
  Mail,
  MapPin,
  PencilLine,
  QrCode,
  Search,
  Store,
  XCircle,
} from "lucide-react"
import { AccountHeader } from "@/components/account-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCurrentUser } from "@/hooks/use-current-user"
import {
  apiFetch,
  formatMoney,
  type ApiCompany,
  type ApiCompanyCategory,
  type ApiPartner,
  type CategoriesResponse,
} from "@/lib/api-client"

interface PartnerInfoProps {
  company: ApiCompany | null
  onUpdated: () => void
}

function PartnerInfo({ company, onUpdated }: PartnerInfoProps) {
  const [editing, setEditing] = useState(false)

  if (!company) {
    return (
      <section className="rounded-3xl border border-dashed bg-card p-8 text-center shadow-sm">
        <Building2 className="mx-auto size-12 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-black">Informations du partenaire</h2>
        <p className="mt-2 text-muted-foreground">
          Votre compte n&apos;est rattaché à aucune entreprise partenaire.
        </p>
      </section>
    )
  }

  if (editing) {
    return (
      <PartnerInfoForm
        company={company}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          onUpdated()
        }}
      />
    )
  }

  return (
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 bg-primary p-7 text-primary-foreground sm:p-8">
        <div>
          <p className="text-sm font-semibold text-primary-foreground/80">Informations du partenaire</p>
          <h2 className="mt-1 text-2xl font-black">{company.name}</h2>
          <Badge
            variant={company.verified ? "outline" : "destructive"}
            className={`mt-3 ${company.verified ? "border-transparent bg-brand-success-soft text-brand-success" : ""}`}
          >
            {company.verified ? "Compte vérifié" : "En attente de validation administrative"}
          </Badge>
        </div>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          <PencilLine aria-hidden="true" /> Modifier
        </Button>
      </div>
      <div className="grid gap-5 p-7 sm:grid-cols-2 sm:p-8">
        <InfoField icon={<Building2 />} label="Catégorie" value={company.category?.category ?? "—"} />
        <InfoField icon={<MapPin />} label="Adresse" value={`${company.address}, ${company.postalCode}`} />
        <InfoField icon={<Hash />} label="SIRET" value={company.siret} />
        <InfoField icon={<Mail />} label="Contact" value={company.email} />
      </div>
    </section>
  )
}

interface PartnerInfoFormProps {
  company: ApiCompany
  onCancel: () => void
  onSaved: () => void
}

// The partner's own management form only ever sends fields an ADMIN doesn't
// have to review — the API itself rejects `verified`/`agentId`/`reasonId`/
// `kbisId` from a non-admin caller, but the form shouldn't even offer them:
// the account stays "subject to administrative validation" either way.
function PartnerInfoForm({ company, onCancel, onSaved }: PartnerInfoFormProps) {
  const [categories, setCategories] = useState<ApiCompanyCategory[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    apiFetch<CategoriesResponse>("/api/v1/categories")
      .then((payload) => {
        if (!cancelled) setCategories(payload.categories ?? [])
      })
      .catch(() => {
        // The current category still shows as the select's default value.
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const categoryName = String(form.get("category") ?? "")
    const category = categories.find((c) => c.category === categoryName)

    try {
      await apiFetch(`/api/v1/partenaires/${company.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          description: String(form.get("description") ?? "").trim(),
          address: String(form.get("address") ?? "").trim(),
          postalCode: String(form.get("postalCode") ?? "").trim(),
          ...(category ? { categoryId: category.id } : {}),
        }),
      })
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d'enregistrer les modifications.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border bg-card p-7 shadow-sm sm:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">Modifier mon compte</p>
      <h2 className="mt-1 text-2xl font-black">{company.name}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Le SIRET et le justificatif Kbis ne sont pas modifiables ici : contactez un administrateur pour ces informations.
      </p>

      <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
        <div className="sm:col-span-2">
          <Label htmlFor="partner-name">Nom de l&apos;établissement</Label>
          <Input id="partner-name" name="name" defaultValue={company.name} className="mt-2" required />
        </div>
        <div>
          <Label htmlFor="partner-category">Catégorie d&apos;activité</Label>
          <select
            id="partner-category"
            name="category"
            defaultValue={company.category?.category ?? ""}
            required
            disabled={categories.length === 0}
            className="mt-2 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="" disabled>Sélectionner</option>
            {categories.map((category) => (
              <option key={category.id} value={category.category}>{category.category}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="partner-email">Email de contact</Label>
          <Input id="partner-email" name="email" type="email" defaultValue={company.email} className="mt-2" required />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="partner-description">Description</Label>
          <textarea
            id="partner-description"
            name="description"
            rows={3}
            maxLength={500}
            required
            defaultValue={company.description ?? ""}
            className="mt-2 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="partner-address">Adresse</Label>
          <Input id="partner-address" name="address" defaultValue={company.address} className="mt-2" required />
        </div>
        <div>
          <Label htmlFor="partner-postal">Code postal</Label>
          <Input id="partner-postal" name="postalCode" defaultValue={company.postalCode} className="mt-2" required inputMode="numeric" />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-brand-red-soft px-4 py-3 text-sm font-semibold text-brand-red-dark sm:col-span-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={submitting}>
            {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Enregistrer
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Annuler
          </Button>
        </div>
      </form>
    </section>
  )
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-5">
      <div className="flex items-center gap-2 text-primary">
        <span className="[&>svg]:size-4" aria-hidden="true">{icon}</span>
        <p className="text-sm font-bold">{label}</p>
      </div>
      <p className="mt-2 break-words font-semibold">{value}</p>
    </div>
  )
}

// A row of the partner's till, as returned by
// GET /api/v1/partenaires/{partenaireId}/transactions.
type PartnerTransaction = {
  id: string
  type: "PAYMENT" | "REFUND" | "TOPUP"
  amount: number
  newBalance: number
  status: "REFUSER" | "VALIDER"
  createdAt: string
  user: { id: string; name: string; surname: string } | null
}

interface TransactionHistoryProps {
  partenaireId: string | null
  companyName: string
}

function TransactionHistory({ partenaireId, companyName }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadTransactions() {
      setLoading(true)
      setError(null)

      if (!partenaireId) {
        setTransactions([])
        setLoading(false)
        return
      }

      try {
        const data = await apiFetch<{ transactions: PartnerTransaction[] }>(
          `/api/v1/partenaires/${partenaireId}/transactions?limit=50`,
        )
        if (!cancelled) setTransactions(data.transactions ?? [])
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Impossible de charger les transactions.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadTransactions()
    return () => {
      cancelled = true
    }
  }, [partenaireId])

  // Only validated payments are money actually taken; a refund gives some back.
  const total = transactions
    .filter((t) => t.status === "VALIDER")
    .reduce((sum, t) => sum + (t.type === "REFUND" ? -t.amount : t.amount), 0)

  return (
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm" aria-labelledby="partner-history-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5 sm:px-7">
        <div>
          <h2 id="partner-history-title" className="text-2xl font-black">Historique des transactions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {companyName}
            {!loading && !error && ` · ${transactions.length} transaction${transactions.length > 1 ? "s" : ""}`}
          </p>
        </div>
        {!loading && !error && transactions.length > 0 && (
          <div className="rounded-2xl bg-secondary px-5 py-3 text-right">
            <p className="text-sm font-semibold text-primary">Encaissé</p>
            <p className="text-xl font-black">{formatMoney(total)}</p>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="m-5 rounded-2xl bg-brand-red-soft p-4 text-sm font-semibold text-brand-red-dark sm:m-7">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement des transactions…
        </div>
      ) : transactions.length === 0 && !error ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Aucune transaction pour le moment.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 text-right font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">
                    {new Date(t.createdAt).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {t.user ? `${t.user.name} ${t.user.surname}` : "—"}
                  </td>
                  <td className="px-4 py-3">{t.type}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={t.status === "VALIDER" ? "outline" : "destructive"}
                      className={t.status === "VALIDER" ? "border-transparent bg-brand-success-soft text-brand-success" : undefined}
                    >
                      {t.status === "VALIDER" ? "Validée" : "Refusée"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

type PeriodGranularity = "day" | "week" | "month"

// Groups a date into the bucket it belongs to for a given granularity. Weeks
// start on Monday, matching how the rest of the app formats French dates.
function bucketKey(date: Date, granularity: PeriodGranularity): string {
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  }
  if (granularity === "week") {
    const start = new Date(date)
    const mondayOffset = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - mondayOffset)
    return start.toISOString().slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function bucketLabel(key: string, granularity: PeriodGranularity): string {
  if (granularity === "month") {
    const [year, month] = key.split("-").map(Number)
    return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1))
  }
  const date = new Date(`${key}T00:00:00`)
  if (granularity === "week") {
    return `Sem. du ${date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`
  }
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

const GRANULARITY_OPTIONS: { id: PeriodGranularity; label: string }[] = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
]

// The transactions endpoint pages at up to 100 rows; the dashboard fetches a
// handful of pages up front so period totals aren't computed from a single
// truncated page of 50 rows like the raw history table uses.
const DASHBOARD_PAGE_LIMIT = 100
const DASHBOARD_MAX_PAGES = 5

interface FinancialDashboardProps {
  partenaireId: string | null
}

function FinancialDashboard({ partenaireId }: FinancialDashboardProps) {
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [granularity, setGranularity] = useState<PeriodGranularity>("month")

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      if (!partenaireId) {
        setTransactions([])
        setTruncated(false)
        setLoading(false)
        return
      }

      try {
        const collected: PartnerTransaction[] = []
        let page = 1
        let hasNextPage = true

        while (hasNextPage && page <= DASHBOARD_MAX_PAGES) {
          const data = await apiFetch<{ transactions: PartnerTransaction[]; meta: { hasNextPage: boolean } }>(
            `/api/v1/partenaires/${partenaireId}/transactions?limit=${DASHBOARD_PAGE_LIMIT}&page=${page}`,
          )
          collected.push(...(data.transactions ?? []))
          hasNextPage = data.meta?.hasNextPage ?? false
          page += 1
        }

        if (!cancelled) {
          setTransactions(collected)
          setTruncated(hasNextPage)
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Impossible de charger le tableau de bord.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [partenaireId])

  // Only validated payments are money actually taken; a refund gives some back.
  const netAmount = (t: PartnerTransaction) => (t.type === "REFUND" ? -t.amount : t.amount)
  const validated = transactions.filter((t) => t.status === "VALIDER")
  const totalReceived = validated.reduce((sum, t) => sum + netAmount(t), 0)
  const average = validated.length > 0 ? totalReceived / validated.length : 0

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const monthTotal = validated
    .filter((t) => new Date(t.createdAt) >= startOfMonth)
    .reduce((sum, t) => sum + netAmount(t), 0)

  const buckets = new Map<string, number>()
  for (const t of validated) {
    const key = bucketKey(new Date(t.createdAt), granularity)
    buckets.set(key, (buckets.get(key) ?? 0) + netAmount(t))
  }
  const sortedBuckets = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
  const maxBucketAmount = Math.max(1, ...sortedBuckets.map(([, amount]) => Math.abs(amount)))

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoField icon={<CircleDollarSign />} label="Total encaissé" value={formatMoney(totalReceived)} />
        <InfoField icon={<CircleDollarSign />} label="Encaissé ce mois-ci" value={formatMoney(monthTotal)} />
        <InfoField icon={<History />} label="Transactions validées" value={String(validated.length)} />
        <InfoField icon={<CircleDollarSign />} label="Panier moyen" value={formatMoney(average)} />
      </div>

      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5 sm:px-7">
          <div>
            <h2 className="text-2xl font-black">Encaissements par période</h2>
            <p className="mt-1 text-sm text-muted-foreground">Montants validés, regroupés par {granularity === "day" ? "jour" : granularity === "week" ? "semaine" : "mois"}.</p>
          </div>
          <div className="flex gap-2">
            {GRANULARITY_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={granularity === option.id ? "default" : "outline"}
                onClick={() => setGranularity(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="m-5 rounded-2xl bg-brand-red-soft p-4 text-sm font-semibold text-brand-red-dark sm:m-7">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement du tableau de bord…
          </div>
        ) : sortedBuckets.length === 0 && !error ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Aucune transaction validée pour le moment.</div>
        ) : (
          <div className="space-y-3 p-5 sm:p-7">
            {sortedBuckets.map(([key, amount]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs font-semibold text-muted-foreground">{bucketLabel(key, granularity)}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (Math.abs(amount) / maxBucketAmount) * 100)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-sm font-bold">{formatMoney(amount)}</span>
              </div>
            ))}
            {truncated && (
              <p className="pt-2 text-xs text-muted-foreground">
                Affichage limité aux {DASHBOARD_MAX_PAGES * DASHBOARD_PAGE_LIMIT} transactions les plus récentes.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// Minimal ambient type so TS stops complaining about the experimental
// BarcodeDetector API (not yet in lib.dom.d.ts).
interface BarcodeDetectorResult {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike
  }
}

// The employee's QR (and its text fallback) already carries the SHA-256 hash
// the API stores as `qrCode.content` — it's handed out as-is by POST /api/v1/qrcode,
// not derived from some other seed the reader would need to hash again.
const MANUAL_CODE_PATTERN = /^[a-f0-9]{64}$/

type ScannedQrCode = {
  content: string
  salarieId: string
  name: string
  surname: string
}

interface QrCodeScannerProps {
  companyId: string | null
}

function QrCodeScanner({ companyId }: QrCodeScannerProps) {
  const [open, setOpen] = useState(false)
  const [scanned, setScanned] = useState<ScannedQrCode | null>(null)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped to restart the camera after a failed scan: re-running the effect is
  // what reopens the stream, and `open` is already true at that point.
  const [attempt, setAttempt] = useState(0)
  const [manualCode, setManualCode] = useState("")
  const [manualCodeError, setManualCodeError] = useState<string | null>(null)
  // True once a transaction is being resolved from the typed fallback code
  // rather than a camera scan, so the dialog skips the camera entirely.
  const [manualMode, setManualMode] = useState(false)
  const skipCameraRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  function stopScanning() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  // Turns a code (scanned or typed) into the salarié to bill. The code alone
  // does not say whose card it is, so it's resolved server-side — which also
  // rejects a code issued for another partner before the cashier ever types
  // an amount.
  async function resolveCode(content: string) {
    setResolving(true)
    setError(null)
    try {
      const resolved = await apiFetch<{ salarieId: string; name: string; surname: string }>(
        "/api/v1/qrcode/resolve",
        { method: "POST", body: JSON.stringify({ content }) },
      )
      setScanned({ content, ...resolved })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Code introuvable ou expiré.")
    } finally {
      setResolving(false)
    }
  }

  async function handleDetected(rawValue: string) {
    stopScanning()
    await resolveCode(rawValue.trim())
  }

  function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = manualCode.replace(/\s+/g, "").toLowerCase()
    if (!MANUAL_CODE_PATTERN.test(content)) {
      setManualCodeError("Ce code doit contenir 64 caractères (chiffres et lettres a-f).")
      return
    }
    setManualCodeError(null)
    setManualMode(true)
    skipCameraRef.current = true
    setOpen(true)
    void resolveCode(content)
  }

  async function scanWithBarcodeDetector() {
    if (!window.BarcodeDetector) return
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] })
    const tick = async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      try {
        const codes = await detector.detect(video)
        if (codes.length > 0) {
          void handleDetected(codes[0].rawValue)
          return
        }
      } catch {
        // Transient decode errors are normal between frames — keep scanning.
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  async function scanWithJsQr() {
    // Fallback for browsers without BarcodeDetector (Firefox, Safari).
    let jsQR: any
    try {
      const jsqrModule: any = await import("jsqr")
      jsQR = jsqrModule.default ?? jsqrModule
    } catch {
      setError("Le module 'jsqr' est requis pour scanner sur ce navigateur (npm install jsqr).")
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const tick = () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        void handleDetected(code.data)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (!open) {
      stopScanning()
      return
    }

    let cancelled = false
    setScanned(null)
    setError(null)

    if (skipCameraRef.current) {
      skipCameraRef.current = false
      return () => {
        cancelled = true
      }
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          scanWithBarcodeDetector()
        } else {
          scanWithJsQr()
        }
      } catch {
        setError("Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur.")
      }
    }

    start()

    return () => {
      cancelled = true
      stopScanning()
    }
  }, [open, attempt])

  function handleClose() {
    setScanned(null)
    setError(null)
    setResolving(false)
    setManualMode(false)
    setManualCode("")
    setOpen(false)
  }

  function handleOpenScanner() {
    setManualMode(false)
    setOpen(true)
  }

  const showCamera = !scanned && !resolving && !error && !manualMode

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="scan-title">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">Caisse</p>
      <h2 id="scan-title" className="mt-1 text-2xl font-black">Scanner un QR code</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Scannez le QR code du salarié, saisissez le montant à facturer, puis validez l&apos;encaissement.
      </p>
      <Button className="mt-5" onClick={handleOpenScanner} disabled={!companyId}>
        <QrCode aria-hidden="true" /> Ouvrir le lecteur QR code
      </Button>
      {!companyId && (
        <p className="mt-3 text-sm text-muted-foreground">
          Votre compte n&apos;est rattaché à aucune entreprise partenaire : l&apos;encaissement est indisponible.
        </p>
      )}

      <form className="mt-6 max-w-sm border-t pt-5" onSubmit={handleManualSubmit}>
        <Label htmlFor="manual-qr-code">Le QR ne scanne pas ? Saisissez le code affiché sous celui du salarié</Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="manual-qr-code"
            className="font-mono"
            placeholder="Code à 64 caractères"
            value={manualCode}
            onChange={(e) => {
              setManualCode(e.target.value)
              setManualCodeError(null)
            }}
            disabled={!companyId}
          />
          <Button type="submit" variant="outline" disabled={!companyId || manualCode.trim().length === 0}>
            Valider
          </Button>
        </div>
        {manualCodeError && (
          <p role="alert" className="mt-2 text-sm text-destructive">{manualCodeError}</p>
        )}
      </form>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Encaisser un paiement</DialogTitle>
            <DialogDescription>
              {scanned
                ? "Saisissez le montant à facturer, puis validez la transaction."
                : manualMode
                ? "Vérification du code saisi…"
                : "Présentez le QR code du salarié devant la caméra."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {error && (
              <div className="w-full space-y-3 text-center">
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    manualMode
                      ? void resolveCode(manualCode.replace(/\s+/g, "").toLowerCase())
                      : setAttempt((current) => current + 1)
                  }
                >
                  {manualMode ? "Réessayer" : "Rescanner"}
                </Button>
              </div>
            )}
            {resolving && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Lecture du QR code…
              </p>
            )}
            {showCamera && (
              <video
                ref={videoRef}
                className="w-full aspect-square rounded-2xl bg-black object-cover"
                muted
                playsInline
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
            {scanned && companyId && (
              <QrPaymentForm scanned={scanned} companyId={companyId} onDone={handleClose} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

interface QrPaymentFormProps {
  scanned: ScannedQrCode
  companyId: string
  onDone: () => void
}

function QrPaymentForm({ scanned, companyId, onDone }: QrPaymentFormProps) {
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ status: "REFUSER" | "VALIDER"; newBalance: number } | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Amounts are entered in euros but stored in cents everywhere else.
    const cents = Math.round(Number(amount.replace(",", ".")) * 100)
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Saisissez un montant supérieur à 0 €.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = await apiFetch<{ status: "REFUSER" | "VALIDER"; newBalance: number }>(
        `/api/v1/salaries/${scanned.salarieId}/transactions`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: cents,
            type: "PAYMENT",
            content: scanned.content,
            companyId,
          }),
        },
      )
      setResult(response)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d'enregistrer la transaction.")
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    const success = result.status === "VALIDER"
    return (
      <div className="w-full space-y-4 text-center">
        <div
          className={`mx-auto flex size-12 items-center justify-center rounded-full ${
            success ? "bg-brand-success-soft text-brand-success" : "bg-brand-red-soft text-brand-red-dark"
          }`}
        >
          {success ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
        </div>
        {success ? (
          <>
            <p className="font-black text-brand-success">Paiement validé</p>
            <p className="text-sm text-muted-foreground">
              Nouveau solde de {scanned.name} : {formatMoney(result.newBalance)}
            </p>
          </>
        ) : (
          <>
            <p className="font-black text-brand-red-dark">Paiement refusé — solde insuffisant</p>
            <p className="text-sm text-muted-foreground">
              Solde de {scanned.name} : {formatMoney(result.newBalance)}
            </p>
          </>
        )}
        <Button className="w-full" onClick={onDone}>Terminer</Button>
      </div>
    )
  }

  return (
    <form className="w-full space-y-3" onSubmit={handleSubmit}>
      <div className="rounded-2xl bg-secondary p-4 text-center">
        <div className="text-sm text-muted-foreground">Salarié</div>
        <div className="font-black">{scanned.name} {scanned.surname}</div>
      </div>
      <div>
        <Label htmlFor="payment-amount">Montant à facturer (€)</Label>
        <Input
          id="payment-amount"
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          autoFocus
          className="mt-2"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {submitting ? "Validation…" : "Valider la transaction"}
      </Button>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}

interface PartnerCatalogProps {
  ownCompanyId: string | null
}

// Pure consultation of the other referenced partners — no map, no QR
// generation: those only make sense from the employee-facing catalog.
function PartnerCatalog({ ownCompanyId }: PartnerCatalogProps) {
  const [partners, setPartners] = useState<ApiPartner[]>([])
  const [categories, setCategories] = useState<ApiCompanyCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")

  useEffect(() => {
    let cancelled = false

    apiFetch<CategoriesResponse>("/api/v1/categories")
      .then((payload) => {
        if (!cancelled) setCategories(payload.categories ?? [])
      })
      .catch(() => {
        // The category filter simply stays limited to "Toutes les catégories".
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ network: "true", limit: "100" })
    if (category !== "all") params.set("categorie", category)

    apiFetch<{ data: ApiPartner[] }>(`/api/v1/partenaires?${params.toString()}`)
      .then((payload) => {
        if (!cancelled) setPartners(payload.data ?? [])
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Impossible de charger le réseau de partenaires.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [category])

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr")

    return partners
      .filter((partner) => partner.id !== ownCompanyId)
      .filter((partner) => {
        if (!normalized) return true
        const haystack = `${partner.name} ${partner.address} ${partner.postalCode}`.toLocaleLowerCase("fr")
        return haystack.includes(normalized)
      })
  }, [partners, query, ownCompanyId])

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">Réseau</p>
        <h2 className="mt-1 text-2xl font-black">Autres partenaires référencés</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Consultez les autres établissements du réseau pour orienter vos clients salariés.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Rechercher un partenaire</span>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Nom, adresse, code postal…" />
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">Toutes les catégories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.category}>{item.category}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-brand-red-soft p-4 text-sm font-semibold text-brand-red-dark">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border bg-card p-10 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement du réseau…
        </div>
      ) : visible.length === 0 && !error ? (
        <div className="rounded-3xl border border-dashed bg-card p-10 text-center text-muted-foreground">
          Aucun partenaire ne correspond à votre recherche.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((partner) => (
            <article key={partner.id} className="rounded-3xl border bg-card p-5 shadow-sm">
              <p className="text-sm font-semibold text-primary">{partner.category?.category ?? "Partenaire"}</p>
              <h3 className="mt-1 text-lg font-black">{partner.name}</h3>
              <p className="mt-3 flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{partner.address}, {partner.postalCode}</span>
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="size-4 shrink-0" aria-hidden="true" /> {partner.email}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

const PARTNER_TABS = [
  { id: "scan", label: "Scanner QR Code", icon: QrCode },
  { id: "dashboard", label: "Tableau de bord", icon: CircleDollarSign },
  { id: "history", label: "Historique", icon: History },
  { id: "info", label: "Infos partenaire", icon: Building2 },
  { id: "network", label: "Réseau partenaires", icon: Store },
] as const

export default function PartenairePage() {
  const [tab, setTab] = useState<(typeof PARTNER_TABS)[number]["id"]>("scan")
  const { data: session, loading, reload } = useCurrentUser()
  const company = session?.company ?? null

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />
      <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Espace partenaire</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{company?.name ?? "Bienvenue"}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Scannez les QR codes de paiement, suivez vos encaissements, gérez votre fiche et consultez le réseau partenaire.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-2" role="tablist" aria-label="Navigation espace partenaire">
          {PARTNER_TABS.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              variant={tab === id ? "default" : "outline"}
              onClick={() => setTab(id)}
            >
              <Icon aria-hidden="true" /> {label}
            </Button>
          ))}
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-3xl border bg-card p-10 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement de votre espace…
            </div>
          ) : (
            <>
              {tab === "scan" && <QrCodeScanner companyId={company?.id ?? null} />}
              {tab === "dashboard" && <FinancialDashboard partenaireId={company?.id ?? null} />}
              {tab === "history" && (
                <TransactionHistory
                  partenaireId={company?.id ?? null}
                  companyName={company?.name ?? "votre établissement"}
                />
              )}
              {tab === "info" && <PartnerInfo company={company} onUpdated={() => void reload()} />}
              {tab === "network" && <PartnerCatalog ownCompanyId={company?.id ?? null} />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
