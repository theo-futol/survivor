import Link from "next/link"
import { Building2, Handshake } from "lucide-react"

import { PublicHeader } from "@/components/public-header"
import { SiteFooter } from "@/components/site-footer"
import { SignupForm } from "@/components/signup-form"
import { buttonVariants } from "@/components/ui/button"

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const params = await searchParams
  const type = params.type === "partner" ? "partner" : "company"

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-red">Créer un compte professionnel</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Choisissez votre profil</h1>
          <p className="mt-3 text-muted-foreground">L&apos;inscription salarié n&apos;est pas publique : les accès salariés sont fournis par l&apos;entreprise.</p>
        </div>

        <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-2">
          <Link href="/signup?type=company" className={buttonVariants({ variant: type === "company" ? "default" : "outline", className: "h-auto py-4" })}>
            <Building2 aria-hidden="true" /> Entreprise
          </Link>
          <Link href="/signup?type=partner" className={buttonVariants({ variant: type === "partner" ? "default" : "outline", className: "h-auto py-4" })}>
            <Handshake aria-hidden="true" /> Partenaire
          </Link>
        </div>

        <section className="mt-7 rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
          <SignupForm accountType={type} />
        </section>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà un compte ? <Link href="/login" className="font-bold text-primary underline underline-offset-4">Retour à la connexion</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
