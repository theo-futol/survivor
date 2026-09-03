"use client"

import { useEffect, useMemo, useState } from "react"
import { MapPin, QrCode, Search, X } from "lucide-react"

import { AccountHeader } from "@/components/account-header"
import CreditCard from "@/components/credit-card"
import { ReunionMap } from "@/components/reunion-map"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import payments from "@/data/paiements.json"

type Partner = {
  id: string
  name: string
  category: string
  city: string
  address: string
  coordinates: { latitude: number; longitude: number }
  description: string
  ministerFavorite: boolean
  featured: boolean
  averageSpendingAmount: number
  image: string
}

export default function PartnersPage() {
  const employee = payments.salaries[0]
  const [partners, setPartners] = useState<Partner[]>([])
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [selected, setSelected] = useState<Partner | undefined>()
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

  const categories = useMemo(
    () => Array.from(new Set(partners.map((partner) => partner.category))).sort(),
    [partners]
  )

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr")
    return partners.filter((partner) => {
      const matchesCategory = category === "all" || partner.category === category
      const haystack = `${partner.name} ${partner.category} ${partner.city} ${partner.address}`.toLocaleLowerCase("fr")
      return matchesCategory && (!normalized || haystack.includes(normalized))
    })
  }, [category, partners, query])

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Où dépenser ?</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Trouvez votre prochain partenaire</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Recherchez par nom, activité, ville ou adresse, puis localisez le partenaire sur la carte.</p>
          </div>
          <div className="rounded-2xl bg-secondary px-5 py-4 sm:text-right">
            <p className="text-sm font-semibold text-primary">Votre budget simulé disponible</p>
            <p className="text-xl font-black sm:text-2xl">{employee.soldeActuel.toFixed(2)} € simulé à dépenser !</p>
          </div>
        </div>

        <section className="mt-7 grid gap-3 rounded-3xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_260px] sm:p-5" aria-label="Filtres partenaires">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Rechercher un partenaire</span>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Nom, ville, adresse, activité…" />
          </label>
          <label>
            <span className="sr-only">Filtrer par catégorie</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="all">Toutes les catégories</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(390px,.95fr)]">
          <ReunionMap className="min-h-[420px] xl:sticky xl:top-24 xl:self-start" partners={visible} partnersSelected={selected} />

          <section className="min-w-0" aria-labelledby="partner-list-title">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="partner-list-title" className="text-xl font-black">{visible.length} partenaire{visible.length > 1 ? "s" : ""}</h2>
              {(query || category !== "all") && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setCategory("all") }}>Effacer les filtres</Button>}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              {visible.map((partner) => (
                <article key={partner.id} className="overflow-hidden rounded-3xl border bg-card shadow-sm" onMouseEnter={() => setSelected(partner)} onFocus={() => setSelected(partner)} tabIndex={0}>
                  <div className="grid sm:grid-cols-[150px_1fr]">
                    <img src={partner.image} alt="" className="h-44 w-full object-cover sm:h-full" />
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-black">{partner.name}</h3>
                          <p className="text-sm font-semibold text-primary">{partner.category}</p>
                        </div>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">≈ {partner.averageSpendingAmount.toFixed(2)} € simulé</span>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{partner.description}</p>
                      <p className="mt-3 flex items-start gap-2 text-sm">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>{partner.address}</span>
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Button variant="outline" onClick={() => setSelected(partner)}>
                          <MapPin aria-hidden="true" /> Localiser
                        </Button>
                        <Button onClick={() => setPaymentPartner(partner)}>
                          <QrCode aria-hidden="true" /> Générer le QR
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {visible.length === 0 && (
                <div className="rounded-3xl border border-dashed bg-card p-10 text-center text-muted-foreground md:col-span-2 xl:col-span-1">Aucun partenaire ne correspond à votre recherche.</div>
              )}
            </div>
          </section>
        </div>
      </main>

      {paymentPartner && (
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="QR code de paiement">
          <div className="relative w-full max-w-2xl rounded-3xl bg-card p-4 shadow-2xl sm:p-6">
            <Button variant="outline" size="icon" className="absolute right-4 top-4 z-10" onClick={() => setPaymentPartner(null)} aria-label="Fermer">
              <X aria-hidden="true" />
            </Button>
            <div className="pr-12">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Paiement</p>
              <h2 className="mt-1 text-2xl font-black">Présentez ce QR chez {paymentPartner.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Le QR affiché est un vrai QR code scannable, utilisé ici avec une donnée statique de démonstration.</p>
            </div>
            <div className="mt-6">
              <CreditCard name={employee.nom} balance={employee.soldeActuel} mode="payment" merchantName={paymentPartner.name} paymentAmount={paymentPartner.averageSpendingAmount} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
