import { BRAND } from "@/lib/brand"

export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p className="font-semibold text-foreground">{BRAND.name}</p>
        <p>{BRAND.tagline}</p>
      </div>
    </footer>
  )
}
