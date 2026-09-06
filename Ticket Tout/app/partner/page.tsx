"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { QrCodeSvg } from "@/components/qr-code-svg"
import { X, LogOut } from "lucide-react"

function PartnerSidebar({ activeTab, onSelectTab }) {
  const router = useRouter()
  const navItems = [
    { id: "products", title: "Produits" },
    { id: "info", title: "Infos Partenaire" },
    { id: "history", title: "Historique des transactions" },
    { id: "scan", title: "Scanner QR Code" },
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

function ProductManager() {
  const [products, setProducts] = useState([
    { id: 1, name: "Sandwich Jambon", price: 4.5 },
    { id: 2, name: "Café", price: 1.2 },
  ])
  const [newName, setNewName] = useState("")
  const [newPrice, setNewPrice] = useState("")

  function addProduct(e) {
    e.preventDefault()
    if (!newName || !newPrice || isNaN(Number(newPrice))) return
    setProducts([...products, { id: Date.now(), name: newName, price: parseFloat(newPrice) }])
    setNewName("")
    setNewPrice("")
  }
  function removeProduct(id) {
    setProducts(products.filter((p) => p.id !== id))
  }
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-2">Vos produits</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {products.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{p.price.toFixed(2)} €</div>
            </CardContent>
            <CardFooter>
              <Button variant="destructive" size="sm" onClick={() => removeProduct(p.id)}>
                Supprimer
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      <form className="flex gap-2 items-end" onSubmit={addProduct}>
        <div>
          <Label htmlFor="product-name">Nom</Label>
          <Input id="product-name" value={newName} onChange={e => setNewName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="product-price">Prix (€)</Label>
          <Input id="product-price" value={newPrice} onChange={e => setNewPrice(e.target.value)} required type="number" min="0" step="0.01" />
        </div>
        <Button type="submit">Ajouter</Button>
      </form>
    </div>
  )
}

function PartnerInfo() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-2">Informations du partenaire</h2>
      <Card>
        <CardHeader>
          <CardTitle>{CURRENT_PARTNER.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2">Catégorie : Commerce alimentaire</div>
          <div className="mb-2">Adresse : 12 rue de Paris, 93200 Saint-Denis</div>
          <div className="mb-2">Téléphone : 01 23 45 67 89</div>
          <div className="mb-2">SIRET : 123 456 789 00012</div>
          <div className="mb-2">Contact : dupont@boulangerie.fr</div>
        </CardContent>
      </Card>
    </div>
  )
}

// TODO: remplacer par les vraies infos du partenaire connecté (session/auth),
// au lieu de cette valeur figée. `id` doit être le partenaireId utilisé par
// GET /api/v1/partenaires/{partenaireId}/transactions.
const CURRENT_PARTNER = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "Boulangerie Dupont",
}

// Utilisées uniquement tant que l'API de transactions n'est pas branchée.
const MOCK_TRANSACTIONS = [
  { id: "1", date: "2026-09-01T10:12:00Z", produit: "Sandwich Jambon", client: "Marie L.", montant: 4.5 },
  { id: "2", date: "2026-09-02T08:03:00Z", produit: "Café", client: "Julien P.", montant: 1.2 },
  { id: "3", date: "2026-09-03T12:45:00Z", produit: "Sandwich Jambon", client: "Sofia R.", montant: 4.5 },
  { id: "4", date: "2026-09-04T09:20:00Z", produit: "Café", client: "Marie L.", montant: 1.2 },
]

function TransactionHistory({ partenaireId, companyName }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [usingMockData, setUsingMockData] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadTransactions() {
      setLoading(true)
      try {
        // NOTE: cet endpoint n'existe pas encore dans route.ts (qui ne gère
        // que PATCH/DELETE sur /api/v1/partenaires/{partenaireId}). Il faudra
        // ajouter un GET /api/v1/partenaires/{partenaireId}/transactions
        // côté API pour que cet appel fonctionne réellement.
        const res = await fetch(`/api/v1/partenaires/${partenaireId}/transactions`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setTransactions(data)
          setUsingMockData(false)
        }
      } catch {
        if (!cancelled) {
          setTransactions(MOCK_TRANSACTIONS)
          setUsingMockData(true)
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-2">Historique des transactions — {companyName}</h2>

      {usingMockData && (
        <div className="text-sm text-muted-foreground bg-muted rounded p-3">
          L'API de transactions n'est pas encore disponible : ces données sont des exemples.
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Chargement des transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="text-muted-foreground">Aucune transaction pour le moment.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Date</th>
                <th className="text-left px-4 py-2 font-semibold">Produit</th>
                <th className="text-left px-4 py-2 font-semibold">Client</th>
                <th className="text-right px-4 py-2 font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2">{new Date(t.date).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2">{t.produit}</td>
                  <td className="px-4 py-2">{t.client}</td>
                  <td className="px-4 py-2 text-right">{t.montant.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function QrCodeScanner() {
  const [open, setOpen] = useState(false)
  const [qrResult, setQrResult] = useState(null)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

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

  async function scanWithBarcodeDetector() {
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
          setQrResult(codes[0].rawValue)
          stopScanning()
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
    // Requires: npm install jsqr
    let jsQR
    try {
      const jsqrModule = await import("jsqr")
      jsQR = (jsqrModule as any).default ?? jsqrModule
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
        setQrResult(code.data)
        stopScanning()
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
    setQrResult(null)
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
  }, [open])

  function handleClose() {
    setQrResult(null)
    setError(null)
    setOpen(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-2">Scanner un QR Code</h2>
      <Button onClick={() => setOpen(true)}>Ouvrir le lecteur QR Code</Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scanner un QR Code</DialogTitle>
            <DialogDescription>Scannez le QR code d'un employé pour voir son contenu.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {error && <div className="text-sm text-destructive text-center">{error}</div>}
            {!qrResult && !error && (
              <video
                ref={videoRef}
                className="w-full aspect-square rounded-lg bg-black object-cover"
                muted
                playsInline
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
            {qrResult && (
              <div className="p-3 bg-muted rounded text-center w-full">
                <div className="font-semibold mb-1">QR Code détecté :</div>
                <div className="break-all text-sm">{qrResult}</div>
              </div>
            )}
          </div>
          <DialogFooter showCloseButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PartenairePage() {
  const [tab, setTab] = useState("products")
  return (
    <div className="flex min-h-screen">
      <PartnerSidebar activeTab={tab} onSelectTab={setTab} />
      <main className="flex-1 p-6">
        {tab === "products" && <ProductManager />}
        {tab === "info" && <PartnerInfo />}
        {tab === "history" && (
          <TransactionHistory partenaireId={CURRENT_PARTNER.id} companyName={CURRENT_PARTNER.name} />
        )}
        {tab === "scan" && <QrCodeScanner />}
      </main>
    </div>
  )
}
