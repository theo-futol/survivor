"use client"

import { BRAND } from "@/lib/brand"
import { Button } from "@/components/ui/button"

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background p-6 text-center">
      <div className="max-w-lg rounded-3xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-red">{BRAND.name}</p>
        <h1 className="mt-2 text-3xl font-black">Un imprévu est survenu.</h1>
        <p className="mt-3 text-muted-foreground">Vos données ne sont pas perdues. Vous pouvez relancer l&apos;affichage.</p>
        <Button className="mt-6" onClick={reset}>Réessayer</Button>
      </div>
    </div>
  )
}
