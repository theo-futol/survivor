"use client"

import { FormEvent, useState } from "react"
import { LoaderCircle, PlayCircle } from "lucide-react"
import { useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"
import { BRAND } from "@/lib/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type SessionUser = {
  employeeAccess?: boolean
  adminAccess?: boolean
  partnerAccess?: boolean
}

export function BetterAuthLoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finishLogin(email: string, password: string) {
    const result = await authClient.signIn.email({ email, password, rememberMe: true })

    if (result.error) {
      const message = result.error.message ?? "Email ou mot de passe incorrect."
      throw new Error(message.toLowerCase().includes("user not found") ? "Compte introuvable. Vérifiez l’adresse email utilisée lors de l’inscription." : message)
    }

    const session = await authClient.getSession()
    const user = session.data?.user as { accountType?: string } | undefined

  if (user?.accountType === "employee") {
    router.push("/")
  } else if (user?.accountType === "admin") {
    router.push("/admin")
  } else if (user?.accountType === "partner") {
    router.push("/partner")
  } else {
    router.push("/")
  }
    router.refresh()
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const form = new FormData(event.currentTarget)

    try {
      await finishLogin(String(form.get("email") ?? ""), String(form.get("password") ?? ""))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion impossible.")
      setLoading(false)
    }
  }

  async function openEmpDemo() {
    setDemoLoading(true)
    setError(null)
    try {
      const seed = await fetch("/api/demo/employee", { method: "POST" })
      if (!seed.ok) throw new Error("Impossible de préparer le compte de démonstration.")
      await finishLogin(BRAND.demoEmployee.email, BRAND.demoEmployee.password)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La démonstration n'a pas pu être ouverte.")
      setDemoLoading(false)
    }
  }

  async function openAdminDemo() {
    setDemoLoading(true)
    setError(null)
    try {
      const seed = await fetch("/api/demo/admin", { method: "POST" })
      if (!seed.ok) throw new Error("Impossible de préparer le compte de démonstration.")
      await finishLogin(BRAND.demoAdmin.email, BRAND.demoAdmin.password)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La démonstration n'a pas pu être ouverte.")
      setDemoLoading(false)
    }
  }

  async function openPartnerDemo() {
    setDemoLoading(true)
    setError(null)
    try {
      const seed = await fetch("/api/demo/partner", { method: "POST" })
      if (!seed.ok) throw new Error("Impossible de préparer le compte de démonstration.")
      await finishLogin(BRAND.demoPartner.email, BRAND.demoPartner.password)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La démonstration n'a pas pu être ouverte.")
      setDemoLoading(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="login-email">Adresse email</Label>
        <Input id="login-email" name="email" type="email" className="mt-2" required autoComplete="email" placeholder="vous@entreprise.fr" />
      </div>
      <div>
        <Label htmlFor="login-password">Mot de passe</Label>
        <Input id="login-password" name="password" type="password" className="mt-2" required autoComplete="current-password" />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-brand-red-soft px-4 py-3 text-sm font-semibold text-brand-red-dark">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading || demoLoading}>
        {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        Se connecter à mon espace
      </Button>
      <div className="relative py-1 text-center text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <span className="relative z-10 bg-card px-3">ou</span>
        <span className="absolute left-0 right-0 top-1/2 border-t" aria-hidden="true" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={openEmpDemo} disabled={loading || demoLoading}>
        {demoLoading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <PlayCircle aria-hidden="true" />}
        Ouvrir la démo salarié
      </Button>
      <Button type="button" variant="outline" className="w-full" onClick={openAdminDemo} disabled={loading || demoLoading}>
        {demoLoading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <PlayCircle aria-hidden="true" />}
        Ouvrir la démo administrateur
      </Button>
      <Button type="button" variant="outline" className="w-full" onClick={openPartnerDemo} disabled={loading || demoLoading}>
        {demoLoading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <PlayCircle aria-hidden="true" />}
        Ouvrir la démo partenaire
      </Button>
    </form>
  )
}

export function BetterAuthLoginFormWithDemo() {
  return (
    <form className="space-y-5">
      <BetterAuthLoginForm />
    </form>
  )
}
