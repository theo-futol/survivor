"use client"

import Image from "next/image"
import { ShieldCheck } from "lucide-react"

import { BrandLogo } from "@/components/brand-logo"
import { BRAND } from "@/lib/brand"

interface CreditCardProps {
  name: string
  balance?: number
  mode?: "idle" | "payment"
  merchantName?: string
  paymentAmount?: number
}

export default function CreditCard({ name, balance = 150, mode = "idle", merchantName, paymentAmount }: CreditCardProps) {
  const isPayment = mode === "payment"

  return (
    <div className="w-full max-w-[640px]" aria-live="polite">
      <div
        className={`relative aspect-[1.586/1] w-full overflow-hidden rounded-[28px] border p-5 text-white shadow-2xl sm:p-8 ${
          isPayment
            ? "border-brand-red/70 bg-[linear-gradient(135deg,var(--brand-navy-deep)_0%,var(--primary)_55%,var(--brand-red)_135%)]"
            : "border-primary/30 bg-[linear-gradient(135deg,var(--primary)_0%,var(--brand-navy-deep)_70%,var(--brand-blue-bright)_130%)]"
        }`}
      >
        <div className="absolute -right-16 -top-24 size-72 rounded-full bg-white/7" />
        <div className="absolute -bottom-28 -left-16 size-72 rounded-full bg-brand-red/20" />

        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white">{BRAND.name}</p>
              <p className="mt-2 text-sm text-white/85">{isPayment ? "QR de paiement - SIMULATION" : "Carte salarié"}</p>
            </div>
            <BrandLogo inverse compact />
          </div>

          {isPayment ? (
            <div className="grid grid-cols-[1fr_auto] items-end gap-4 sm:gap-6">
              <div className="min-w-0">
                <p className="truncate text-sm text-white/85">{merchantName ?? "Partenaire sélectionné"}</p>
                <p className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">
                  {(paymentAmount ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-2 text-xs font-semibold sm:text-sm">
                  <ShieldCheck className="size-4" aria-hidden="true" /> QR scannable de démonstration
                </div>
              </div>
              <div className="rounded-2xl bg-white p-2 shadow-lg">
                <Image src="/payment-qr-demo.png" alt="QR code de paiement de démonstration" width={132} height={132} className="size-24 sm:size-32" priority />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="h-10 w-14 rounded-lg bg-[linear-gradient(135deg,var(--brand-gold),var(--brand-gold-dark))] shadow-inner" aria-label="Puce de la carte" />
                <svg viewBox="0 0 24 24" className="size-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-label="Paiement sans contact" role="img">
                  <path d="M5 8.5c2.5 2 2.5 5 0 7" /><path d="M9 5.5c4.5 3.5 4.5 9.5 0 13" /><path d="M13 3c6 5 6 13 0 18" />
                </svg>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">Titulaire</p><p className="mt-1 text-lg font-bold sm:text-2xl">{name}</p></div>
               </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
