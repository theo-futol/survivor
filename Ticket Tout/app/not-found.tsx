import Link from "next/link"

import { BRAND } from "@/lib/brand"
import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="grid min-h-svh place-items-center bg-background p-6 text-center">
      <div className="max-w-lg rounded-3xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">{BRAND.name}</p>
        <h1 className="mt-2 text-3xl font-black">Page introuvable</h1>
        <p className="mt-3 text-muted-foreground">Cette page n&apos;existe pas ou a été déplacée.</p>
        <Link href="/" className={buttonVariants({ className: "mt-6" })}>Retour à l&apos;accueil</Link>
      </div>
    </div>
  )
}
