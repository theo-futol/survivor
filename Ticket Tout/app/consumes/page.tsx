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

  // On récupère uniquement les transactions consommées
  const mouvements = salarie?.transactionsUtilisation ?? []

  return (
    <div className="[--header-height:calc(var(--spacing)*14)]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />

        <div className="flex flex-1">
          <AppSidebar />

          <SidebarInset>
            <main id="contenu-principal" tabIndex={-1} className="p-6">

              <h1 className="text-2xl font-bold mb-6">
                Historique de mes consommations
              </h1>

              <Table>
                <TableCaption>
                  Historique des consommations de {salarie?.nom}
                </TableCaption>

                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Partenaire</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {mouvements.map((mouvement) => (
                    <TableRow key={mouvement.id}>
                      <TableCell>
                        {new Date(mouvement.date).toLocaleDateString("fr-FR")}
                      </TableCell>

                      <TableCell>
                        {mouvement.partenaireNom}
                      </TableCell>

                      <TableCell className="text-red-600">
                        -{mouvement.montant.toFixed(2)} €
                      </TableCell>

                      <TableCell>
                        {mouvement.statut}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}
