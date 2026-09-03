import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

import data from "@/data/paiements.json"

export default function Page() {
  // Exemple : utilisateur actuellement connecté
  const utilisateurConnecte = "sal-100"

  // On récupère son compte
  const salarie = data.salaries.find(
    (salarie) => salarie.id === utilisateurConnecte
  )

  // On récupère son entreprise
  const entreprise = data.entreprises.find(
    (entreprise) => entreprise.id === salarie?.entrepriseId
  )

  // On récupère uniquement les crédits reçus
  const credits = salarie?.creditsRecus ?? []

  return (
    <div className="[--header-height:calc(var(--spacing)*14)]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />

        <div className="flex flex-1">
          <AppSidebar />

          <SidebarInset>
            <div className="p-6">

              <h1 className="text-2xl font-bold mb-6">
                Historique de mes crédits
              </h1>

              <Table>
                <TableCaption>
                  Historique des crédits de {salarie?.nom}
                </TableCaption>

                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Montant</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {credits.map((credit) => (
                    <TableRow key={credit.abondementId}>
                      <TableCell>
                        {new Date(credit.date).toLocaleDateString("fr-FR")}
                      </TableCell>

                      <TableCell>
                        {entreprise?.raisonSociale ?? "Entreprise"}
                      </TableCell>

                      <TableCell className="text-green-600">
                        +{credit.montant.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}