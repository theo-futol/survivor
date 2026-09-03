import Link from "next/link"

import { LegalSection, LegalShell } from "@/components/legal/legal-shell"
import { buttonVariants } from "@/components/ui/button"
import { BRAND } from "@/lib/brand"

export default function ConditionsGeneralesPage() {
  return (
    <LegalShell
      eyebrow="Cadre d'utilisation"
      title="Conditions générales d'utilisation"
      description={`Les règles d'accès et d'utilisation du service ${BRAND.name}, pour les salariés, entreprises, partenaires et administrateurs.`}
    >
      <div className="rounded-2xl border border-brand-gold/40 bg-brand-gold/10 p-4 text-sm leading-6">
        <strong>Simulation :</strong> cette version du service est une démonstration. Les crédits, soldes, montants et
        transactions affichés sont fictifs et n&apos;ont aucune valeur monétaire réelle.
      </div>

      <LegalSection title="1. Objet du service">
        <p>
          {BRAND.name} permet aux employeurs d&apos;attribuer des avantages à leurs salariés et à ces derniers de les
          utiliser auprès d&apos;un réseau de partenaires référencés. Le service comprend notamment la consultation du
          solde, l&apos;historique des opérations, la recherche de partenaires et la génération d&apos;un QR code de paiement.
        </p>
      </LegalSection>

      <LegalSection title="2. Accès et création d'un compte">
        <p>
          L&apos;accès aux espaces privés nécessite un compte. Les comptes salariés sont créés ou activés selon le parcours
          défini par l&apos;employeur. Les demandes de comptes entreprise et partenaire peuvent faire l&apos;objet d&apos;une
          vérification avant activation.
        </p>
        <p>
          L&apos;utilisateur s&apos;engage à fournir des informations exactes, complètes et à jour et à conserver ses moyens
          d&apos;authentification confidentiels.
        </p>
      </LegalSection>

      <LegalSection title="3. Pièces justificatives et validation">
        <p>
          Des justificatifs professionnels, par exemple un extrait Kbis, peuvent être demandés pour vérifier une demande
          d&apos;inscription. Ces pièces sont utilisées uniquement pour l&apos;instruction de la demande.
        </p>
        <p>
          Elles ne sont pas enregistrées dans la base de données applicative : elles sont conservées dans un stockage
          temporaire sécurisé, supprimées dès la décision d&apos;acceptation ou de refus et, dans tous les cas, au plus tard
          30 jours après leur dépôt. Les modalités complètes figurent dans la politique de confidentialité.
        </p>
      </LegalSection>

      <LegalSection title="4. Obligations des utilisateurs">
        <p>
          Chaque utilisateur doit utiliser le service conformément à sa finalité et s&apos;abstenir de toute tentative de
          fraude, d&apos;usurpation d&apos;identité, de contournement des contrôles, d&apos;accès non autorisé ou d&apos;usage illicite.
        </p>
        <p>
          Une demande ou un compte peut être refusé, suspendu ou clôturé en cas d&apos;informations manifestement inexactes,
          d&apos;usage frauduleux ou de non-respect des présentes conditions.
        </p>
      </LegalSection>

      <LegalSection title="5. Transactions et fonctionnement de la simulation">
        <p>
          Dans cette version de démonstration, les montants et transactions sont simulés. Une transaction peut être
          refusée lorsqu&apos;un solde simulé est insuffisant. Les historiques affichés servent à présenter le comportement
          attendu du futur service.
        </p>
      </LegalSection>

      <LegalSection title="6. Propriété intellectuelle">
        <p>
          Sauf mention contraire, les textes, interfaces, éléments graphiques, marques, logos et contenus propres à
          {` ${BRAND.name} `}sont protégés. Toute reproduction ou exploitation non autorisée peut être interdite.
        </p>
      </LegalSection>

      <LegalSection title="7. Données personnelles">
        <p>
          Les traitements de données liés à la création et à l&apos;utilisation des comptes sont décrits dans la{" "}
          <Link href="/politique-confidentialite" className="font-bold text-primary underline underline-offset-4">
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Mise à jour des conditions">
        <p>
          Les présentes conditions peuvent évoluer afin de tenir compte des modifications fonctionnelles, techniques ou
          réglementaires du service. La version publiée sur le site est la version applicable.
        </p>
        <p className="font-semibold text-foreground">Dernière mise à jour : 3 septembre 2026.</p>
      </LegalSection>
    </LegalShell>
  )
}
