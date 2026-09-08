import type { ReactNode } from "react"

import { PublicHeader } from "@/components/public-header"
import { SiteFooter } from "@/components/site-footer"

export function LegalShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />
      <main id="contenu-principal" tabIndex={-1} className="flex-1">
        <section className="border-b bg-gradient-to-b from-secondary/70 to-background">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-brand-red">{eyebrow}</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-black sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">{children}</div>
    </section>
  )
}
