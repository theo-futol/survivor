import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"
import { BrandLogo } from "@/components/brand-logo"
import { BRAND } from "@/lib/brand"

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/login" className="flex items-center gap-3" aria-label={`Accueil ${BRAND.name}`}>
          <BrandLogo />
        </Link>
        <p className="hidden text-sm font-semibold text-muted-foreground sm:block">{BRAND.tagline}</p>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
