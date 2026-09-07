"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Heart, History, LoaderCircle, MapPin, QrCode, X } from "lucide-react"

import { AccountHeader } from "@/components/account-header"
import { PublicHeader } from "@/components/public-header"
import { FeaturedPartnerBanner } from "@/components/featured-partner-banner"
import CreditCard from "@/components/credit-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { useCurrentUser } from "@/hooks/use-current-user"
import {
  apiFetch,
  formatMoney,
  roleHome,
  type ApiPartner,
  type ApiTransaction,
  type PaginationMeta,
} from "@/lib/api-client"

type PartnerListResponse = { data: ApiPartner[]; meta: PaginationMeta }
type TransactionResponse = { transactions: ApiTransaction[] }
type QrResponse = { qrcode: string; expiresAt: string }
type FavoriteResponse = { favorites: Array<{ partnerId: string; name: string; likeAmount: number }> }

type PaymentState = {
  partner: ApiPartner
  qrcode: string | null
  expiresAt: string | null
  error: string | null
  loading: boolean
}

export default function Page() {
  const { data: session, loading: sessionLoading } = useCurrentUser()
  const [partners, setPartners] = useState<ApiPartner[]>([])
  const [transactions, setTransactions] = useState<ApiTransaction[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favoritePartnerIds, setFavoritePartnerIds] = useState<Set<string>>(new Set())
  const [payment, setPayment] = useState<PaymentState | null>(null)
  const qrTriggerRef = useRef<HTMLButtonElement | null>(null)
  const closeQrButtonRef = useRef<HTMLButtonElement | null>(null)

  const employee = session?.user
  const employeeName = employee ? `${employee.name} ${employee.surname}`.trim() : ""

  useEffect(() => {
    if (!employee || employee.role !== "EMPLOYEE") return

    let cancelled = false
    setLoadingData(true)
    setLoadError(null)

    Promise.allSettled([
      apiFetch<TransactionResponse>(`/api/v1/salaries/${employee.id}/transactions`),
      apiFetch<PartnerListResponse>("/api/v1/partenaires?limit=100"),
      apiFetch<FavoriteResponse>("/api/v1/ministerfavorite"),
    ])
      .then(([transactionResult, partnerResult, favoriteResult]) => {
        if (cancelled) return

        if (transactionResult.status === "fulfilled") {
          setTransactions(transactionResult.value.transactions ?? [])
        } else {
          setLoadError(transactionResult.reason instanceof Error ? transactionResult.reason.message : "Impossible de charger les transactions.")
        }

        if (partnerResult.status === "fulfilled") {
          setPartners(partnerResult.value.data ?? [])
        } else if (transactionResult.status === "fulfilled") {
          setLoadError(partnerResult.reason instanceof Error ? partnerResult.reason.message : "Impossible de charger les partenaires.")
        }

        if (favoriteResult.status === "fulfilled") {
          setFavoritePartnerIds(new Set((favoriteResult.value.favorites ?? []).map((favorite) => favorite.partnerId)))
        } else if (transactionResult.status === "fulfilled" && partnerResult.status === "fulfilled") {
          setLoadError(favoriteResult.reason instanceof Error ? favoriteResult.reason.message : "Impossible de charger les coups de cœur.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false)
      })

    return () => {
      cancelled = true
    }
  }, [employee?.id, employee?.role])

  useEffect(() => {
    if (!payment) return
    window.requestAnimationFrame(() => closeQrButtonRef.current?.focus())
  }, [payment?.partner.id])

  const visiblePartners = useMemo(
    () => (favoritesOnly ? partners.filter((partner) => favoritePartnerIds.has(partner.id)) : partners),
    [favoritePartnerIds, favoritesOnly, partners]
  )

  const totals = useMemo(() => {
    const validated = transactions.filter((transaction) => transaction.status === "VALIDER")
    const credited = validated
      .filter((transaction) => transaction.type === "TOPUP")
      .reduce((sum, transaction) => sum + transaction.amount, 0)
    const spent = validated
      .filter((transaction) => transaction.type === "PAYMENT")
      .reduce((sum, transaction) => sum + transaction.amount, 0)
    const refunded = validated
      .filter((transaction) => transaction.type === "REFUND")
      .reduce((sum, transaction) => sum + transaction.amount, 0)

    return { credited, consumed: Math.max(0, spent - refunded) }
  }, [transactions])

  async function openPaymentQr(partner: ApiPartner, trigger: HTMLButtonElement) {
    if (!employee) return
    qrTriggerRef.current = trigger
    setPayment({ partner, qrcode: null, expiresAt: null, error: null, loading: true })

    try {
      const result = await apiFetch<QrResponse>("/api/v1/qrcode", {
        method: "POST",
        body: JSON.stringify({ companyId: partner.id, userId: employee.id }),
      })
      setPayment({ partner, qrcode: result.qrcode, expiresAt: result.expiresAt, error: null, loading: false })
    } catch (caught) {
      setPayment({
        partner,
        qrcode: null,
        expiresAt: null,
        error: caught instanceof Error ? caught.message : "Impossible de générer le QR.",
        loading: false,
      })
    }
  }

  function closePaymentQr() {
    setPayment(null)
    window.requestAnimationFrame(() => qrTriggerRef.current?.focus())
  }

  return (
    <div className="min-h-svh bg-background">
      {session ? <AccountHeader /> : <PublicHeader />}

      <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <FeaturedPartnerBanner />

        {loadError && session?.user.role === "EMPLOYEE" && (
          <p role="alert" className="mb-5 rounded-2xl bg-brand-red-soft p-4 text-sm font-semibold text-brand-red-dark">
            {loadError}
          </p>
        )}

        {sessionLoading ? (
          <div className="flex min-h-80 items-center justify-center gap-2 text-muted-foreground">
            <LoaderCircle className="animate-spin" aria-hidden="true" /> Chargement de votre espace…
          </div>
        ) : employee?.role === "EMPLOYEE" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.22fr)_minmax(340px,.78fr)]">
            <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-8 lg:p-10">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Espace salarié</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Bonjour {employee.name} 👋</h1>
                  <p className="mt-2 max-w-2xl text-muted-foreground">
                    Votre solde et vos opérations sont chargés directement depuis la base Ticket Tout.
                  </p>
                </div>
                {payment && (
                  <Button ref={closeQrButtonRef} variant="outline" onClick={closePaymentQr}>
                    <X aria-hidden="true" /> Fermer le QR
                  </Button>
                )}
              </div>

              <CreditCard
                name={employeeName}
                balance={employee.balance}
                mode={payment ? "payment" : "idle"}
                merchantName={payment?.partner.name}
                qrCode={payment?.qrcode ?? undefined}
                expiresAt={payment?.expiresAt ?? undefined}
              />

              {payment?.loading && (
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Génération du QR de paiement…
                </p>
              )}
              {payment?.error && (
                <p role="alert" className="mt-4 rounded-xl bg-brand-red-soft px-4 py-3 text-sm font-semibold text-brand-red-dark">
                  {payment.error === "A valid QR code already exists for this company"
                    ? "Un QR est déjà actif pour ce partenaire. Réessayez après son expiration (5 minutes)."
                    : payment.error}
                </p>
              )}

              <div className="mt-8 rounded-3xl bg-secondary p-5 sm:p-6">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">Votre budget plaisir</p>
                <p className="mt-2 text-2xl font-black sm:text-3xl">
                  {formatMoney(employee.balance)} à dépenser chez vos partenaires préférés !
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-sm font-semibold text-primary">Crédité au total</p>
                  <p className="mt-1 text-2xl font-black">{formatMoney(totals.credited)}</p>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-sm font-semibold text-primary">Dépenses nettes</p>
                  <p className="mt-1 text-2xl font-black">{formatMoney(totals.consumed)}</p>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-sm font-semibold text-primary">Transactions</p>
                  <p className="mt-1 text-2xl font-black">{transactions.length}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link href="/transactions" className={buttonVariants({ className: "h-11" })}>
                  <History aria-hidden="true" /> Voir tout l&apos;historique
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
                  <p className="mt-1 text-sm text-muted-foreground">Choisissez un partenaire et générez votre QR dynamique.</p>
                </div>
                <Button variant={favoritesOnly ? "default" : "outline"} size="sm" onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly}>
                  <Heart aria-hidden="true" /> Coups de cœur
                </Button>
              </div>

              <div className="mt-5 max-h-[760px] space-y-4 overflow-y-auto pr-1">
                {loadingData ? (
                  <p className="flex items-center gap-2 rounded-2xl border p-5 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement des partenaires…
                  </p>
                ) : visiblePartners.length === 0 ? (
                  <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Aucun partenaire disponible.</p>
                ) : (
                  visiblePartners.map((partner) => (
                    <article key={partner.id} className="rounded-2xl border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-black leading-tight">{partner.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{partner.category?.category ?? "Partenaire"}</p>
                        </div>
                        {favoritePartnerIds.has(partner.id) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-red-soft px-2.5 py-1 text-xs font-bold text-brand-red-dark">
                            <Heart className="size-3.5 fill-current" aria-hidden="true" /> Coup de cœur
                          </span>
                        )}
                      </div>
                      <p className="mt-3 flex items-start gap-1 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {partner.address} · {partner.postalCode}
                      </p>
                      <div className="mt-4 flex justify-end">
                        <Button size="sm" onClick={(event) => void openPaymentQr(partner, event.currentTarget)} disabled={payment?.loading === true}>
                          <QrCode aria-hidden="true" /> Générer le QR
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <Link href="/partners" className={buttonVariants({ variant: "outline", className: "mt-5 w-full" })}>
                Rechercher et localiser tous les partenaires <ArrowRight aria-hidden="true" />
              </Link>
            </aside>
          </section>
        ) : (
          <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Ticket Tout</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Découvrez le partenaire mis en avant cette semaine.</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Le partenaire mis en avant ci-dessus est public. L&apos;espace salarié, le solde et les transactions restent privés.
            </p>
            <Link
              href={session ? roleHome(session.user.role) : "/login"}
              className={buttonVariants({ className: "mt-5" })}
            >
              {session ? "Accéder à mon espace" : "Se connecter"} <ArrowRight aria-hidden="true" />
            </Link>
          </section>
        )}
      </main>
    </div>
  )
}
