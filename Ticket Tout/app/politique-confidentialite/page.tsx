import { LegalSection, LegalShell } from "@/components/legal/legal-shell"
import { BRAND } from "@/lib/brand"

export default function PolitiqueConfidentialitePage() {
  return (
    <LegalShell
      eyebrow="Données personnelles"
      title="Politique de confidentialité"
      description={`Cette page explique quelles données sont traitées par ${BRAND.name}, pourquoi elles le sont et combien de temps elles sont conservées.`}
    >
      <LegalSection title="1. Données utilisées pour les comptes">
        <p>
          Lors de la création et de l&apos;utilisation d&apos;un compte, le service peut traiter les informations nécessaires à
          l&apos;identification et à la gestion du compte : nom, prénom, email, téléphone, fonction, raison sociale, SIRET,
          adresse professionnelle et rôle dans le service.
        </p>
        <p>
          Ces informations sont distinctes des pièces justificatives éventuellement transmises pour vérifier une demande.
        </p>
      </LegalSection>

      <LegalSection title="2. Pièces justificatives comme le Kbis">
        <p>
          Lorsqu&apos;un document est demandé pour vérifier une inscription professionnelle, il n&apos;est pas enregistré dans la
          base de données applicative. Le fichier est conservé uniquement dans un espace de stockage temporaire sécurisé,
          pendant l&apos;instruction de la demande.
        </p>
        <p>
          Il est supprimé dès que la demande est acceptée ou refusée. En l&apos;absence de décision plus tôt, sa conservation
          ne dépasse jamais 30 jours à compter de son dépôt.
        </p>
      </LegalSection>

      <LegalSection title="3. Finalités des traitements">
        <p>
          Les données sont utilisées pour créer et sécuriser les comptes, vérifier l&apos;éligibilité d&apos;une organisation,
          gérer les accès, permettre le fonctionnement des espaces utilisateurs et prévenir les usages frauduleux.
        </p>
      </LegalSection>

      <LegalSection title="4. Conservation">
        <p>
          Les données nécessaires au compte peuvent être conservées pendant la durée d&apos;utilisation du service, puis
          supprimées ou archivées selon les obligations applicables au projet. Les justificatifs temporaires suivent la
          durée maximale spécifique de 30 jours décrite ci-dessus.
        </p>
      </LegalSection>

      <LegalSection title="5. Stockage local du navigateur">
        <p>
          Le bandeau d&apos;information sur la confidentialité mémorise uniquement dans votre navigateur le fait que vous
          l&apos;avez fermé. Cette préférence n&apos;est pas enregistrée dans la base de données du service et ne contient aucune
          pièce justificative.
        </p>
      </LegalSection>

      <LegalSection title="6. Vos droits">
        <p>
          Selon le cadre applicable au déploiement du service, vous pouvez demander l&apos;accès, la rectification ou la
          suppression de vos données et exercer les autres droits prévus par la réglementation. Les coordonnées du
          responsable du traitement et, le cas échéant, du délégué à la protection des données devront être complétées
          avant la mise en production publique.
        </p>
      </LegalSection>

      <LegalSection title="7. Sécurité">
        <p>
          Les accès doivent être limités aux personnes habilitées. Les documents temporaires doivent être stockés dans un
          espace privé non public, avec suppression automatique au plus tard à l&apos;échéance de 30 jours.
        </p>
      </LegalSection>

      <div className="rounded-2xl border border-brand-red/25 bg-brand-red-soft p-4 text-sm leading-6 text-brand-red-dark">
        <strong>Avant mise en production :</strong> renseigner l&apos;identité juridique de l&apos;éditeur, le responsable du
        traitement, un contact RGPD/DPO et vérifier que la suppression automatique des justificatifs est réellement
        configurée côté stockage.
      </div>
    </LegalShell>
  )
}
