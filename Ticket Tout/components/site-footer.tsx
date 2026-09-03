import Link from "next/link"

import { BRAND } from "@/lib/brand"

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-brand-navy-deep text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div className="max-w-xl">
            <p className="text-lg font-black">{BRAND.name}</p>
            <p className="mt-2 text-sm leading-6 text-white/70">{BRAND.tagline}</p>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/60">
              Un service conçu pour faciliter l&apos;accès aux avantages salariés et soutenir les partenaires locaux.
            </p>
          </div>

          <nav aria-label="Liens légaux" className="md:justify-self-end">
            <p className="text-sm font-black uppercase tracking-[0.12em] text-white/80">Informations légales</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/mentions-legales" className="text-white/70 hover:text-white hover:underline">
                Mentions légales
              </Link>
              <Link href="/politique-confidentialite" className="text-white/70 hover:text-white hover:underline">
                Politique de confidentialité
              </Link>
              <Link href="/conditions-generales" className="text-white/70 hover:text-white hover:underline">
                Conditions générales d&apos;utilisation
              </Link>
            </div>
          </nav>
        </div>

        <div className="mt-9 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {BRAND.name} — Tous droits réservés.</p>
          <p>Version de démonstration — montants et transactions simulés.</p>
        </div>
      </div>
    </footer>
  )
}
