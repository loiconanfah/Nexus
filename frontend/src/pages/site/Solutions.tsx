import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Handshake, Mail, Network, PlayCircle, Wrench } from 'lucide-react'
import { useLang } from '../../lib/i18n'
import { usePageMeta } from '../../lib/seo'
import { LogoMark } from '../../components/Logo'
import { BoxBtn, PageHero, SitePage } from '../../components/site/Site'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CONTACT = 'yvanloic@lenexux.com'

/* ══════════════════════════════════════════════════════════════════════════════
   SOLUTIONS SPLITSPAY

   Une entrée par solution éditée par SplitsPay Inc. Ajouter une solution : un
   objet de plus dans SOLUTIONS (statut « available » ou « soon »). N'y figurent
   que des solutions réelles.
   ══════════════════════════════════════════════════════════════════════════ */
type Solution = {
  key: string
  name: string
  status: 'available' | 'soon'
  tagline: [string, string]
  body: [string, string]
  points: [string, string][]
  to?: string
}

const SOLUTIONS: Solution[] = [
  {
    key: 'lenexux',
    name: 'Lenexux',
    status: 'available',
    tagline: ['Intelligence des dépendances et de l’impact opérationnel', 'Dependency and operational impact intelligence'],
    body: [
      'Relie systèmes, fournisseurs, personnes et IA dans un même graphe, révèle les points uniques de défaillance, simule pannes, cyberattaques et décisions, et en chiffre l’impact dans la devise de l’organisation.',
      'Links systems, suppliers, people and AI in one graph, reveals single points of failure, simulates outages, cyberattacks and decisions, and prices their impact in the organisation’s currency.',
    ],
    points: [
      ['Cartographie par import, connecteurs ou sonde installée dans le réseau', 'Mapping via import, connectors or in-network probe'],
      ['Simulation de pannes et d’attaques, chiffrage déterministe et explicable', 'Outage and attack simulation, deterministic and explainable pricing'],
      ['Décisions fondées sur le graphe : recrutement, remplacement, migration', 'Graph-based decisions: hiring, replacement, migration'],
      ['Preuves et validation humaine de chaque dépendance', 'Evidence and human validation for every dependency'],
    ],
    to: '/welcome',
  },
]

const SERVICES: { icon: typeof Handshake; title: [string, string]; body: [string, string] }[] = [
  { icon: Handshake, title: ['Pilote accompagné', 'Guided pilot'], body: ['Un périmètre ciblé, vos données, des résultats présentables à votre direction en quelques semaines.', 'A targeted scope, your data, results you can present to management within weeks.'] },
  { icon: Network, title: ['Mise en place de la cartographie', 'Mapping set-up'], body: ['Import de vos inventaires, connexion de vos outils, validation des dépendances clés avec vos équipes.', 'Import of your inventories, connection of your tools, validation of key dependencies with your teams.'] },
  { icon: Wrench, title: ['Intégration', 'Integration'], body: ['API et sonde de collecte pour tenir la cartographie à jour sans ouvrir votre réseau.', 'API and collection probe to keep the map up to date without opening your network.'] },
]

export function Solutions() {
  const { t } = useLang()
  const navigate = useNavigate()
  usePageMeta(t('Solutions SplitsPay — Lenexux', 'SplitsPay solutions — Lenexux'),
    t('SplitsPay Inc. édite Lenexux, la plateforme d’intelligence des dépendances et de l’impact opérationnel.', 'SplitsPay Inc. publishes Lenexux, the dependency and operational impact intelligence platform.'), '/solutions')

  return (
    <SitePage>
      <PageHero eyebrow="SplitsPay Inc." title={t('Des logiciels pour voir ce qui fait tourner une organisation', 'Software to see what keeps an organisation running')}
        sub={t('SplitsPay Inc. conçoit et édite des solutions qui rendent visibles les dépendances d’une organisation, pour que ses dirigeants décident en connaissant les risques.',
          'SplitsPay Inc. designs and publishes solutions that make an organisation’s dependencies visible, so its leaders decide knowing the risks.')} />

      <section className="px-6 py-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="slb-label self-start">{t('Nos solutions', 'Our solutions')}</div>
          {SOLUTIONS.map((s) => (
            <div key={s.key} className="slb-card p-8">
              <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  {s.key === 'lenexux' && <LogoMark size={40} variant="dark" title="" />}
                  <span style={{ fontFamily: geist, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: '#fbfbfe' }}>{s.name}</span>
                  <span className="rounded-full px-2.5 py-0.5" style={{ fontFamily: mono, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em',
                    background: s.status === 'available' ? 'rgba(34,211,238,.12)' : 'rgba(138,107,255,.14)', color: s.status === 'available' ? '#7fe8f7' : '#b9a6ff' }}>
                    {s.status === 'available' ? t('Disponible', 'Available') : t('Bientôt', 'Coming soon')}
                  </span>
                </div>
                <p style={{ fontSize: 17, color: '#e6e6ee', lineHeight: 1.5 }}>{t(...s.tagline)}</p>
                <p style={{ color: '#a2a2b0', lineHeight: 1.65 }}>{t(...s.body)}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {s.to && <BoxBtn primary onClick={() => navigate(s.to!)} label={t('Découvrir', 'Discover')} />}
                  {s.key === 'lenexux' && <BoxBtn onClick={() => navigate('/demo')} label={t('Démo', 'Demo')} icon={<PlayCircle size={14} />} />}
                </div>
              </div>
              <ul className="flex flex-col gap-3">
                {s.points.map((p, i) => (
                  <li key={i} className="flex gap-3 border-b pb-3" style={{ borderColor: '#17171f', color: '#d0d0da', lineHeight: 1.5 }}>
                    <span style={{ fontFamily: mono, fontSize: 12, color: '#22d3ee', paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>{t(...p)}
                  </li>
                ))}
              </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t px-6 py-16" style={{ borderColor: '#14141a', background: '#08080b' }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="slb-label self-start">{t('Accompagnement', 'Services')}</div>
          <div className="grid gap-4 md:grid-cols-3">
            {SERVICES.map(({ icon: Icon, title, body }) => (
              <div key={title[0]} className="slb-card gap-3 p-6">
                <Icon size={22} style={{ color: '#22d3ee' }} />
                <span style={{ fontFamily: geist, fontSize: 19, fontWeight: 600, color: '#f3f3f6' }}>{t(...title)}</span>
                <span style={{ color: '#a2a2b0', lineHeight: 1.6, fontSize: 15 }}>{t(...body)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="slb-cta">
        <div className="slb-light slb-light-soft" aria-hidden><span className="slb-silk slb-silk-1" /></div>
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center">
          <h2 className="slb-h2" style={{ fontFamily: geist, maxWidth: 'none' }}>{t('Parlons de votre organisation', 'Let’s talk about your organisation')}</h2>
          <p className="slb-sub" style={{ marginTop: 0 }}>{t('Un pilote, une question sur la sécurité des données, un partenariat : écrivez-nous.', 'A pilot, a data-security question, a partnership: write to us.')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={`mailto:${CONTACT}`} className="slb-btn slb-btn-primary">
              <span className="slb-btn-label"><Mail size={15} />{CONTACT}</span>
              <span className="slb-btn-arrow"><ArrowUpRight size={15} /></span>
            </a>
            <BoxBtn onClick={() => navigate('/login?signup=1')} label={t('Créer un compte', 'Create an account')} />
          </div>
        </div>
      </section>
    </SitePage>
  )
}
