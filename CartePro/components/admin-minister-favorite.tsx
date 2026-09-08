"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Heart, LoaderCircle, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { apiFetch, type ApiPartner, type PaginationMeta } from "@/lib/api-client"

type MinisterFavorite = {
  partnerId: string
  name: string
  likeAmount: number
}

type PartnerResponse = { data: ApiPartner[]; meta: PaginationMeta }
type FavoriteResponse = { favorites: MinisterFavorite[] }

export function AdminMinisterFavorite() {
  const [partners, setPartners] = useState<ApiPartner[]>([])
  const [favorites, setFavorites] = useState<MinisterFavorite[]>([])
  const [partnerId, setPartnerId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availablePartners = useMemo(
    () => partners.filter((partner) => !favorites.some((favorite) => favorite.partnerId === partner.id)),
    [favorites, partners],
  )

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [partnerResponse, favoriteResponse] = await Promise.all([
        apiFetch<PartnerResponse>("/api/v1/partenaires?limit=100"),
        apiFetch<FavoriteResponse>("/api/v1/ministerfavorite"),
      ])
      setPartners(partnerResponse.data ?? [])
      setFavorites(favoriteResponse.favorites ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les coups de cœur.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function addFavorite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!partnerId) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch("/api/v1/ministerfavorite", {
        method: "POST",
        body: JSON.stringify({ partnerId }),
      })
      setPartnerId("")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d'ajouter ce coup de cœur.")
    } finally {
      setSaving(false)
    }
  }

  async function removeFavorite(favorite: MinisterFavorite) {
    setError(null)
    try {
      await apiFetch(`/api/v1/ministerfavorite/${favorite.partnerId}`, { method: "PATCH" })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de retirer ce coup de cœur.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-red">Sélection du ministre</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">Coups de cœur</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Gérez la liste des partenaires favoris du ministre. Cette liste est indépendante du partenaire actuellement mis en avant sur l'accueil.
        </p>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-brand-red-soft p-4 text-sm font-semibold text-brand-red-dark">{error}</p>}

      <form onSubmit={addFavorite} className="flex flex-col gap-3 rounded-3xl border bg-card p-5 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="favorite-partner" className="mb-2 block text-sm font-black">Ajouter un partenaire</label>
          <select
            id="favorite-partner"
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Choisir un partenaire</option>
            {availablePartners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
          </select>
        </div>
        <Button type="submit" disabled={saving || !partnerId}>
          {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          Ajouter
        </Button>
      </form>

      <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="mb-4 flex items-center gap-2">
          <Heart className="size-5 text-brand-red" aria-hidden="true" />
          <h3 className="text-lg font-black">Liste actuelle</h3>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Chargement…</p>
        ) : favorites.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Aucun coup de cœur enregistré.</p>
        ) : (
          <div className="space-y-3">
            {favorites.map((favorite) => (
              <article key={favorite.partnerId} className="flex flex-col gap-3 rounded-2xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black">{favorite.name}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void removeFavorite(favorite)}>
                  <X aria-hidden="true" /> Retirer
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
