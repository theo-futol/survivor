"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Heart, History, MapPin, QrCode, Sparkles, X } from "lucide-react"

import { AccountHeader } from "@/components/account-header"
import CreditCard from "@/components/credit-card"
import { Button, buttonVariants } from "@/components/ui/button"
import payments from "@/data/paiements.json"

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
  const employee = payments.salaries[0]
  const [partners, setPartners] = useState<Partner[]>([])
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [paymentPartner, setPaymentPartner] = useState<Partner | null>(null)
  const qrTriggerRef = useRef<HTMLButtonElement | null>(null)
  const closeQrButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    fetch("/data/partenaires.json")
      .then((response) => {
        if (!response.ok) throw new Error("Impossible de charger les partenaires")
        return response.json()
      })
      .then((data) => setPartners(data.partners ?? []))
      .catch((error) => console.error(error))
  }, [])

  useEffect(() => {
    if (!paymentPartner) return

    window.requestAnimationFrame(() => {
      closeQrButtonRef.current?.focus()
    })
  }, [paymentPartner])

  function closePaymentQr() {
    setPaymentPartner(null)
    window.requestAnimationFrame(() => {
      qrTriggerRef.current?.focus()
    })
  }

  const visiblePartners = useMemo(
    () => (favoritesOnly ? partners.filter((partner) => partner.ministerFavorite) : partners),
    [favoritesOnly, partners]
  )

  const consumed = employee.transactionsUtilisation
    .filter((transaction) => transaction.statut === "validée")
    .reduce((sum, transaction) => sum + transaction.montant, 0)

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />

      <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.22fr)_minmax(340px,.78fr)]">
          <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-8 lg:p-10">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Espace salarié</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Bonjour {employee.nom.split(" ")[0]} 👋</h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  SIMULATION — Votre solde simulé est disponible pour découvrir le fonctionnement de l’application.
                </p>
              </div>
              {paymentPartner && (
                <Button ref={closeQrButtonRef} variant="outline" onClick={closePaymentQr}>
                  <X aria-hidden="true" /> Fermer le QR
                </Button>
              )}
            </div>

            <CreditCard
              name={employee.nom}
              balance={employee.soldeActuel}
              mode={paymentPartner ? "payment" : "idle"}
              merchantName={paymentPartner?.name}
              paymentAmount={paymentPartner?.averageSpendingAmount}
            />

            <div className="mt-8 rounded-3xl bg-secondary p-5 sm:p-6">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">Votre budget plaisir</p>
              <p className="mt-2 text-2xl font-black sm:text-3xl">
                {employee.soldeActuel.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} à dépenser chez vos partenaires préférés — SIMULATION!
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Pas de formulation négative : votre solde est un avantage disponible, pas un compte à rebours.</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-sm font-semibold text-primary">Crédité simulé au total </p>
                <p className="mt-1 text-2xl font-black">{employee.totalRecu.toFixed(2)} €</p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-sm font-semibold text-primary">Dépenses simulées </p>
                <p className="mt-1 text-2xl font-black">{consumed.toFixed(2)} €</p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-sm font-semibold text-primary">Transactions simulées</p>
                <p className="mt-1 text-2xl font-black">{employee.transactionsUtilisation.length}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link href="/transactions" className={buttonVariants({ className: "h-11" })}>
                <History aria-hidden="true" /> Voir tout l&apos;historique simulé
              </Link>
              <Link href="/partners" className={buttonVariants({ variant: "outline", className: "h-11" })}>
                <MapPin aria-hidden="true" /> Trouver un partenaire
              </Link>
            </div>
          </div>

          <aside className="min-w-0 rounded-3xl border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="offers-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-red">À découvrir</p>
                <h2 id="offers-title" className="mt-1 text-2xl font-black">Partenaires</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choisissez un partenaire et générez votre QR.</p>
              </div>
              <Button variant={favoritesOnly ? "default" : "outline"} size="sm" onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly}>
                <Heart aria-hidden="true" /> Coup de coeur du Ministre
              </Button>
            </div>

            <div className="mt-5 max-h-[760px] space-y-4 overflow-y-auto pr-1">
              {visiblePartners.map((partner) => (
                <article key={partner.id} className="overflow-hidden rounded-2xl border bg-background">
                  <div className="grid grid-cols-[96px_1fr] sm:grid-cols-[120px_1fr]">
                    <img src={partner.image} alt="" className="h-full min-h-40 w-full object-cover" />
                    <div className="min-w-0 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-black leading-tight">{partner.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{partner.category}</p>
                        </div>
                        {partner.ministerFavorite && <Sparkles className="size-4 text-brand-red" aria-label="Coup de cœur" />}
                      </div>
                      <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-4 shrink-0" aria-hidden="true" /> {partner.city}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <strong className="text-sm">Dépense simulée type : {partner.averageSpendingAmount.toFixed(2)} €</strong>
                        <Button
                          size="sm"
                          onClick={(event) => {
                            qrTriggerRef.current = event.currentTarget
                            setPaymentPartner(partner)
                          }}
                        >
                          <QrCode aria-hidden="true" /> QR
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <Link href="/partners" className={buttonVariants({ variant: "outline", className: "mt-5 w-full" })}>
              Rechercher et localiser tous les partenaires <ArrowRight aria-hidden="true" />
            </Link>
          </aside>
        </section>
      </main>
    </div>
  );
}