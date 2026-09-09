"use client"

import { useEffect, useRef, useState } from "react"
import {
  Building2,
  CheckCircle2,
  Hash,
  History,
  LoaderCircle,
  Mail,
  MapPin,
  QrCode,
  XCircle,
} from "lucide-react"
import { AccountHeader } from "@/components/account-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCurrentUser } from "@/hooks/use-current-user"
import { apiFetch, formatMoney, type ApiCompany } from "@/lib/api-client"

function PartnerInfo({ company }: { company: ApiCompany | null }) {
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

  return (
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="bg-primary p-7 text-primary-foreground sm:p-8">
        <p className="text-sm font-semibold text-primary-foreground/80">Informations du partenaire</p>
        <h2 className="mt-1 text-2xl font-black">{company.name}</h2>
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

// The QR code an employee shows carries the plaintext code only; the API stores
// and expects its SHA-256 hash, so the hash is computed here, right after the
// scan. `crypto.subtle` needs a secure context, which the dev server provides
// through its --experimental-https flag.
async function sha256Hex(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Le calcul d'empreinte nécessite une connexion sécurisée (HTTPS).")
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

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

  // Turns a raw scan into the salarié to bill. The code alone does not say whose
  // card it is, so the hash is resolved server-side — which also rejects a code
  // issued for another partner before the cashier ever types an amount.
  async function handleDetected(rawValue: string) {
    stopScanning()
    setResolving(true)
    setError(null)
    try {
      const content = await sha256Hex(rawValue.trim())
      const resolved = await apiFetch<{ salarieId: string; name: string; surname: string }>(
        "/api/v1/qrcode/resolve",
        { method: "POST", body: JSON.stringify({ content }) },
      )
      setScanned({ content, ...resolved })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "QR code illisible.")
    } finally {
      setResolving(false)
    }
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
    setOpen(false)
  }

  const showCamera = !scanned && !resolving && !error

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="scan-title">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">Caisse</p>
      <h2 id="scan-title" className="mt-1 text-2xl font-black">Scanner un QR code</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Scannez le QR code du salarié, saisissez le montant à facturer, puis validez l&apos;encaissement.
      </p>
      <Button className="mt-5" onClick={() => setOpen(true)} disabled={!companyId}>
        <QrCode aria-hidden="true" /> Ouvrir le lecteur QR code
      </Button>
      {!companyId && (
        <p className="mt-3 text-sm text-muted-foreground">
          Votre compte n&apos;est rattaché à aucune entreprise partenaire : l&apos;encaissement est indisponible.
        </p>
      )}
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Encaisser un paiement</DialogTitle>
            <DialogDescription>
              {scanned
                ? "Saisissez le montant à facturer, puis validez la transaction."
                : "Présentez le QR code du salarié devant la caméra."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {error && (
              <div className="w-full space-y-3 text-center">
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </p>
                <Button variant="outline" onClick={() => setAttempt((current) => current + 1)}>
                  Rescanner
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

const PARTNER_TABS = [
  { id: "scan", label: "Scanner QR Code", icon: QrCode },
  { id: "info", label: "Infos partenaire", icon: Building2 },
  { id: "history", label: "Historique", icon: History },
] as const

export default function PartenairePage() {
  const [tab, setTab] = useState<(typeof PARTNER_TABS)[number]["id"]>("scan")
  const { data: session, loading } = useCurrentUser()
  const company = session?.company ?? null

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />
      <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Espace partenaire</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{company?.name ?? "Bienvenue"}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Scannez les QR codes de paiement, consultez vos informations et l&apos;historique de votre caisse.
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
              {tab === "info" && <PartnerInfo company={company} />}
              {tab === "history" && (
                <TransactionHistory
                  partenaireId={company?.id ?? null}
                  companyName={company?.name ?? "votre établissement"}
                />
              )}
              {tab === "scan" && <QrCodeScanner companyId={company?.id ?? null} />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
