"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCurrentUser } from "@/hooks/use-current-user"
import { apiFetch, formatMoney, type ApiCompany } from "@/lib/api-client"
import { LogOut } from "lucide-react"

interface PartnerSidebarProps {
  activeTab: string
  onSelectTab: (tab: string) => void
}

function PartnerSidebar({ activeTab, onSelectTab }: PartnerSidebarProps) {
  const router = useRouter()
  const navItems = [
    { id: "scan", title: "Scanner QR Code" },
    { id: "info", title: "Infos Partenaire" },
    { id: "history", title: "Historique des transactions" },
  ]

  // TODO: brancher sur la vraie logique de déconnexion (session/auth) une
  // fois disponible ; pour l'instant on redirige simplement vers /login.
  function handleLogout() {
    router.push("/login")
  }

  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col">
      <div className="p-4 font-bold text-lg">Espace Partenaire</div>
      <nav className="flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`w-full text-left px-4 py-2 hover:bg-muted/50 ${activeTab === item.id ? "bg-muted font-semibold" : ""}`}
            onClick={() => onSelectTab(item.id)}
          >
            {item.title}
          </button>
        ))}
      </nav>
      <div className="p-2 border-t">
        <button
          className="w-full flex items-center gap-2 text-left px-4 py-2 rounded-md text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}

function PartnerInfo({ company }: { company: ApiCompany | null }) {
  if (!company) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold mb-2">Informations du partenaire</h2>
        <p className="text-muted-foreground">
          Votre compte n&apos;est rattaché à aucune entreprise partenaire.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-2">Informations du partenaire</h2>
      <Card>
        <CardHeader>
          <CardTitle>{company.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2">Catégorie : {company.category?.category ?? "—"}</div>
          <div className="mb-2">Adresse : {company.address}, {company.postalCode}</div>
          <div className="mb-2">SIRET : {company.siret}</div>
          <div className="mb-2">Contact : {company.email}</div>
        </CardContent>
      </Card>
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-2">Historique des transactions — {companyName}</h2>

      {error && <div className="rounded bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="text-muted-foreground">Chargement des transactions...</div>
      ) : transactions.length === 0 && !error ? (
        <div className="text-muted-foreground">Aucune transaction pour le moment.</div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            {transactions.length} transaction{transactions.length > 1 ? "s" : ""} · encaissé :{" "}
            <span className="font-semibold text-foreground">{formatMoney(total)}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Date</th>
                  <th className="text-left px-4 py-2 font-semibold">Client</th>
                  <th className="text-left px-4 py-2 font-semibold">Type</th>
                  <th className="text-left px-4 py-2 font-semibold">Statut</th>
                  <th className="text-right px-4 py-2 font-semibold">Montant</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-2">
                      {new Date(t.createdAt).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      {t.user ? `${t.user.name} ${t.user.surname}` : "—"}
                    </td>
                    <td className="px-4 py-2">{t.type}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          t.status === "VALIDER"
                            ? "text-brand-green-deep font-semibold"
                            : "text-destructive font-semibold"
                        }
                      >
                        {t.status === "VALIDER" ? "Validée" : "Refusée"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{formatMoney(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-2">Scanner un QR Code</h2>
      <p className="text-muted-foreground">
        Scannez le QR code du salarié, saisissez le montant à facturer, puis validez l&apos;encaissement.
      </p>
      <Button onClick={() => setOpen(true)} disabled={!companyId}>
        Ouvrir le lecteur QR Code
      </Button>
      {!companyId && (
        <p className="text-sm text-muted-foreground">
          Votre compte n&apos;est rattaché à aucune entreprise partenaire : l&apos;encaissement est indisponible.
        </p>
      )}
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encaisser un paiement</DialogTitle>
            <DialogDescription>
              {scanned
                ? "Saisissez le montant à facturer, puis validez la transaction."
                : "Présentez le QR code du salarié devant la caméra."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {error && (
              <div className="w-full space-y-3 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" onClick={() => setAttempt((current) => current + 1)}>
                  Rescanner
                </Button>
              </div>
            )}
            {resolving && <div className="text-sm text-muted-foreground">Lecture du QR code…</div>}
            {showCamera && (
              <video
                ref={videoRef}
                className="w-full aspect-square rounded-lg bg-black object-cover"
                muted
                playsInline
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
            {scanned && companyId && (
              <QrPaymentForm scanned={scanned} companyId={companyId} onDone={handleClose} />
            )}
          </div>
          <DialogFooter showCloseButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
    return (
      <div className="w-full space-y-3 text-center">
        {result.status === "VALIDER" ? (
          <>
            <p className="font-semibold text-brand-green-deep">Paiement validé</p>
            <p className="text-sm text-muted-foreground">
              Nouveau solde de {scanned.name} : {formatMoney(result.newBalance)}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-destructive">Paiement refusé — solde insuffisant</p>
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
      <div className="rounded bg-muted p-3 text-center">
        <div className="text-sm text-muted-foreground">Salarié</div>
        <div className="font-semibold">{scanned.name} {scanned.surname}</div>
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
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Validation…" : "Valider la transaction"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}

export default function PartenairePage() {
  const [tab, setTab] = useState("scan")
  const { data: session, loading } = useCurrentUser()
  const company = session?.company ?? null

  return (
    <div className="flex min-h-screen">
      <PartnerSidebar activeTab={tab} onSelectTab={setTab} />
      <main className="flex-1 p-6">
        {loading ? (
          <div className="text-muted-foreground">Chargement de votre espace…</div>
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
      </main>
    </div>
  )
}
