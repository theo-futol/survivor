"use client"

import { useRouter } from "next/navigation"
import { LogOut, PanelLeftIcon } from "lucide-react"

import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSidebar } from "@/components/ui/sidebar"

export function SiteHeader() {
  const { toggleSidebar } = useSidebar()
  const router = useRouter()

  async function logout() {
    try {
      await apiFetch<{ ok: boolean }>("/api/v1/login", { method: "DELETE" })
    } finally {
      router.push("/login")
      router.refresh()
    }
  }

  return (
    <header className="sticky top-0 z-50 flex w-full items-center border-b bg-background">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Ouvrir ou fermer le menu"
        >
          <PanelLeftIcon aria-hidden="true" />
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            onClick={logout}
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <LogOut aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  )
}
