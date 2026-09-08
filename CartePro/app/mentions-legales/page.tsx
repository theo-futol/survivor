import { LegalSection, LegalShell } from "@/components/legal/legal-shell"
import { BRAND } from "@/lib/brand"

export default function MentionsLegalesPage() {
  return (
    <LegalShell
      eyebrow="Informations légales"
      title="Mentions légales"
      description={`Informations relatives à l'édition et à l'hébergement du service ${BRAND.name}.`}
    >
      <LegalSection title="Éditeur du service">
        <p>
          Les informations définitives de l&apos;entité éditrice du service doivent être complétées avant la mise en
          production : dénomination, forme juridique le cas échéant, adresse, numéro d&apos;immatriculation et coordonnées de
          contact.
        </p>
      </LegalSection>

      <LegalSection title="Responsable de publication">
        <p>À renseigner avant la mise en production publique.</p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Les coordonnées de l&apos;hébergeur doivent correspondre à l&apos;infrastructure réellement utilisée lors du
          déploiement. Elles sont à compléter lorsque l&apos;hébergement de production est arrêté.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Sauf indication contraire, les contenus propres au service, son interface, ses textes et éléments graphiques
          sont protégés par les règles applicables à la propriété intellectuelle. Les contenus appartenant à des tiers
          restent la propriété de leurs titulaires respectifs.
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          Cette version est une démonstration fonctionnelle. Les crédits, soldes et transactions présentés sont simulés.
          L&apos;éditeur ne garantit pas la disponibilité permanente d&apos;un environnement de démonstration.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
