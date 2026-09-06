"use client"

import { useEffect, useState } from "react"
import { ArrowRight, LoaderCircle, MapPin, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

type FeaturedPartner = {
  id: number
  partnerId: string
  name: string
  address: string
  postalCode: string
  message: string
  imageUrl: string
}

type ResponseShape = { featuredPartner: FeaturedPartner | null }

export function FeaturedPartnerBanner() {
  const [featuredPartner, setFeaturedPartner] = useState<FeaturedPartner | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/v1/featuredpartner", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<ResponseShape> : { featuredPartner: null })
      .then((data) => {
        if (!cancelled) setFeaturedPartner(data.featuredPartner)
      })
      .catch(() => {
        if (!cancelled) setFeaturedPartner(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div className="mb-6 rounded-3xl border bg-card p-5 text-sm text-muted-foreground"><LoaderCircle className="mr-2 inline size-4 animate-spin" /> Chargement du partenaire mis en avant…</div>
  }

  if (!featuredPartner) return null

  function openPartner() {
    void fetch(`/api/v1/featuredpartner/${featuredPartner?.id}/click`, { method: "POST", keepalive: true })
    const query = encodeURIComponent(`${featuredPartner?.name} ${featuredPartner?.address} ${featuredPartner?.postalCode}`)
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank", "noopener,noreferrer")
  }

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border bg-card shadow-sm" aria-labelledby="featured-partner-title">
      <div className="grid md:grid-cols-[minmax(260px,.85fr)_minmax(0,1.15fr)]">
        <img src={featuredPartner.imageUrl} alt="" className="h-64 w-full object-cover md:h-full md:min-h-72" />
        <div className="p-5 sm:p-7 lg:p-9">
          <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-primary">
            <Sparkles className="size-4" aria-hidden="true" /> Partenaire mis en avant
          </p>
          <h1 id="featured-partner-title" className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{featuredPartner.name}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7">{featuredPartner.message}</p>
          <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {featuredPartner.address} · {featuredPartner.postalCode}
          </p>
          <Button type="button" className="mt-5" onClick={openPartner}>
            Voir le partenaire <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  )
}
