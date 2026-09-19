import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Mail, PlayCircle } from 'lucide-react'
import { useLang } from '../../lib/i18n'
import { usePageMeta } from '../../lib/seo'
import { LogoMark } from '../../components/Logo'
import { BoxBtn, PageHero, SitePage } from '../../components/site/Site'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CONTACT = 'yvanloic@lenexux.com'

/* ══════════════════════════════════════════════════════════════════════════════
   SOLUTIONS SPLITSPAY

   Le portefeuille de SplitsPay Inc. Contenu repris des sites officiels de
   chaque solution (fonctionnalités uniquement : aucun chiffre marketing ni
   témoignage n'est reproduit ici). Images : visuels officiels, hébergés dans
   public/solutions/.

   Ajouter une solution : un objet de plus dans SOLUTIONS.
   ══════════════════════════════════════════════════════════════════════════ */
type Family = 'business' | 'consumer' | 'services'
type Status = 'available' | 'beta' | 'service'

type Solution = {
  key: string
  name: string
  family: Family
  status: Status
  url: string
  image?: string            // visuel (public/solutions)
  imageFit?: 'cover' | 'contain'
  mark?: string             // logo seul, sur fond sombre
  audience: [string, string]
  tagline: [string, string]
  body: [string, string]
  points: [string, string][]
  internal?: boolean        // Lenexux : page d'accueil de ce site
}

const SOLUTIONS: Solution[] = [
  {
    key: 'lenexux', name: 'Lenexux', family: 'business', status: 'available', url: '/welcome', internal: true,
    audience: ['Directions, DSI, risques et continuité', 'Leadership, IT, risk and continuity'],
    tagline: ['Intelligence des dépendances et de l’impact opérationnel', 'Dependency and operational impact intelligence'],
    body: [
      'Relie systèmes, fournisseurs, personnes et IA dans un même graphe, révèle les points uniques de défaillance, simule pannes, cyberattaques et décisions, et en chiffre l’impact dans la devise de l’organisation.',
      'Links systems, suppliers, people and AI in one graph, reveals single points of failure, simulates outages, cyberattacks and decisions, and prices their impact in the organisation’s currency.',
    ],
    points: [
      ['Cartographie par import, connecteurs ou sonde installée dans le réseau', 'Mapping via import, connectors or in-network probe'],
      ['Simulation de pannes et d’attaques, chiffrage déterministe et explicable', 'Outage and attack simulation, deterministic and explainable pricing'],
      ['Décisions préparées avec l’IA : champs suggérés et angles morts', 'AI-prepared decisions: suggested fields and blind spots'],
    ],
  },
  {
    key: 'goldarmyguard', name: 'GoldArmy Guard', family: 'business', status: 'available', url: 'https://goldarmyguard.com/',
    image: '/solutions/goldarmyguard.webp', imageFit: 'cover',
    audience: ['Agences de sécurité privée', 'Private security agencies'],
    tagline: ['La plateforme de gestion des agences de sécurité privée', 'The management platform for private security agencies'],
    body: [
      'Dispatch des agents par l’IA, rondes par code QR, supervision en temps réel et trois portails intégrés — administration, agents, clients — pour opérer en conformité avec la Loi sur la sécurité privée du Québec.',
      'AI agent dispatch, QR-code patrols, real-time supervision and three integrated portals — admin, agents, clients — to operate in compliance with Quebec’s Private Security Act.',
    ],
    points: [
      ['Dispatch et planification des quarts, multi-sites', 'Shift dispatch and scheduling, multi-site'],
      ['Portail agent mobile : pointage, rapports quotidiens, incidents, mode hors ligne', 'Mobile agent portal: check-in, daily reports, incidents, offline mode'],
      ['Conformité LSSP/BSP, certifications et alertes d’expiration', 'LSSP/BSP compliance, certifications and expiry alerts'],
      ['CRM, facturation automatisée et analyse de rentabilité par contrat', 'CRM, automated billing and per-contract profitability analysis'],
    ],
  },
  {
    key: 'goldarmyai', name: 'GoldArmy AI', family: 'consumer', status: 'available', url: 'https://goldarmyai.com/',
    image: '/solutions/goldarmyai.webp', imageFit: 'contain',
    audience: ['Candidats et centres de carrière', 'Job seekers and career centres'],
    tagline: ['Le co-pilote de carrière propulsé par l’IA', 'The AI-powered career co-pilot'],
    body: [
      'Automatise chaque étape de la recherche d’emploi, du repérage des offres cachées à la préparation des entretiens, dans un seul tableau de bord.',
      'Automates every step of the job search, from spotting hidden offers to interview preparation, in a single dashboard.',
    ],
    points: [
      ['Sniper Search : offres repérées sur les sites d’emploi et directement chez les employeurs', 'Sniper Search: offers found on job boards and directly on employer sites'],
      ['Audit de CV adapté à chaque offre, sans information inventée', 'CV audit tailored to each offer, with no invented information'],
      ['Simulations d’entretien vocal avec débriefing, mentorat', 'Voice interview simulations with debriefing, mentoring'],
      ['Suivi des candidatures en Kanban et relances ; offre pour organisations', 'Kanban application tracking and follow-ups; offer for organisations'],
    ],
  },
  {
    key: 'splitspay', name: 'SplitsPay', family: 'consumer', status: 'beta', url: 'https://www.splitspay.org/',
    mark: '/solutions/splitspay-mark.png',
    audience: ['Particuliers, colocations, groupes', 'Individuals, flatshares, groups'],
    tagline: ['Paiements partagés et micro-prêts entre amis, avec l’IA Loli', 'Shared payments and peer micro-loans, with Loli AI'],
    body: [
      'Divise les dépenses de groupe, encadre les prêts entre proches par des conditions claires et des rappels, et s’appuie sur Loli, une assistante IA qui prévient les tensions liées à l’argent.',
      'Splits group expenses, frames loans between friends with clear terms and reminders, and relies on Loli, an AI assistant that prevents money-related tension.',
    ],
    points: [
      ['Factures partagées, répartition équitable ou personnalisée', 'Shared bills, equal or custom split'],
      ['Micro-prêts entre pairs avec échéances, rappels et score de confiance', 'Peer micro-loans with due dates, reminders and trust score'],
      ['Portefeuille multi-devises, dont franc CFA', 'Multi-currency wallet, including CFA franc'],
      ['Dépôts et retraits par carte, Interac et Mobile Money', 'Deposits and withdrawals by card, Interac and Mobile Money'],
    ],
  },
  {
    key: 'goldarmyagence', name: 'Gold Army Agence', family: 'services', status: 'service', url: 'https://www.goldarmyagence.com/',
    image: '/solutions/goldarmyagence.webp', imageFit: 'contain',
    audience: ['Entrepreneurs et PME du Québec', 'Quebec entrepreneurs and SMEs'],
    tagline: ['Sites web et applications sur mesure', 'Custom websites and applications'],
    body: [
      'Agence web établie à Trois-Rivières et à Montréal. Un aperçu du projet est présenté à 30 % d’avancement, avant toute signature.',
      'Web agency based in Trois-Rivières and Montréal. A preview of the project is shown at 30% completion, before anything is signed.',
    ],
    points: [
      ['Sites web, applications mobiles, commerce en ligne', 'Websites, mobile apps, e-commerce'],
      ['UX et design, API et backend, maintenance', 'UX and design, API and backend, maintenance'],
      ['Méthode en six étapes, de la découverte à l’amélioration continue', 'Six-step method, from discovery to continuous improvement'],
    ],
  },
]

const FAMILIES: { key: Family; label: [string, string]; sub: [string, string] }[] = [
  { key: 'business', label: ['Logiciels pour les organisations', 'Software for organisations'], sub: ['Piloter les opérations, les risques et la conformité.', 'Run operations, risk and compliance.'] },
  { key: 'consumer', label: ['Applications pour les particuliers', 'Apps for individuals'], sub: ['L’IA au service de la carrière et des finances du quotidien.', 'AI for careers and everyday finances.'] },
  { key: 'services', label: ['Services', 'Services'], sub: ['Concevoir et construire vos propres outils numériques.', 'Design and build your own digital tools.'] },
]

const STATUS: Record<Status, { fr: string; en: string; bg: string; fg: string }> = {
  available: { fr: 'Disponible', en: 'Available', bg: 'rgba(34,211,238,.12)', fg: '#7fe8f7' },
  beta: { fr: 'Bêta', en: 'Beta', bg: 'rgba(138,107,255,.16)', fg: '#c4b5ff' },
  service: { fr: 'Agence', en: 'Agency', bg: 'rgba(250,204,21,.12)', fg: '#f5d76e' },
}

export function Solutions() {
  const { t } = useLang()
  const navigate = useNavigate()
  usePageMeta(t('Solutions SplitsPay — Lenexux, GoldArmy Guard, GoldArmy AI, SplitsPay', 'SplitsPay solutions — Lenexux, GoldArmy Guard, GoldArmy AI, SplitsPay'),
    t('SplitsPay Inc. conçoit des logiciels propulsés par l’IA : Lenexux, GoldArmy Guard, GoldArmy AI, SplitsPay, et l’agence Gold Army.',
      'SplitsPay Inc. builds AI-powered software: Lenexux, GoldArmy Guard, GoldArmy AI, SplitsPay, and the Gold Army agency.'), '/solutions')

  return (
    <SitePage>
      <PageHero eyebrow="SplitsPay Inc." title={t('Un éditeur, des logiciels propulsés par l’IA', 'One publisher, AI-powered software')}
        sub={t('SplitsPay Inc. conçoit et développe des solutions pour les organisations et pour les particuliers — de la résilience opérationnelle à la sécurité privée, de la recherche d’emploi aux finances entre proches — et accompagne les PME dans leurs projets numériques.',
          'SplitsPay Inc. designs and builds solutions for organisations and individuals — from operational resilience to private security, from job search to money between friends — and supports SMEs in their digital projects.')}>
        <div className="mt-8 flex flex-wrap gap-2">
          {SOLUTIONS.map((s) => (
            <a key={s.key} href={`#${s.key}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.key)?.scrollIntoView({ behavior: 'smooth' }) }}
              className="slb-chip" style={{ color: '#d0d0da' }}>{s.name}</a>
          ))}
        </div>
      </PageHero>

      {FAMILIES.map((f, fi) => {
        const items = SOLUTIONS.filter((s) => s.family === f.key)
        if (items.length === 0) return null
        return (
          <section key={f.key} className="border-b px-6 py-16" style={{ borderColor: '#14141a', background: fi % 2 ? '#08080b' : '#050506' }}>
            <div className="mx-auto flex max-w-6xl flex-col gap-8">
              <div className="flex flex-col gap-2">
                <div className="slb-label self-start">{t(...f.label)}</div>
                <p style={{ color: '#a2a2b0' }}>{t(...f.sub)}</p>
              </div>
              {items.map((s, i) => <SolutionCard key={s.key} s={s} reverse={i % 2 === 1} />)}
            </div>
          </section>
        )
      })}

      <section className="px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <p style={{ fontFamily: mono, fontSize: 12, color: '#8a8a98', letterSpacing: '.04em', lineHeight: 1.7 }}>
            {t('Toutes ces solutions sont conçues et développées par SplitsPay Inc., fondée par Yvan Loic Nanfah Wamba.',
              'All these solutions are designed and built by SplitsPay Inc., founded by Yvan Loic Nanfah Wamba.')}
          </p>
        </div>
      </section>

      <section className="slb-cta">
        <div className="slb-light slb-light-soft" aria-hidden><span className="slb-silk slb-silk-1" /></div>
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center">
          <h2 className="slb-h2" style={{ fontFamily: geist, maxWidth: 'none' }}>{t('Parlons de votre projet', 'Let’s talk about your project')}</h2>
          <p className="slb-sub" style={{ marginTop: 0 }}>{t('Un pilote, une démonstration, un partenariat : écrivez-nous.', 'A pilot, a demo, a partnership: write to us.')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={`mailto:${CONTACT}`} className="slb-btn slb-btn-primary">
              <span className="slb-btn-label"><Mail size={15} />{CONTACT}</span>
              <span className="slb-btn-arrow"><ArrowUpRight size={15} /></span>
            </a>
            <BoxBtn onClick={() => navigate('/demo')} label={t('Démo Lenexux', 'Lenexux demo')} icon={<PlayCircle size={14} />} />
          </div>
        </div>
      </section>
    </SitePage>
  )
}

function SolutionCard({ s, reverse }: { s: Solution; reverse: boolean }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const st = STATUS[s.status]
  const open = () => (s.internal ? navigate(s.url) : window.open(s.url, '_blank', 'noopener,noreferrer'))

  const visual = (
    <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden" style={{ background: '#0b0b10', border: '1px solid #1c1c24' }}>
      {s.image && (
        <img src={s.image} alt={t(`Visuel officiel de ${s.name}`, `${s.name} official visual`)} loading="lazy"
          className="h-full w-full" style={{ objectFit: s.imageFit ?? 'cover', maxHeight: 320, padding: s.imageFit === 'contain' ? 16 : 0 }} />
      )}
      {!s.image && s.mark && <img src={s.mark} alt={t(`Logo ${s.name}`, `${s.name} logo`)} loading="lazy" style={{ width: 120, height: 'auto', opacity: 0.95 }} />}
      {!s.image && !s.mark && s.key === 'lenexux' && <LogoMark size={120} variant="dark" title="Lenexux" />}
    </div>
  )

  return (
    <article id={s.key} className="slb-card scroll-mt-24 p-6 md:p-8">
      <div className={`grid items-center gap-8 md:grid-cols-2 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
        {visual}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 style={{ fontFamily: geist, fontSize: 28, fontWeight: 600, letterSpacing: '-.02em', color: '#fbfbfe' }}>{s.name}</h3>
            <span className="rounded-full px-2.5 py-0.5" style={{ fontFamily: mono, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', background: st.bg, color: st.fg }}>{t(st.fr, st.en)}</span>
          </div>
          <span style={{ fontFamily: mono, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8a98' }}>{t(...s.audience)}</span>
          <p style={{ fontSize: 17, color: '#e6e6ee', lineHeight: 1.45 }}>{t(...s.tagline)}</p>
          <p style={{ color: '#a2a2b0', lineHeight: 1.65 }}>{t(...s.body)}</p>
          <ul className="flex flex-col gap-2">
            {s.points.map((p, i) => (
              <li key={i} className="flex gap-3" style={{ color: '#d0d0da', lineHeight: 1.5, fontSize: 15 }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: '#22d3ee', paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>{t(...p)}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-3">
            {s.internal
              ? <BoxBtn primary onClick={open} label={t('Découvrir Lenexux', 'Discover Lenexux')} />
              : (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="slb-btn slb-btn-primary">
                  <span className="slb-btn-label">{t('Visiter le site', 'Visit the site')}</span>
                  <span className="slb-btn-arrow"><ArrowUpRight size={15} /></span>
                </a>
              )}
          </div>
        </div>
      </div>
    </article>
  )
}
