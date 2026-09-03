"use client"

import { useEffect, useMemo, useState } from "react"
import { QrCode, ShieldCheck } from "lucide-react"
import { AccountHeader } from "@/components/account-header"
import CreditCard from "@/components/credit-card"
import { Button } from "@/components/ui/button"
import { Heart, MapPin, Sparkles, X } from "lucide-react"
import { PaymentQrCode } from "@/components/payment-qr-code"

type Partner = {
  id: string
  name: string
  category: string
  city: string
  address: string
  description: string
  ministerFavorite: boolean
  featured: boolean
  officialBadge?: boolean
  averageSpendingAmount: number
  image: string
}

export default function Page() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [paymentPartner, setPaymentPartner] = useState<Partner | null>(null)

  useEffect(() => {
    fetch("/data/partenaires.json")
      .then((response) => {
        if (!response.ok) throw new Error("Impossible de charger les partenaires")
        return response.json()
      })
      .then((data) => setPartners(data.partners ?? []))
      .catch((error) => console.error(error))
  }, [])

  const visiblePartners = useMemo(
    () => (favoritesOnly ? partners.filter((partner) => partner.ministerFavorite) : partners),
    [favoritesOnly, partners]
  )

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />

      <main className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] lg:px-8 lg:py-8">
        <section className="flex min-h-[calc(100svh-8rem)] flex-col justify-center rounded-3xl border bg-card p-6 shadow-sm sm:p-8 lg:p-10" aria-labelledby="wallet-title">
          <div className="mx-auto w-full max-w-[720px]">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Espace salarié</p>
                <h1 id="wallet-title" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  Ma carte Ticket Tout
                </h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  Utilisez votre solde chez les partenaires éligibles. La carte change d&apos;état au moment du paiement.
                </p>
              </div>
              {paymentPartner && (
                <Button variant="outline" onClick={() => setPaymentPartner(null)}>
                  <X aria-hidden="true" />
                  Annuler le paiement
                </Button>
              )}
            </div>

            <CreditCard
              name="Julie Marchand"
              logo="/logo.png"
              balance={238.6}
              mode={paymentPartner ? "payment" : "idle"}
              merchantName={paymentPartner?.name}
              paymentAmount={paymentPartner?.averageSpendingAmount}
            />

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  Votre solde disponible
                </p>

                <p className="mt-2 text-4xl font-bold text-[var(--brand-primary)] sm:text-5xl">
                  32,50 €
                </p>

                <p className="mt-2 text-base font-medium text-[var(--text-primary)] sm:text-lg">
                  à dépenser chez vos partenaires préférés !
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside className="min-w-0 rounded-3xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="offers-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-red">À découvrir</p>
              <h2 id="offers-title" className="mt-1 text-2xl font-black">Partenaires</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Des annonces volontairement plus compactes pour laisser la priorité à la carte.
              </p>
            </div>
            <Button
              variant={favoritesOnly ? "default" : "outline"}
              onClick={() => setFavoritesOnly((value) => !value)}
              aria-pressed={favoritesOnly}
            >
              <Heart aria-hidden="true" />
              Coups de cœur du ministre
            </Button>
          </div>

          <div className="mt-5 max-h-[calc(100svh-13rem)] space-y-4 overflow-y-auto pr-1">
            {visiblePartners.map((partner) => (
              <article key={partner.id} className="overflow-hidden rounded-2xl border bg-background">
                <div className="grid grid-cols-[112px_1fr] gap-0 sm:grid-cols-[132px_1fr]">
                  <img src={partner.image} alt="" className="h-full min-h-40 w-full object-cover" />
                  <div className="min-w-0 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-black leading-tight">{partner.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{partner.category}</p>
                      </div>
                      {partner.ministerFavorite && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-red px-2.5 py-1 text-xs font-bold text-white">
                          <Sparkles className="size-3.5" aria-hidden="true" />
                          Coup de cœur
                        </span>
                      )}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm">{partner.description}</p>
                    <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                      {partner.city}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Dépense moyenne </span>
                        <strong>{partner.averageSpendingAmount.toFixed(2)} €</strong>
                      </div>
                      <Button size="sm" onClick={() => setPaymentPartner(partner)}>
                        <PaymentQrCode />
                        Payer
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {visiblePartners.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                Aucun partenaire ne correspond à ce filtre.
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}
