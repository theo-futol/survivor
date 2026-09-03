"use client"

import Link from "next/link"
import { History, Home, LogOut, MapPinned, Menu, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"
import { BRAND } from "@/lib/brand"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const employeeLinks = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/transactions", label: "Transactions", icon: History },
  { href: "/partners", label: "Partenaires", icon: MapPinned },
  { href: "/profile", label: "Profil", icon: UserRound },
]
const professionalLinks = [{ href: "/profile", label: "Profil", icon: UserRound }]

export function AccountHeader() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const employeeAccess = (session?.user as { employeeAccess?: boolean } | undefined)?.employeeAccess === true
  const links = employeeAccess ? employeeLinks : professionalLinks

  async function logout() {
    await authClient.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={employeeAccess ? "/" : "/profile"} className="flex items-center gap-3" aria-label={`Accueil ${BRAND.name}`}>
          <BrandLogo />
        </Link>
        <span className="rounded-full bg-brand-red-soft px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-brand-red">
          Simulation
        </span>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-3">
          {session?.user?.name && <span className="hidden max-w-40 truncate text-sm font-semibold text-muted-foreground lg:inline">{session.user.name}</span>}
          <ThemeToggle />
          <Button variant="outline" size="icon" onClick={logout} className="hidden md:inline-flex" aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut aria-hidden="true" />
          </Button>

          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden" aria-label="Ouvrir le menu" />}>
              <Menu aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(88vw,360px)]">
              <SheetHeader><SheetTitle>{BRAND.name}</SheetTitle></SheetHeader>
              <nav className="grid gap-2 px-4" aria-label="Navigation mobile">
                {links.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-secondary">
                      <Icon className="size-5 text-primary" aria-hidden="true" /> {item.label}
                    </Link>
                  )
                })}
              </nav>
              <div className="mt-auto border-t p-4">
                <Button variant="outline" className="w-full" onClick={logout}><LogOut aria-hidden="true" /> Se déconnecter</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
