"use client"

import { ShieldCheck } from "lucide-react"

import { BrandLogo } from "@/components/brand-logo"
import { QrCodeSvg } from "@/components/qr-code-svg"
import { BRAND } from "@/lib/brand"
import { formatMoney } from "@/lib/api-client"

interface CreditCardProps {
  name: string
  balance?: number
  mode?: "idle" | "payment"
  merchantName?: string
  qrCode?: string
  expiresAt?: string
}

export default function CreditCard({
  name,
  balance = 0,
  mode = "idle",
  merchantName,
  qrCode,
  expiresAt,
}: CreditCardProps) {
  const isPayment = mode === "payment"

  return (
    <div
      className="w-full max-w-[640px]"
      aria-live="polite"
    >
      <div
        className={`
          relative
          aspect-[1.586/1]
          w-full
          overflow-hidden
          rounded-[28px]
          border
          p-5
          text-white
          shadow-2xl
          sm:p-8
          ${
            isPayment
              ? `
                border-brand-purple-light/50
                bg-[linear-gradient(135deg,var(--brand-green-deep)_0%,var(--brand-green)_45%,var(--brand-purple-deep)_135%)]
              `
              : `
                border-brand-green-light/40
                bg-[linear-gradient(135deg,var(--brand-green-deep)_0%,var(--brand-green)_55%,var(--brand-purple-deep)_135%)]
              `
          }
        `}
      >
        {/* Décoration */}
        <div
          className="
            pointer-events-none
            absolute
            -right-16
            -top-24
            size-72
            rounded-full
            bg-white/10
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            -bottom-28
            -left-16
            size-72
            rounded-full
            bg-brand-purple-light/20
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            bottom-10
            right-20
            size-40
            rounded-full
            bg-brand-green-light/10
            blur-2xl
          "
        />

        <div className="relative flex h-full flex-col justify-between">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                {BRAND.name}
              </p>

              <p className="mt-2 text-sm text-white/85">
                {isPayment ? "QR de paiement" : "Carte salarié"}
              </p>
            </div>

            <BrandLogo inverse compact />
          </div>

          {/* MODE PAIEMENT */}
          {isPayment ? (
            <div className="grid grid-cols-[1fr_auto] items-end gap-4 sm:gap-6">
              <div className="min-w-0">
                <p className="truncate text-sm text-white/85">
                  {merchantName ?? "Partenaire sélectionné"}
                </p>

                <p className="mt-2 font-heading text-xl font-extrabold tracking-tight sm:text-2xl">
                  Présentez ce QR au partenaire
                </p>

                <div
                  className="
                    mt-3
                    inline-flex
                    items-center
                    gap-2
                    rounded-full
                    border
                    border-white/15
                    bg-white/15
                    px-3
                    py-2
                    text-xs
                    font-semibold
                    backdrop-blur-sm
                    sm:text-sm
                  "
                >
                  <ShieldCheck
                    className="size-4"
                    aria-hidden="true"
                  />

                  {expiresAt
                    ? `Valide jusqu'à ${new Intl.DateTimeFormat("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }).format(new Date(expiresAt))}`
                    : "QR dynamique sécurisé"}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-2 shadow-lg">
                {qrCode ? (
                  <QrCodeSvg
                    value={qrCode}
                    size={132}
                    className="size-24 sm:size-32"
                    title={`QR de paiement pour ${
                      merchantName ?? "le partenaire"
                    }`}
                  />
                ) : (
                  <div
                    className="
                      grid
                      size-24
                      place-items-center
                      text-center
                      text-xs
                      font-bold
                      text-foreground
                      sm:size-32
                    "
                  >
                    Génération du QR…
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* PUCE + NFC */}
              <div className="flex items-center justify-between">
                <div
                  className="
                    relative
                    h-10
                    w-14
                    overflow-hidden
                    rounded-lg
                    border
                    border-white/30
                    bg-[linear-gradient(135deg,var(--brand-purple-light),var(--brand-green-light))]
                    shadow-inner
                  "
                  aria-label="Puce de la carte"
                >
                  <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
                  <div className="absolute inset-x-0 top-1/2 h-px bg-white/30" />
                </div>

                <svg
                  viewBox="0 0 24 24"
                  className="size-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-label="Paiement sans contact"
                  role="img"
                >
                  <path d="M5 8.5c2.5 2 2.5 5 0 7" />
                  <path d="M9 5.5c4.5 3.5 4.5 9.5 0 13" />
                  <path d="M13 3c6 5 6 13 0 18" />
                </svg>
              </div>

              {/* INFOS */}
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                    Titulaire
                  </p>

                  <p className="mt-1 font-heading text-lg font-bold sm:text-2xl">
                    {name}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                    Solde disponible
                  </p>

                  <p className="mt-1 font-heading text-lg font-extrabold sm:text-2xl">
                    {formatMoney(balance)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}