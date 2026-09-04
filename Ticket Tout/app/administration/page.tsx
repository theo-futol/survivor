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
/* Database Interfaces & Modular Schema Definitions                    */
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
}

export interface AdminAccount extends Person {
  lastLogin: string
}

/* ------------------------------------------------------------------ */
/* Modular Database Service Mock (Replace with Prisma/Supabase/API)  */
/* ------------------------------------------------------------------ */

const dbService = {
  async getRequests(): Promise<EmployeeRequest[]> {
    return [
      {
        id: "req-1",
        employeeName: "Lucas Payet",
        employeeEmail: "lucas.payet@example.com",
        businessName: "Boulangerie Hoarau",
        ceoName: "Jean Hoarau",
        position: "Vendeur",
        requestedAt: "2026-08-28",
        status: "pending",
      },
      {
        id: "req-2",
        employeeName: "Nina Grondin",
        employeeEmail: "nina.grondin@example.com",
        businessName: "Garage Techniplus",
        ceoName: "Marc Técher",
        position: "Mécanicienne",
        requestedAt: "2026-08-30",
        status: "pending",
      },
      {
        id: "req-3",
        employeeName: "Enzo Maillot",
        employeeEmail: "enzo.maillot@example.com",
        businessName: "Boulangerie Hoarau",
        ceoName: "Jean Hoarau",
        position: "Livreur",
        requestedAt: "2026-09-01",
        status: "pending",
      },
    ]
  },

  async getBusinesses(): Promise<Business[]> {
    return [
      {
        id: "biz-1",
        name: "Boulangerie Hoarau",
        siret: "123 456 789 00012",
        kbisUrl: "/documents/kbis-boulangerie-hoarau.pdf",
        address: "12 Rue du Général de Gaulle, Saint-Denis, La Réunion",
        ceoName: "Jean Hoarau",
        employees: [
          { id: "emp-1", name: "Aline Rivière", role: "Boulangère" },
          { id: "emp-2", name: "Paul Fontaine", role: "Pâtissier" },
        ],
      },
      {
        id: "biz-2",
        name: "Garage Techniplus",
        siret: "987 654 321 00045",
        kbisUrl: "/documents/kbis-garage-techniplus.pdf",
        address: "48 Route Nationale 1, Le Port, La Réunion",
        ceoName: "Marc Técher",
        employees: [
          { id: "emp-3", name: "Sofia Payet", role: "Réceptionniste" },
          { id: "emp-4", name: "Karim Rousseau", role: "Mécanicien" },
          { id: "emp-5", name: "Léa Dijoux", role: "Apprentie" },
        ],
      },
      {
        id: "biz-3",
        name: "Librairie des Filaos",
        siret: "456 789 123 00078",
        kbisUrl: "/documents/kbis-librairie-filaos.pdf",
        address: "5 Avenue de la Victoire, Saint-Pierre, La Réunion",
        ceoName: "Aïcha Ramassamy",
        employees: [],
      },
    ]
  },

  async getAdminAccount(): Promise<AdminAccount> {
    return {
      id: "admin-1",
      name: "Camille Barret",
      email: "camille.barret@admin-site.re",
      phone: "+262 692 00 00 00",
      role: "Administrateur principal",
      lastLogin: "01/09/2026 à 18:42",
    }
  },

  async updateRequestStatus(id: string, status: RequestStatus): Promise<boolean> {
    // Database update query simulation
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

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h2 className="text-2xl font-bold tracking-tight">Compte administrateur</h2>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">{initials(adminAccount.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold leading-tight">{adminAccount.name}</p>
            <Badge variant="secondary" className="mt-1">
              <Shield className="mr-1 h-3 w-3" />
              {adminAccount.role}
            </Badge>
          </div>
        </div>

        <Separator className="my-4" />

        <dl className="grid gap-3 sm:grid-cols-2">
          {adminAccount.email && <InfoRow icon={Mail} label="Email" value={adminAccount.email} />}
          {adminAccount.phone && <InfoRow icon={Phone} label="Téléphone" value={adminAccount.phone} />}
          <InfoRow icon={Clock} label="Dernière connexion" value={adminAccount.lastLogin} />
        </dl>
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

      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <StatCard label="Entreprises" value={businesses.length} />
        <StatCard
          label="Employés au total"
          value={businesses.reduce((sum, b) => sum + b.employees.length, 0)}
        />
        <StatCard
          label="Sans employé"
          value={businesses.filter((b) => b.employees.length === 0).length}
        />
      </div>

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
                <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                  <MapPin className="h-3.5 w-3.5" /> {biz.address}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Chef d'entreprise : {biz.ceoName}
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  SIRET : {biz.siret}
                </p>
              </div>
              <Badge variant="secondary" className="w-fit">
                <Users className="mr-1 h-3 w-3" />
                {biz.employees.length} employé{biz.employees.length > 1 ? "s" : ""}
              </Badge>
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
                <Separator />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Dirigeant :</span>
                  <span className="font-medium">{selectedBusiness.ceoName}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Adresse :</span>
                  <span className="font-medium text-right max-w-[200px] truncate">
                    {selectedBusiness.address}
                  </span>
                </div>
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
                      <p className="text-xs text-muted-foreground">Document PDF officiel</p>
                    </div>
                  </div>
                  <Button size="sm" asChild variant="default">
                    <a href={selectedBusiness.kbisUrl} download target="_blank" rel="noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </a>
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