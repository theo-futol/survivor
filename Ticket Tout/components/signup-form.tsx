"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { Building2, CheckCircle2, Handshake, LoaderCircle } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { BRAND } from "@/lib/brand"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AccountType = "company" | "partner"

export function SignupForm({ accountType }: { accountType: AccountType }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle")
  const [error, setError] = useState<string | null>(null)
  const isCompany = accountType === "company"

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setStatus("loading")

    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    const confirmation = String(form.get("confirmation") ?? "")
    const siret = String(form.get("registrationNumber") ?? "").replace(/\s/g, "")

    if (!/^\d{14}$/.test(siret)) {
      setError("Le SIRET doit contenir exactement 14 chiffres.")
      setStatus("idle")
      return
    }
    if (password !== confirmation) {
      setError("Les mots de passe ne correspondent pas.")
      setStatus("idle")
      return
    }

    const result = await authClient.signUp.email({
      name: String(form.get("legalRepresentative") ?? ""),
      email: String(form.get("email") ?? ""),
      password,
      accountType,
      organizationName: String(form.get("organizationName") ?? ""),
      registrationNumber: siret,
      phone: String(form.get("phone") ?? ""),
      legalRepresentative: String(form.get("legalRepresentative") ?? ""),
      jobTitle: String(form.get("jobTitle") ?? ""),
      address: String(form.get("address") ?? ""),
      postalCode: String(form.get("postalCode") ?? ""),
      city: String(form.get("city") ?? ""),
      partnerCategory: isCompany ? "" : String(form.get("partnerCategory") ?? ""),
    })

    if (result.error) {
      setError(result.error.message ?? "La création du compte a échoué.")
      setStatus("idle")
      return
    }

    setStatus("success")
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border bg-secondary p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-brand-success" aria-hidden="true" />
        <h3 className="mt-3 text-xl font-black">Compte créé</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre compte {isCompany ? "entreprise" : "partenaire"} {BRAND.name} est enregistré. Votre session est ouverte et votre espace est prêt.
        </p>
        <Link href="/profile" className={buttonVariants({ className: "mt-5" })}>Accéder à mon espace</Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
          {isCompany ? <Building2 aria-hidden="true" /> : <Handshake aria-hidden="true" />}
        </div>
        <div>
          <h2 className="text-xl font-black">{isCompany ? "Compte entreprise" : "Compte partenaire"}</h2>
          <p className="text-sm text-muted-foreground">
            {isCompany ? "Pour financer les avantages de vos salariés." : `Pour accepter ${BRAND.name} dans votre établissement.`}
          </p>
        </div>
      </div>

      <fieldset className="grid gap-5 rounded-2xl border p-5 sm:grid-cols-2">
        <legend className="px-2 text-sm font-black">Informations légales</legend>
        <div className="sm:col-span-2">
          <Label htmlFor={`${accountType}-organization`}>{isCompany ? "Raison sociale" : "Nom / raison sociale"}</Label>
          <Input id={`${accountType}-organization`} name="organizationName" className="mt-2" required autoComplete="organization" />
        </div>
        <div>
          <Label htmlFor={`${accountType}-registration`}>SIRET</Label>
          <Input id={`${accountType}-registration`} name="registrationNumber" className="mt-2" required inputMode="numeric" pattern="[0-9 ]{14,17}" placeholder="14 chiffres" />
        </div>
        {!isCompany && (
          <div>
            <Label htmlFor="partner-category">Catégorie d&apos;activité</Label>
            <select id="partner-category" name="partnerCategory" required className="mt-2 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Sélectionner</option>
              <option>Alimentation & gastronomie</option>
              <option>Loisirs & culture</option>
              <option>Sport & bien-être</option>
              <option>Mode & accessoires</option>
              <option>Services</option>
              <option>Autre</option>
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <Label htmlFor={`${accountType}-address`}>Adresse du siège / établissement</Label>
          <Input id={`${accountType}-address`} name="address" className="mt-2" required autoComplete="street-address" />
        </div>
        <div>
          <Label htmlFor={`${accountType}-postal`}>Code postal</Label>
          <Input id={`${accountType}-postal`} name="postalCode" className="mt-2" required inputMode="numeric" autoComplete="postal-code" />
        </div>
        <div>
          <Label htmlFor={`${accountType}-city`}>Ville</Label>
          <Input id={`${accountType}-city`} name="city" className="mt-2" required autoComplete="address-level2" />
        </div>
      </fieldset>

      <fieldset className="grid gap-5 rounded-2xl border p-5 sm:grid-cols-2">
        <legend className="px-2 text-sm font-black">Contact responsable</legend>
        <div>
          <Label htmlFor={`${accountType}-contact`}>Nom et prénom</Label>
          <Input id={`${accountType}-contact`} name="legalRepresentative" className="mt-2" required autoComplete="name" />
        </div>
        <div>
          <Label htmlFor={`${accountType}-job`}>Fonction</Label>
          <Input id={`${accountType}-job`} name="jobTitle" className="mt-2" required placeholder={isCompany ? "RH, dirigeant…" : "Gérant, responsable…"} />
        </div>
        <div>
          <Label htmlFor={`${accountType}-email`}>Email professionnel</Label>
          <Input id={`${accountType}-email`} name="email" type="email" className="mt-2" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor={`${accountType}-phone`}>Téléphone</Label>
          <Input id={`${accountType}-phone`} name="phone" type="tel" className="mt-2" required autoComplete="tel" />
        </div>
      </fieldset>

      <fieldset className="grid gap-5 rounded-2xl border p-5 sm:grid-cols-2">
        <legend className="px-2 text-sm font-black">Sécurité</legend>
        <div>
          <Label htmlFor={`${accountType}-password`}>Mot de passe</Label>
          <Input id={`${accountType}-password`} name="password" type="password" className="mt-2" minLength={8} required autoComplete="new-password" />
        </div>
        <div>
          <Label htmlFor={`${accountType}-confirmation`}>Confirmer le mot de passe</Label>
          <Input id={`${accountType}-confirmation`} name="confirmation" type="password" className="mt-2" minLength={8} required autoComplete="new-password" />
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-brand-red-soft px-4 py-3 text-sm font-semibold text-brand-red-dark">{error}</p>
      )}

      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <input type="checkbox" required className="mt-1 size-4 accent-primary" />
        <span>
            Je certifie être habilité à créer ce compte au nom de l&apos;organisation et j&apos;accepte les{" "}
            <Link href="/conditions-generales" target="_blank" className="font-bold text-primary underline underline-offset-4">
              conditions générales d&apos;utilisation
            </Link>{" "}
            ainsi que la{" "}
            <Link href="/politique-confidentialite" target="_blank" className="font-bold text-primary underline underline-offset-4">
              politique de confidentialité
            </Link>
            .
        </span>
      </label>

      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        Créer mon compte {isCompany ? "entreprise" : "partenaire"}
      </Button>
    </form>
  )
}
