"use client"

import { BadgeCheck, Building2, CircleDollarSign, Hash, LogOut, Mail, MapPin, ShieldCheck, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"

import { AccountHeader } from "@/components/account-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { useCurrentUser } from "@/hooks/use-current-user"
import { apiFetch, formatMoney } from "@/lib/api-client"
import Link from "next/link"

export default function ProfilePage() {
  const router = useRouter()
  const { data, loading, error } = useCurrentUser()
  const user = data?.user
  const company = data?.company

  async function logout() {
    try {
      await apiFetch<{ ok: boolean }>("/api/v1/login", { method: "DELETE" })
    } finally {
      router.push("/login")
      router.refresh()
    }
  }

  const typeLabel =
    user?.role === "EMPLOYEE" ? "Compte salarié" :
    user?.role === "COMPANY" ? "Compte entreprise" :
    user?.role === "PARTNER" ? "Compte partenaire" :
    user?.role === "ADMIN" ? "Compte administrateur" : "Compte"

  const fullName = user ? `${user.name} ${user.surname}`.trim() : ""

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />
      <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Mon compte</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Profil</h1>

        {loading ? (
          <div className="mt-8 rounded-3xl border bg-card p-8">Chargement du profil depuis la base…</div>
        ) : error ? (
          <p role="alert" className="mt-8 rounded-3xl bg-brand-red-soft p-6 font-semibold text-brand-red-dark">{error}</p>
        ) : user ? (
          <section className="mt-8 overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="bg-primary p-7 text-primary-foreground sm:p-8">
              <div className="flex flex-wrap items-center gap-5">
                <div className="grid size-16 place-items-center rounded-full bg-background text-primary"><UserRound className="size-8" aria-hidden="true" /></div>
                <div>
                  <p className="text-sm font-semibold text-primary-foreground/80">{typeLabel}</p>
                  <h2 className="text-2xl font-black">{fullName}</h2>
                  {company && <p className="mt-1 text-primary-foreground/85">{company.name}</p>}
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-7 sm:grid-cols-2 sm:p-8">
              <ProfileField icon={<Mail />} label="Email" value={user.email} />
              <ProfileField icon={<ShieldCheck />} label="Rôle API" value={user.role} />
              {user.role === "EMPLOYEE" && <ProfileField icon={<CircleDollarSign />} label="Solde disponible" value={formatMoney(user.balance)} />}
              {company && <ProfileField icon={<Building2 />} label="Organisation" value={company.name} />}
              {company && <ProfileField icon={<Hash />} label="SIRET de l'entreprise" value={company.siret} />}
              {company && <ProfileField icon={<MapPin />} label="Adresse" value={`${company.address}, ${company.postalCode}`} />}
              {company?.category && <ProfileField icon={<Building2 />} label="Catégorie" value={company.category.category} />}
              {company && <ProfileField icon={<BadgeCheck />} label="Validation" value={company.verified ? "Entreprise vérifiée" : "Vérification en attente"} />}
            </div>

            {user.role === "COMPANY" && (
              <div className="mx-7 mb-1 rounded-2xl bg-secondary p-5 text-sm sm:mx-8">
                <p className="font-black">Gestion employeur</p>
                <p className="mt-1 text-muted-foreground">Consultez et gérez les salariés rattachés à votre entreprise.</p>
                <Link href="/employer" className={buttonVariants({ className: "mt-4" })}>
                  <Building2 aria-hidden="true" /> Ouvrir l&apos;espace employeur
                </Link>
              </div>
            )}

            {user.role === "ADMIN" && (
              <div className="mx-7 mb-1 rounded-2xl bg-secondary p-5 text-sm sm:mx-8">
                <p className="font-black">Administration</p>
                <p className="mt-1 text-muted-foreground">Les salariés, employeurs et partenaires affichés dans l&apos;administration proviennent maintenant de PostgreSQL.</p>
                <Link href="/admin" className={buttonVariants({ className: "mt-4" })}>
                  <ShieldCheck aria-hidden="true" /> Ouvrir l&apos;administration
                </Link>
              </div>
            )}

            <div className="border-t p-7 sm:p-8">
              <Button variant="outline" onClick={logout}><LogOut aria-hidden="true" /> Se déconnecter</Button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

function ProfileField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary p-5">
      <div className="flex items-center gap-2 text-primary"><span className="[&>svg]:size-4" aria-hidden="true">{icon}</span><p className="text-sm font-bold">{label}</p></div>
      <p className="mt-2 break-words font-semibold">{value}</p>
    </div>
  )
}
