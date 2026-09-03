"use client"

import { Building2, LogOut, Mail, MapPin, Phone, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"

import { AccountHeader } from "@/components/account-header"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  const user = session?.user as
    | {
        name: string
        email: string
        accountType?: "employee" | "company" | "partner"
        employeeAccess?: boolean
        organizationName?: string
        registrationNumber?: string
        phone?: string
        jobTitle?: string
        address?: string
        postalCode?: string
        city?: string
      }
    | undefined

  async function logout() {
    await authClient.signOut()
    router.push("/login")
    router.refresh()
  }

  const isEmployee = user?.employeeAccess === true
  const typeLabel = isEmployee ? "Compte salarié" : user?.accountType === "company" ? "Compte entreprise" : "Compte partenaire"

  return (
    <div className="min-h-svh bg-background">
      <AccountHeader />
      <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Mon compte</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Profil</h1>

        {isPending ? (
          <div className="mt-8 rounded-3xl border bg-card p-8">Chargement du profil…</div>
        ) : user ? (
          <section className="mt-8 overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="bg-primary p-7 text-primary-foreground sm:p-8">
              <div className="flex flex-wrap items-center gap-5">
                <div className="grid size-16 place-items-center rounded-full bg-background text-primary"><UserRound className="size-8" aria-hidden="true" /></div>
                <div>
                  <p className="text-sm font-semibold text-primary-foreground/80">{typeLabel}</p>
                  <h2 className="text-2xl font-black">{user.name}</h2>
                  {user.organizationName && <p className="mt-1 text-primary-foreground/85">{user.organizationName}</p>}
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-7 sm:grid-cols-2 sm:p-8">
              <ProfileField icon={<Mail />} label="Email" value={user.email} />
              <ProfileField icon={<Building2 />} label="Organisation" value={user.organizationName ?? "Non renseignée"} />
              <ProfileField icon={<Phone />} label="Téléphone" value={user.phone || "Non renseigné"} />
              <ProfileField icon={<UserRound />} label="Fonction" value={user.jobTitle || (isEmployee ? "Salarié" : "Non renseignée")} />
              {!isEmployee && <ProfileField icon={<Building2 />} label="SIRET" value={user.registrationNumber || "Non renseigné"} />}
              {!isEmployee && <ProfileField icon={<MapPin />} label="Adresse" value={[user.address, user.postalCode, user.city].filter(Boolean).join(", ") || "Non renseignée"} />}
            </div>

            {!isEmployee && (
              <div className="mx-7 mb-1 rounded-2xl bg-secondary p-5 text-sm sm:mx-8">
                <p className="font-black">Compte professionnel créé</p>
                <p className="mt-1 text-muted-foreground">Cet espace confirme l&apos;inscription. Les tableaux de bord entreprise et partenaire pourront être branchés sur ce même compte.</p>
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
