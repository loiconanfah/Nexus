import { useSearchParams, useNavigate } from 'react-router-dom'
import { usePageMeta } from '../lib/seo'

const geist = 'var(--font-geist)'
const mono = 'var(--font-mono)'
const CYAN = 'var(--nx-cyan-text)'

// NB : ces textes sont des MODÈLES de départ. Ils doivent être revus et complétés
// par un conseiller juridique (raison sociale, coordonnées, sous-traitants, etc.)
// avant tout usage commercial. Rédigés pour le contexte Québec (Loi 25) + RGPD.
const COMPANY = '[Raison sociale de l’éditeur de Lenexus]'
const CONTACT = '[courriel de contact]'
const DPO = '[responsable de la protection des renseignements personnels]'
const ADDRESS = '[adresse postale]'
const UPDATED = '2 septembre 2026'

type Doc = 'terms' | 'privacy' | 'dpa'
const DOCS: { key: Doc; label: string }[] = [
  { key: 'terms', label: 'Conditions d’utilisation' },
  { key: 'privacy', label: 'Politique de confidentialité' },
  { key: 'dpa', label: 'Addendum de traitement (DPA)' },
]

export function Legal() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  usePageMeta(
    'Mentions légales — Lenexus',
    'Conditions d’utilisation, politique de confidentialité et addendum de traitement des données (DPA) de Lenexus. Contexte Québec (Loi 25) et RGPD.',
    '/legal',
  )
  const doc = (params.get('doc') as Doc) || 'terms'

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-10" style={{ background: 'var(--nx-bg)' }}>
      <button onClick={() => nav('/welcome')} className="mb-6" style={{ fontFamily: mono, fontSize: 12, color: CYAN }}>← Lenexus</button>

      <div className="mb-4 rounded-md border p-3" style={{ borderColor: '#e0a45855', background: 'color-mix(in srgb, #e0a458 8%, transparent)' }}>
        <p style={{ fontSize: 12, color: 'var(--nx-text)' }}>
          <b>Modèle non finalisé.</b> Ces documents sont des gabarits de départ (contexte Québec — Loi 25 — et RGPD).
          Ils doivent être <b>revus et complétés par un conseiller juridique</b> (raison sociale, coordonnées, liste
          des sous-traitants, durées de conservation, transferts hors Québec/UE) avant tout usage commercial.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {DOCS.map((d) => (
          <button key={d.key} onClick={() => setParams({ doc: d.key })}
            className="rounded-full border px-3 py-1"
            style={{ borderColor: doc === d.key ? 'var(--nx-cyan)' : 'var(--nx-border)', color: doc === d.key ? CYAN : 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}>
            {d.label}
          </button>
        ))}
      </div>

      <article className="flex flex-col gap-4" style={{ color: 'var(--nx-text)', lineHeight: 1.6, fontSize: 14 }}>
        {doc === 'terms' && <Terms />}
        {doc === 'privacy' && <Privacy />}
        {doc === 'dpa' && <Dpa />}
        <p style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>Dernière mise à jour : {UPDATED}.</p>
      </article>
    </div>
  )
}

function H1({ children }: { children: React.ReactNode }) {
  return <h1 style={{ fontFamily: geist, fontSize: 26, color: 'var(--nx-text)', marginBottom: 4 }}>{children}</h1>
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4" style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'var(--nx-text-muted)' }}>{children}</p>
}
function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ color: 'var(--nx-text-muted)', marginLeft: 18, listStyle: 'disc' }}>{children}</li>
}

function Terms() {
  return (
    <>
      <H1>Conditions d’utilisation</H1>
      <P>Les présentes conditions régissent l’accès et l’utilisation de la plateforme Lenexus (« le Service »), éditée par {COMPANY}, {ADDRESS}.</P>

      <H2>1. Objet</H2>
      <P>Lenexus est une plateforme d’intelligence des dépendances et d’impact : cartographie des dépendances, analyse de risque, simulation d’incidents et aide à la décision. Le Service est fourni en mode logiciel-service (SaaS), multi-tenant, chaque espace client étant isolé.</P>

      <H2>2. Comptes et accès</H2>
      <P>Le client est responsable de la confidentialité de ses identifiants et de l’usage fait par ses utilisateurs. Il s’engage à fournir des informations exactes et à sécuriser les accès (mots de passe robustes, SSO le cas échéant).</P>

      <H2>3. Utilisation acceptable</H2>
      <ul className="flex flex-col gap-1">
        <Li>Ne pas tenter de contourner l’isolation entre espaces clients ni d’accéder à des données d’autres tenants.</Li>
        <Li>Ne pas importer de données pour lesquelles le client n’a pas les droits nécessaires.</Li>
        <Li>Ne pas utiliser les connecteurs pour sonder des systèmes tiers sans autorisation.</Li>
        <Li>Ne pas surcharger, rétro-concevoir ou perturber le Service.</Li>
      </ul>

      <H2>4. Données du client</H2>
      <P>Le client demeure propriétaire de ses données. Le traitement des renseignements personnels est régi par la Politique de confidentialité et, le cas échéant, par l’Addendum de traitement des données (DPA). {COMPANY} n’utilise pas les données client pour entraîner des modèles.</P>

      <H2>5. Intelligence artificielle</H2>
      <P>Certaines fonctions utilisent des modèles d’IA pour reformuler ou proposer des analyses. Les sorties de l’IA sont indicatives et déterministes côté calcul ; elles ne constituent pas un conseil professionnel (financier, juridique ou de sécurité) et doivent être validées par le client.</P>

      <H2>6. Disponibilité et niveaux de service</H2>
      <P>Le Service est fourni « en l’état » durant la phase pilote. Les engagements de disponibilité (SLA), de sauvegarde et de support font l’objet d’un accord distinct pour les abonnements commerciaux.</P>

      <H2>7. Limitation de responsabilité</H2>
      <P>Dans les limites permises par la loi, {COMPANY} n’est pas responsable des décisions prises sur la base des analyses fournies ni des dommages indirects. La responsabilité totale est plafonnée conformément à l’accord commercial applicable.</P>

      <H2>8. Résiliation</H2>
      <P>Le client peut cesser d’utiliser le Service à tout moment. À la résiliation, les données sont restituées ou supprimées selon la Politique de confidentialité et le DPA.</P>

      <H2>9. Droit applicable</H2>
      <P>Les présentes sont régies par le droit de la province de Québec (Canada). Tout litige relève des tribunaux compétents du district de [district].</P>

      <H2>10. Contact</H2>
      <P>Questions : {CONTACT}.</P>
    </>
  )
}

function Privacy() {
  return (
    <>
      <H1>Politique de confidentialité</H1>
      <P>{COMPANY} accorde de l’importance à la protection des renseignements personnels, conformément à la Loi 25 (Loi sur la protection des renseignements personnels dans le secteur privé, Québec) et, lorsqu’applicable, au Règlement général sur la protection des données (RGPD).</P>

      <H2>1. Responsable</H2>
      <P>Le responsable de la protection des renseignements personnels est {DPO}, joignable à {CONTACT}.</P>

      <H2>2. Renseignements traités</H2>
      <ul className="flex flex-col gap-1">
        <Li><b>Compte</b> : nom, courriel professionnel, rôle, identifiant de tenant.</Li>
        <Li><b>Usage</b> : journaux d’accès, actions dans l’application, adresses IP (sécurité).</Li>
        <Li><b>Données importées par le client</b> : entités, dépendances, éléments organisationnels. Elles peuvent contenir des renseignements personnels (ex. noms de personnes clés) sous la responsabilité du client.</Li>
      </ul>

      <H2>3. Finalités</H2>
      <P>Fournir et sécuriser le Service, authentifier les utilisateurs, produire les analyses demandées, améliorer la fiabilité. Aucune revente de données. Aucun entraînement de modèles d’IA sur les données client.</P>

      <H2>4. Fondement</H2>
      <P>Exécution du contrat, intérêt légitime (sécurité), et consentement lorsque requis. Le client est responsable de disposer d’une base légale pour les renseignements qu’il importe.</P>

      <H2>5. Sous-traitants</H2>
      <P>Le Service s’appuie sur des sous-traitants (hébergement, base de données, fournisseur(s) de modèles d’IA). La liste à jour est disponible sur demande et annexée au DPA. Des mesures contractuelles encadrent chaque sous-traitant.</P>

      <H2>6. Transferts hors Québec / UE</H2>
      <P>Certains sous-traitants peuvent traiter des données hors du Québec ou de l’UE. Le cas échéant, une évaluation des facteurs relatifs à la vie privée (Loi 25) est réalisée et des garanties appropriées (clauses contractuelles) sont mises en place. [À préciser selon l’hébergement retenu.]</P>

      <H2>7. Conservation</H2>
      <P>Les données sont conservées pour la durée de la relation contractuelle, puis supprimées ou anonymisées dans un délai de [durée] après la résiliation, sauf obligation légale contraire.</P>

      <H2>8. Sécurité</H2>
      <P>Isolation multi-tenant, chiffrement en transit, contrôle d’accès par jeton, journalisation, limitation de débit, et garde anti-SSRF sur les connecteurs. Un audit de sécurité indépendant est prévu avant la mise en marché générale.</P>

      <H2>9. Vos droits</H2>
      <P>Conformément à la Loi 25 et au RGPD : accès, rectification, suppression, portabilité, retrait du consentement, et droit à la désindexation. Pour exercer un droit : {CONTACT}. En cas d’incident de confidentialité, les personnes et la Commission d’accès à l’information sont avisées lorsque la loi l’exige.</P>

      <H2>10. Témoins (cookies)</H2>
      <P>Le Service utilise le strict nécessaire à l’authentification et à la sécurité (aucun traceur publicitaire).</P>
    </>
  )
}

function Dpa() {
  return (
    <>
      <H1>Addendum de traitement des données (DPA)</H1>
      <P>Le présent addendum s’applique lorsque {COMPANY} (« le Sous-traitant ») traite des renseignements personnels pour le compte du client (« le Responsable ») dans le cadre de Lenexus. En cas de conflit, il prévaut sur les Conditions d’utilisation pour les questions de protection des données.</P>

      <H2>1. Objet et rôles</H2>
      <P>Le Responsable détermine les finalités et les moyens ; le Sous-traitant traite les données uniquement sur instruction documentée du Responsable, aux fins de fourniture du Service.</P>

      <H2>2. Nature du traitement</H2>
      <ul className="flex flex-col gap-1">
        <Li><b>Catégories de personnes</b> : employés/collaborateurs du Responsable et personnes clés référencées dans ses données.</Li>
        <Li><b>Catégories de données</b> : identités professionnelles, rôles, éléments organisationnels et de dépendance importés.</Li>
        <Li><b>Opérations</b> : hébergement, structuration en graphe, analyse d’impact, restitution.</Li>
      </ul>

      <H2>3. Obligations du Sous-traitant</H2>
      <ul className="flex flex-col gap-1">
        <Li>Traiter uniquement sur instruction ; confidentialité du personnel autorisé.</Li>
        <Li>Mesures de sécurité techniques et organisationnelles appropriées (isolation, chiffrement en transit, contrôle d’accès, journalisation).</Li>
        <Li>Notifier le Responsable sans délai indu en cas d’incident de confidentialité.</Li>
        <Li>Assister le Responsable pour les demandes des personnes concernées et les évaluations d’impact.</Li>
        <Li>Supprimer ou restituer les données à la fin du contrat.</Li>
        <Li>Ne pas entraîner de modèles d’IA sur les données du Responsable.</Li>
      </ul>

      <H2>4. Sous-traitants ultérieurs</H2>
      <P>Le Responsable autorise le recours aux sous-traitants listés en annexe (hébergement, base de données, fournisseur(s) d’IA). Le Sous-traitant informe de tout changement et impose des obligations équivalentes.</P>

      <H2>5. Transferts</H2>
      <P>Tout transfert hors Québec/UE est encadré par des garanties appropriées et, pour la Loi 25, une évaluation des facteurs relatifs à la vie privée. [À compléter selon l’hébergement.]</P>

      <H2>6. Audit</H2>
      <P>Le Sous-traitant met à disposition les informations nécessaires pour démontrer la conformité et permet des audits raisonnables, sous préavis.</P>

      <H2>Annexe — Sous-traitants</H2>
      <P>[Liste à compléter : hébergeur, base de données managée, fournisseur de modèles d’IA, avec localisation et rôle.]</P>
    </>
  )
}
