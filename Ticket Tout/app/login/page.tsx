import type { Metadata } from "next"
import Link from "next/link"
import { Building2, Handshake, ShieldCheck } from "lucide-react"

import { BetterAuthLoginForm } from "@/components/login-better-auth-form"
import { BrandLogo } from "@/components/brand-logo"
import { PublicHeader } from "@/components/public-header"
import { SiteFooter } from "@/components/site-footer"
import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = { title: "Connexion" }

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />
      <main id="contenu-principal" tabIndex={-1} className="mx-auto grid w-full max-w-6xl flex-1 items-stretch gap-6 px-4 py-8 sm:px-6 md:grid-cols-[.92fr_1.08fr] md:py-12 lg:px-8">
        <section className="flex flex-col justify-between overflow-hidden rounded-3xl bg-primary p-7 text-primary-foreground sm:p-9">
          <div>
            <BrandLogo inverse />
            <div className="mt-12 max-w-lg">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary-foreground/80">Espace sécurisé</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Votre espace est prêt.</h1>
              <p className="mt-4 text-primary-foreground/85">
                Salarié, entreprise ou partenaire : connectez-vous avec votre adresse email et votre mot de passe. Vous serez dirigé automatiquement vers l&apos;espace correspondant à votre compte.
              </p>
            </div>
          </div>
          <div className="mt-10 flex items-center gap-2 text-sm font-semibold text-primary-foreground/85">
            <ShieldCheck className="size-5" aria-hidden="true" />
            Les espaces privés ne sont jamais accessibles sans connexion.
          </div>
        </section>

        <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-9">
          <h2 className="text-2xl font-black">Connexion</h2>
          <p className="mt-2 text-muted-foreground">Utilisez les identifiants associés à votre compte.</p>
          <div className="mt-7">
            <BetterAuthLoginForm />
          </div>

          <div className="mt-9 border-t pt-7">
            <p className="font-black">Pas encore de compte professionnel ?</p>
            <p className="mt-1 text-sm text-muted-foreground">L&apos;inscription publique est réservée aux entreprises et aux partenaires.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link href="/signup?type=company" className={buttonVariants({ variant: "outline", className: "h-auto justify-start py-4" })}>
                <Building2 aria-hidden="true" />
                <span className="text-left">
                  <span className="block font-black">Entreprise</span>
                  <span className="block text-xs font-normal text-muted-foreground">Créditer les salariés</span>
                </span>
              </Link>
              <Link href="/signup?type=partner" className={buttonVariants({ variant: "outline", className: "h-auto justify-start py-4" })}>
                <Handshake aria-hidden="true" />
                <span className="text-left">
                  <span className="block font-black">Partenaire</span>
                  <span className="block text-xs font-normal text-muted-foreground">Simuler les paiements</span>
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
