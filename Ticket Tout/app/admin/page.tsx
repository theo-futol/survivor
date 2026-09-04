"use client"

import { useState, useEffect } from "react"
import {
  Check,
  X,
  Mail,
  Phone,
  Shield,
  MapPin,
  Users,
  Building2,
  Clock,
  FileText,
  Download,
  ExternalLink,
  ChevronRight,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar-admin"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import paiementsData from "../../data/paiements.json"
import { authClient } from "@/lib/auth-client"

// Types for navigation selections
export type AdminTab = "employee" | "account" | "business"

export const iframeHeight = "800px"
export const description = "An administration page with dynamic tab navigation."

export default function Page() {
  const [activeTab, setActiveTab] = useState<AdminTab>("employee")

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar activeTab={activeTab} onSelectTab={setActiveTab} />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
              {activeTab === "employee" && <EmployeeView />}
              {activeTab === "account" && <AccountView />}
              {activeTab === "business" && <BusinessView />}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* UI-facing interfaces (unchanged — this is what the views render)    */
/* ------------------------------------------------------------------ */

export type RequestStatus = "pending" | "accepted" | "refused"

export interface Person {
  id: string
  name: string
  email?: string
  phone?: string
  role?: string
}

export interface EmployeeRequest {
  id: string
  employeeName: string
  employeeEmail: string
  businessName: string
  ceoName: string
  position: string
  requestedAt: string
  status: RequestStatus
}

export interface Business {
  id: string
  name: string
  siret: string
  kbisUrl: string
  address: string
  ceoName: string
  employees: Person[]
  pendingEmployeesCount: number
}

export interface AdminAccount extends Person {
  lastLogin: string
}

/* ------------------------------------------------------------------ */
/* Raw shape of paiements.json (only the fields this page consumes)    */
/* ------------------------------------------------------------------ */

interface RawSalarie {
  id: string
  nom: string
  entrepriseId: string
}

interface RawEntreprise {
  id: string
  raisonSociale: string
  siret: string
}

// A pending (or already-treated) employee registration request submitted by a
// business's CEO. "en attente" employees are not yet in `salaries` — they only
// exist here until an admin accepts or refuses the request.
interface RawDemandeInscription {
  id: string
  entrepriseId: string
  employeeName: string
  employeeEmail: string
  ceoName: string
  position: string
  requestedAt: string
  statut: "en attente" | "acceptée" | "refusée"
}

interface PaiementsFile {
  entreprises: RawEntreprise[]
  salaries: RawSalarie[]
  demandesInscription: RawDemandeInscription[]
}

const paiements = paiementsData as unknown as PaiementsFile

function mapStatut(statut: RawDemandeInscription["statut"]): RequestStatus {
  switch (statut) {
    case "en attente":
      return "pending"
    case "acceptée":
      return "accepted"
    case "refusée":
      return "refused"
  }
}

/* ------------------------------------------------------------------ */
/* Data service — now reads from paiements.json instead of mock data   */
/* ------------------------------------------------------------------ */

const dbService = {
  async getRequests(): Promise<EmployeeRequest[]> {
    // Built from paiements.json's demandesInscription — employees a chef
    // d'entreprise has submitted for registration but who aren't (yet) part
    // of "salaries".
    return paiements.demandesInscription.map((req): EmployeeRequest => {
      const ent = paiements.entreprises.find((e) => e.id === req.entrepriseId)
      return {
        id: req.id,
        employeeName: req.employeeName,
        employeeEmail: req.employeeEmail,
        businessName: ent?.raisonSociale ?? "",
        ceoName: req.ceoName,
        position: req.position,
        requestedAt: req.requestedAt,
        status: mapStatut(req.statut),
      }
    })
  },

  async getBusinesses(): Promise<Business[]> {
    // Built from paiements.json's entreprises + salaries + demandesInscription.
    // Fields paiements.json doesn't provide (kbisUrl, address, ceoName)
    // are left empty rather than invented.
    return paiements.entreprises.map(
      (ent): Business => ({
        id: ent.id,
        name: ent.raisonSociale,
        siret: ent.siret,
        kbisUrl: "",
        address: "",
        ceoName: "",
        employees: paiements.salaries
          .filter((sal) => sal.entrepriseId === ent.id)
          .map(
            (sal): Person => ({
              id: sal.id,
              name: sal.nom,
            })
          ),
        pendingEmployeesCount: paiements.demandesInscription.filter(
          (req) => req.entrepriseId === ent.id && req.statut === "en attente"
        ).length,
      })
    )
  },

  async getAdminAccount(): Promise<AdminAccount> {
    // The admin account isn't in paiements.json — it comes from the
    // logged-in session instead.
    const session = await authClient.getSession()
    const user = session.data?.user as
      | { id?: string; name?: string; email?: string; phone?: string; accountType?: string }
      | undefined

    if (!user) {
      return { id: "", name: "", email: "", phone: "", role: "", lastLogin: "" }
    }

    return {
      id: user.id ?? "",
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      role: user.accountType ?? "",
      // Better Auth's default session doesn't expose a last-login
      // timestamp — leaving this empty rather than inventing one.
      lastLogin: "",
    }
  },

  async updateRequestStatus(id: string, status: RequestStatus): Promise<boolean> {
    // No persistence layer yet — no-op until requests have a real source.
    return true
  },
}

/* ------------------------------------------------------------------ */
/* Employee tab — registration requests                                */
/* ------------------------------------------------------------------ */

function EmployeeView() {
  const [requests, setRequests] = useState<EmployeeRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dbService.getRequests().then((data) => {
      setRequests(data)
      setLoading(false)
    })
  }, [])

  const updateStatus = async (id: string, status: RequestStatus) => {
    await dbService.updateRequestStatus(id, status)
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  const pending = requests.filter((r) => r.status === "pending")
  const treated = requests.filter((r) => r.status !== "pending")

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Chargement...</div>

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Demandes d'inscription</h2>
        <p className="text-muted-foreground text-sm">
          Les chefs d'entreprise soumettent ici l'inscription de leurs employés. Validez ou refusez chaque demande.
        </p>
      </div>

      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <StatCard label="En attente" value={pending.length} />
        <StatCard label="Acceptées" value={requests.filter((r) => r.status === "accepted").length} />
        <StatCard label="Refusées" value={requests.filter((r) => r.status === "refused").length} />
      </div>

      <div className="rounded-xl border bg-muted/20">
        <div className="border-b px-4 py-3">
          <h3 className="font-medium">En attente ({pending.length})</h3>
        </div>
        {pending.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">Aucune demande en attente pour le moment.</p>
        ) : (
          <div className="divide-y">
            {pending.map((req) => (
              <div key={req.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(req.employeeName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium leading-tight">{req.employeeName}</p>
                    <p className="text-muted-foreground text-sm">{req.employeeEmail}</p>
                    <p className="text-muted-foreground text-sm">
                      {req.position} · {req.businessName} · demandé par {req.ceoName}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" /> Demandé le {formatDate(req.requestedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateStatus(req.id, "refused")}>
                    <X className="mr-1 h-4 w-4" /> Refuser
                  </Button>
                  <Button size="sm" onClick={() => updateStatus(req.id, "accepted")}>
                    <Check className="mr-1 h-4 w-4" /> Accepter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {treated.length > 0 && (
        <div className="rounded-xl border bg-muted/20">
          <div className="border-b px-4 py-3">
            <h3 className="font-medium">Historique</h3>
          </div>
          <div className="divide-y">
            {treated.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium leading-tight">{req.employeeName}</p>
                  <p className="text-muted-foreground text-sm">
                    {req.position} · {req.businessName}
                  </p>
                </div>
                <Badge variant={req.status === "accepted" ? "default" : "secondary"}>
                  {req.status === "accepted" ? "Acceptée" : "Refusée"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Account tab — administrator details                                 */
/* ------------------------------------------------------------------ */

function AccountView() {
  const [adminAccount, setAdminAccount] = useState<AdminAccount | null>(null)

  useEffect(() => {
    dbService.getAdminAccount().then(setAdminAccount)
  }, [])

  if (!adminAccount) return <div className="p-4 text-sm text-muted-foreground">Chargement...</div>

  const hasAnyData = adminAccount.name || adminAccount.email || adminAccount.phone || adminAccount.role

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h2 className="text-2xl font-bold tracking-tight">Compte administrateur</h2>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">
              {adminAccount.name ? initials(adminAccount.name) : "—"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold leading-tight">
              {adminAccount.name || "Aucun compte chargé"}
            </p>
            {adminAccount.role && (
              <Badge variant="secondary" className="mt-1">
                <Shield className="mr-1 h-3 w-3" />
                {adminAccount.role}
              </Badge>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        {hasAnyData ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {adminAccount.email && <InfoRow icon={Mail} label="Email" value={adminAccount.email} />}
            {adminAccount.phone && <InfoRow icon={Phone} label="Téléphone" value={adminAccount.phone} />}
            {adminAccount.lastLogin && (
              <InfoRow icon={Clock} label="Dernière connexion" value={adminAccount.lastLogin} />
            )}
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">Aucune donnée de compte disponible pour le moment.</p>
        )}
      </div>

      <div className="grid auto-rows-min gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-muted/50 p-4">
          <h3 className="mb-2 font-medium">Sécurité</h3>
          <p className="text-muted-foreground text-sm">
            Mot de passe, authentification à deux facteurs et sessions actives.
          </p>
          <Button size="sm" variant="outline" className="mt-3">
            Gérer la sécurité
          </Button>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <h3 className="mb-2 font-medium">Notifications</h3>
          <p className="text-muted-foreground text-sm">
            Choisissez comment vous êtes alerté des nouvelles demandes d'inscription.
          </p>
          <Button size="sm" variant="outline" className="mt-3">
            Gérer les notifications
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Business tab — directory of businesses                              */
/* ------------------------------------------------------------------ */

function BusinessView() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dbService.getBusinesses().then((data) => {
      setBusinesses(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Chargement...</div>

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Entreprises Partenaires</h2>
        <p className="text-muted-foreground text-sm">
          Cliquez sur une entreprise pour consulter son SIRET et télécharger son extrait KBIS.
        </p>
      </div>

      <div className="grid auto-rows-min gap-4 md:grid-cols-4">
        <StatCard label="Entreprises" value={businesses.length} />
        <StatCard
          label="Employés au total"
          value={businesses.reduce((sum, b) => sum + b.employees.length, 0)}
        />
        <StatCard
          label="Sans employé"
          value={businesses.filter((b) => b.employees.length === 0).length}
        />
        <StatCard
          label="Employés en attente"
          value={businesses.reduce((sum, b) => sum + b.pendingEmployeesCount, 0)}
        />
      </div>

      {businesses.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 p-8 text-center">
          <p className="text-muted-foreground text-sm">Aucune entreprise disponible pour le moment.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {businesses.map((biz) => (
            <div
              key={biz.id}
              onClick={() => setSelectedBusiness(biz)}
              className="group relative cursor-pointer rounded-xl border bg-muted/20 p-4 transition-colors hover:bg-muted/40 hover:border-primary/50"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="flex items-center gap-2 font-semibold group-hover:text-primary transition-colors">
                    <Building2 className="h-4 w-4" />
                    {biz.name}
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  {biz.address && (
                    <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                      <MapPin className="h-3.5 w-3.5" /> {biz.address}
                    </p>
                  )}
                  {biz.ceoName && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      Chef d'entreprise : {biz.ceoName}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    SIRET : {biz.siret}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="w-fit">
                    <Users className="mr-1 h-3 w-3" />
                    {biz.employees.length} employé{biz.employees.length > 1 ? "s" : ""}
                  </Badge>
                  {biz.pendingEmployeesCount > 0 && (
                    <Badge
                      variant="outline"
                      className="w-fit border-amber-500/50 text-amber-600 dark:text-amber-400"
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      {biz.pendingEmployeesCount} en attente
                    </Badge>
                  )}
                </div>
              </div>

              {biz.employees.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="flex flex-wrap gap-2">
                    {biz.employees.map((emp) => (
                      <span
                        key={emp.id}
                        className="bg-background rounded-full border px-3 py-1 text-xs"
                      >
                        {emp.name} {emp.role ? `(${emp.role})` : ""}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog for Partner Details (SIRET + KBIS Download) */}
      <Dialog open={!!selectedBusiness} onOpenChange={() => setSelectedBusiness(null)}>
        {selectedBusiness && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5" />
                {selectedBusiness.name}
              </DialogTitle>
              <DialogDescription>
                Informations légales et documents officiels.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Numéro SIRET :</span>
                  <span className="font-mono font-medium">{selectedBusiness.siret}</span>
                </div>
                {selectedBusiness.ceoName && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Dirigeant :</span>
                      <span className="font-medium">{selectedBusiness.ceoName}</span>
                    </div>
                  </>
                )}
                {selectedBusiness.address && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Adresse :</span>
                      <span className="font-medium text-right max-w-[200px] truncate">
                        {selectedBusiness.address}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Document Administratif
                </p>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">Extrait KBIS</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedBusiness.kbisUrl ? "Document PDF officiel" : "Aucun document disponible"}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" asChild={!!selectedBusiness.kbisUrl} variant="default" disabled={!selectedBusiness.kbisUrl}>
                    {selectedBusiness.kbisUrl ? (
                      <a href={selectedBusiness.kbisUrl} download target="_blank" rel="noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </a>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="aspect-video rounded-xl bg-muted/50 p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="text-muted-foreground h-4 w-4" />
      <div>
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="text-sm">{value}</dd>
      </div>
    </div>
  )
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
