"use client"

import { FormEvent, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LoginResponse = {
  token: string
  expiresIn: number
  user: {
    id: string
    role: string
  }
}

type SalarieResponse = {
  id: string
  email: string
  surname: string
  name: string
  balance: number
  companyId: string | null
  role: "EMPLOYEE"
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null

  if (payload?.error === "Invalid credentials") {
    return "Email ou mot de passe incorrect."
  }

  return payload?.error ?? "Connexion impossible."
}

export function LoginApiSalarieForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")

    try {
      const loginResponse = await fetch("/api/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
      })

      if (!loginResponse.ok) {
        throw new Error(await readError(loginResponse))
      }

      const login = await loginResponse.json() as LoginResponse

      if (login.user.role !== "EMPLOYEE") {
        await fetch("/api/v1/login", { method: "DELETE", credentials: "same-origin" })
        throw new Error("Ce premier lot de connexion est réservé aux comptes salariés.")
      }

      const salarieResponse = await fetch(`/api/v1/salaries/${login.user.id}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      })

      if (!salarieResponse.ok) {
        await fetch("/api/v1/login", { method: "DELETE", credentials: "same-origin" })
        throw new Error(await readError(salarieResponse))
      }

      const salarie = await salarieResponse.json() as SalarieResponse

      if (salarie.id !== login.user.id || salarie.role !== "EMPLOYEE") {
        await fetch("/api/v1/login", { method: "DELETE", credentials: "same-origin" })
        throw new Error("Le compte connecté ne correspond pas à un salarié actif.")
      }

      const requestedNext = searchParams.get("next")
      const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
        ? requestedNext
        : "/"

      router.push(safeNext)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion impossible.")
      setLoading(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="login-email">Adresse email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          className="mt-2"
          required
          autoComplete="email"
          placeholder="vous@entreprise.fr"
        />
      </div>

      <div>
        <Label htmlFor="login-password">Mot de passe</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          className="mt-2"
          required
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-brand-red-soft px-4 py-3 text-sm font-semibold text-brand-red-dark">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        Se connecter à mon espace salarié
      </Button>
    </form>
  )
}
