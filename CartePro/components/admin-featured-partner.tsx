"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { ImagePlus, LoaderCircle, MousePointerClick, RefreshCcw, Send, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { apiFetch, type ApiPartner, type PaginationMeta } from "@/lib/api-client"

type FeaturedPartner = {
  id: number
  partnerId: string
  name: string
  address: string
  postalCode: string
  message: string
  imageUrl: string
  clickAmount: number
  active: boolean
  createdAt: string
  updatedAt: string
}

type PartnerResponse = { data: ApiPartner[]; meta: PaginationMeta }
type HistoryResponse = { featuredPartners: FeaturedPartner[] }

export function AdminFeaturedPartner() {
  const [partners, setPartners] = useState<ApiPartner[]>([])
  const [history, setHistory] = useState<FeaturedPartner[]>([])
  const [partnerId, setPartnerId] = useState("")
  const [message, setMessage] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedPartner = useMemo(() => partners.find((partner) => partner.id === partnerId), [partners, partnerId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [partnerResponse, historyResponse] = await Promise.all([
        apiFetch<PartnerResponse>("/api/v1/partenaires?limit=100"),
        apiFetch<HistoryResponse>("/api/v1/featuredpartner?history=true"),
      ])
      setPartners(partnerResponse.data ?? [])
      setHistory(historyResponse.featuredPartners ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les partenaires mis en avant.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!image) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const form = new FormData()
      form.set("partnerId", partnerId)
      form.set("message", message)
      form.set("image", image)

      await apiFetch("/api/v1/featuredpartner", { method: "POST", body: form })
      setSuccess(`${selectedPartner?.name ?? "Le partenaire"} est maintenant mis en avant.`)
      setPartnerId("")
      setMessage("")
      setImage(null)
      const input = document.getElementById("featured-partner-image") as HTMLInputElement | null
      if (input) input.value = ""
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de publier le partenaire mis en avant.")
    } finally {
      setSaving(false)
    }
  }

  async function republish(entry: FeaturedPartner) {
    setError(null)
    setSuccess(null)
    try {
      await apiFetch(`/api/v1/featuredpartner/${entry.id}`, { method: "PATCH" })
      setSuccess(`${entry.name} est de nouveau mis en avant.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de republier cet encart.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Publication directe</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">Partenaire mis en avant</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Choisissez un partenaire, écrivez votre message, ajoutez une photo puis publiez immédiatement. Cet encart est public et indépendant des coups de cœur.
        </p>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-brand-red-soft p-4 text-sm font-semibold text-brand-red-dark">{error}</p>}
      {success && <p role="status" className="rounded-2xl bg-secondary p-4 text-sm font-semibold text-primary">{success}</p>}

      <form onSubmit={publish} className="grid gap-5 rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
        <div>
          <label htmlFor="featured-partner" className="mb-2 block text-sm font-black">Partenaire</label>
          <select
            id="featured-partner"
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
            required
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Choisir un partenaire</option>
            {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
          </select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="featured-partner-message" className="text-sm font-black">Message</label>
            <span className="text-xs text-muted-foreground">{message.length}/280</span>
          </div>
          <textarea
            id="featured-partner-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            maxLength={280}
            rows={4}
            placeholder="Deux lignes pour présenter ce partenaire…"
            className="w-full resize-y rounded-xl border bg-background px-3 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="featured-partner-image" className="mb-2 block text-sm font-black">Photo</label>
          <label htmlFor="featured-partner-image" className="flex min-h-28 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed bg-background p-4 text-center text-sm font-semibold hover:bg-secondary/60">
            <ImagePlus className="size-5 text-primary" aria-hidden="true" />
            {image ? image.name : "Choisir une photo depuis le téléphone"}
          </label>
          <input
            id="featured-partner-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="sr-only"
            onChange={(event) => setImage(event.target.files?.[0] ?? null)}
          />
          <p className="mt-2 text-xs text-muted-foreground">JPEG, PNG ou WebP · 5 Mo maximum.</p>
        </div>

        <Button type="submit" className="h-12 sm:w-fit" disabled={saving || !partnerId || !message.trim() || !image}>
          {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          Publier maintenant
        </Button>
      </form>

      <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">Historique</p>
            <h3 className="mt-1 text-xl font-black">Anciens encarts</h3>
          </div>
          <p className="text-xs text-muted-foreground">Les clics sont conservés pour chaque publication.</p>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Chargement…</p>
        ) : history.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Aucun partenaire mis en avant pour le moment.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {history.map((entry) => (
              <article key={entry.id} className="overflow-hidden rounded-2xl border bg-background">
                <img src={entry.imageUrl} alt="" className="h-40 w-full object-cover" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">{entry.address} · {entry.postalCode}</p>
                    </div>
                    {entry.active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-bold text-primary">
                        <Sparkles className="size-3" /> En ligne
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm">{entry.message}</p>
                  <p className="mt-3 flex items-center gap-2 text-sm font-bold">
                    <MousePointerClick className="size-4 text-primary" /> {entry.clickAmount} clic{entry.clickAmount > 1 ? "s" : ""}
                  </p>
                  {!entry.active && (
                    <Button type="button" variant="outline" size="sm" className="mt-4 w-full" onClick={() => void republish(entry)}>
                      <RefreshCcw aria-hidden="true" /> Remettre en avant
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
