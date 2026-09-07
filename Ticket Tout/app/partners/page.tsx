"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Heart, LoaderCircle, MapPin, QrCode, Search, X } from "lucide-react"

import { AccountHeader } from "@/components/account-header"
import CreditCard from "@/components/credit-card"
import { Map } from "@/components/map"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useCurrentUser } from "@/hooks/use-current-user"
import { apiFetch, formatMoney, parsePoint, type ApiPartner, type PaginationMeta } from "@/lib/api-client"

type PartnerResponse = { data: ApiPartner[]; meta: PaginationMeta }
type FavoriteResponse = { favorites: Array<{ partnerId: string; name: string; likeAmount: number }> }
type QrResponse = { qrcode: string; expiresAt: string }

type PaymentState = {
  partner: ApiPartner
  qrcode: string | null
  expiresAt: string | null
  loading: boolean
  error: string | null
}

export default function PartnersPage() {
  const { data: session, loading: sessionLoading, error: sessionError } = useCurrentUser()
  const [partners, setPartners] = useState<ApiPartner[]>([])
  const [favoritePartnerIds, setFavoritePartnerIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [selected, setSelected] = useState<ApiPartner | undefined>()
  const [payment, setPayment] = useState<PaymentState | null>(null)
  const lastQrTriggerRef = useRef<HTMLButtonElement | null>(null)

  const employee = session?.user
  const employeeName = employee ? `${employee.name} ${employee.surname}`.trim() : ""

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.allSettled([
      apiFetch<PartnerResponse>("/api/v1/partenaires?limit=100"),
      apiFetch<FavoriteResponse>("/api/v1/ministerfavorite"),
    ])
      .then(([partnerResult, favoriteResult]) => {
        if (cancelled) return

        if (partnerResult.status === "fulfilled") {
          setPartners(partnerResult.value.data ?? [])
        } else {
          setLoadError(partnerResult.reason instanceof Error ? partnerResult.reason.message : "Impossible de charger les partenaires.")
        }

        if (favoriteResult.status === "fulfilled") {
          setFavoritePartnerIds(new Set((favoriteResult.value.favorites ?? []).map((favorite) => favorite.partnerId)))
        } else if (partnerResult.status === "fulfilled") {
          setLoadError(favoriteResult.reason instanceof Error ? favoriteResult.reason.message : "Impossible de charger les coups de cœur.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(partners.map((partner) => partner.category?.category).filter(Boolean) as string[])).sort(),
    [partners]
  )

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr")
    return partners.filter((partner) => {
      const partnerCategory = partner.category?.category ?? ""
      const matchesCategory = category === "all" || partnerCategory === category
      const matchesFavorite = !favoritesOnly || favoritePartnerIds.has(partner.id)
      const haystack = `${partner.name} ${partnerCategory} ${partner.address} ${partner.postalCode}`.toLocaleLowerCase("fr")
      return matchesCategory && matchesFavorite && (!normalized || haystack.includes(normalized))
    })
  }, [category, favoritePartnerIds, favoritesOnly, partners, query])

  const mapPartners = useMemo(
    () => visible.flatMap((partner) => {
      const coordinates = parsePoint(partner.location)
      return coordinates ? [{ id: partner.id, name: partner.name, address: `${partner.address}, ${partner.postalCode}`, coordinates }] : []
    }),
    [visible]
  )

  const selectedMapPartner = useMemo(() => {
    if (!selected) return undefined
    const coordinates = parsePoint(selected.location)
    return coordinates ? { id: selected.id, name: selected.name, address: `${selected.address}, ${selected.postalCode}`, coordinates } : undefined
  }, [selected])

  async function openPaymentDialog(partner: ApiPartner, trigger: HTMLButtonElement) {
    if (!employee) return
    lastQrTriggerRef.current = trigger
    setPayment({ partner, qrcode: null, expiresAt: null, loading: true, error: null })

    try {
      const result = await apiFetch<QrResponse>("/api/v1/qrcode", {
        method: "POST",
        body: JSON.stringify({ companyId: partner.id, userId: employee.id }),
      })
      setPayment({ partner, qrcode: result.qrcode, expiresAt: result.expiresAt, loading: false, error: null })
    } catch (caught) {
      setPayment({
        partner,
        qrcode: null,
        expiresAt: null,
        loading: false,
        error: caught instanceof Error ? caught.message : "Impossible de générer le QR.",
      })
    }
  }

  function handleDialogOpenChange(open: boolean) {
    if (open) return
    setPayment(null)
    window.requestAnimationFrame(() => lastQrTriggerRef.current?.focus())
  }

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />
      <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Où dépenser ?</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Trouvez votre prochain partenaire</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Le réseau affiché provient directement des entreprises partenaires actives en base.</p>
          </div>
          <div className="rounded-2xl bg-secondary px-5 py-4 sm:text-right">
            <p className="text-sm font-semibold text-primary">Votre budget disponible</p>
            <p className="text-xl font-black sm:text-2xl">{employee ? `${formatMoney(employee.balance)} à dépenser !` : "—"}</p>
          </div>
        </div>

        {(sessionError || loadError) && (
          <p role="alert" className="mt-6 rounded-2xl bg-brand-red-soft p-4 text-sm font-semibold text-brand-red-dark">{sessionError ?? loadError}</p>
        )}

        <section className="mt-7 grid gap-3 rounded-3xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_240px_auto] sm:p-5" aria-label="Filtres partenaires">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Rechercher un partenaire</span>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Nom, adresse, code postal, activité…" />
          </label>
          <label>
            <span className="sr-only">Filtrer par catégorie</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="all">Toutes les catégories</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <Button
            type="button"
            variant={favoritesOnly ? "default" : "outline"}
            onClick={() => setFavoritesOnly((value) => !value)}
            aria-pressed={favoritesOnly}
            className="h-9"
          >
            <Heart className={favoritesOnly ? "fill-current" : undefined} aria-hidden="true" /> Coups de cœur
          </Button>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(390px,.95fr)]">
          <Map className="min-h-[420px] xl:sticky xl:top-24 xl:self-start" partners={mapPartners} partnersSelected={selectedMapPartner} />

          <section className="min-w-0" aria-labelledby="partner-list-title">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="partner-list-title" className="text-xl font-black">{visible.length} partenaire{visible.length > 1 ? "s" : ""}</h2>
              {(query || category !== "all" || favoritesOnly) && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setCategory("all"); setFavoritesOnly(false) }}>Effacer les filtres</Button>}
            </div>

            {sessionLoading || loading ? (
              <div className="flex items-center justify-center gap-2 rounded-3xl border bg-card p-10 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement des partenaires…
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                {visible.map((partner) => {
                  const hasCoordinates = parsePoint(partner.location) !== null
                  return (
                    <article key={partner.id} className="rounded-3xl border bg-card p-5 shadow-sm" onMouseEnter={() => setSelected(partner)} onFocus={() => setSelected(partner)}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black">{partner.name}</h3>
                          <p className="text-sm font-semibold text-primary">{partner.category?.category ?? "Partenaire"}</p>
                        </div>
                        {favoritePartnerIds.has(partner.id) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-red-soft px-2.5 py-1 text-xs font-bold text-brand-red-dark">
                            <Heart className="size-3.5 fill-current" aria-hidden="true" /> Coup de cœur
                          </span>
                        )}
                      </div>
                      <p className="mt-3 flex items-start gap-2 text-sm">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>{partner.address}, {partner.postalCode}</span>
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Button variant="outline" onClick={() => setSelected(partner)} disabled={!hasCoordinates} title={hasCoordinates ? undefined : "Coordonnées géographiques indisponibles"}>
                          <MapPin aria-hidden="true" /> Localiser
                        </Button>
                        <Button onClick={(event) => void openPaymentDialog(partner, event.currentTarget)} disabled={!employee || payment?.loading === true}>
                          <QrCode aria-hidden="true" /> Générer le QR
                        </Button>
                      </div>
                    </article>
                  )
                })}
                {visible.length === 0 && (
                  <div className="rounded-3xl border border-dashed bg-card p-10 text-center text-muted-foreground md:col-span-2 xl:col-span-1">Aucun partenaire ne correspond à votre recherche.</div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog open={payment !== null} onOpenChange={handleDialogOpenChange}>
        {payment && (
          <DialogContent showCloseButton={false} className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-card p-4 shadow-2xl sm:max-w-2xl sm:p-6">
            <DialogClose render={<Button variant="outline" size="icon" className="absolute right-4 top-4 z-10" aria-label="Fermer le QR code de paiement" />}>
              <X aria-hidden="true" />
            </DialogClose>

            <div className="pr-12">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Paiement</p>
              <DialogTitle className="mt-1 text-2xl font-black leading-tight">Présentez ce QR chez {payment.partner.name}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Le code est généré côté serveur, stocké sous forme hachée et expire automatiquement après cinq minutes.
              </DialogDescription>
            </div>

            <div className="mt-2">
              <CreditCard name={employeeName} balance={employee?.balance ?? 0} mode="payment" merchantName={payment.partner.name} qrCode={payment.qrcode ?? undefined} expiresAt={payment.expiresAt ?? undefined} />
            </div>

            {payment.loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Génération en cours…</p>}
            {payment.error && (
              <p role="alert" className="rounded-xl bg-brand-red-soft px-4 py-3 text-sm font-semibold text-brand-red-dark">
                {payment.error === "A valid QR code already exists for this company"
                  ? "Un QR est déjà actif pour ce partenaire. Réessayez après son expiration (5 minutes)."
                  : payment.error}
              </p>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
