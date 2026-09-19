import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Film, PlayCircle } from 'lucide-react'
import { useLang } from '../../lib/i18n'
import { usePageMeta } from '../../lib/seo'
import { DEMO_VIDEOS, type DemoVideo } from '../../lib/demoVideos'
import { BoxBtn, PageHero, SitePage } from '../../components/site/Site'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'

const TOPICS: { key: NonNullable<DemoVideo['topic']> | 'all'; label: [string, string] }[] = [
  { key: 'all', label: ['Toutes', 'All'] },
  { key: 'overview', label: ['Vue d’ensemble', 'Overview'] },
  { key: 'mapping', label: ['Cartographie', 'Mapping'] },
  { key: 'simulation', label: ['Simulation', 'Simulation'] },
  { key: 'decision', label: ['Décision', 'Decision'] },
  { key: 'governance', label: ['Gouvernance', 'Governance'] },
]

// Ce que couvriront les vidéos : annoncé tel quel tant qu'elles ne sont pas publiées.
const PLANNED: { title: [string, string]; body: [string, string] }[] = [
  { title: ['Lenexux en 3 minutes', 'Lenexux in 3 minutes'], body: ['Du premier import à la première simulation.', 'From first import to first simulation.'] },
  { title: ['Cartographier son organisation', 'Mapping your organisation'], body: ['Import de fichiers, connecteurs et sonde installée dans le réseau.', 'File import, connectors and in-network probe.'] },
  { title: ['Simuler une panne', 'Simulating an outage'], body: ['Cascade, coût horaire et délai de rétablissement.', 'Cascade, hourly cost and recovery time.'] },
  { title: ['Simuler une cyberattaque', 'Simulating a cyberattack'], body: ['Chemin d’attaque, points de bascule et contre-mesures.', 'Attack path, choke points and countermeasures.'] },
  { title: ['Préparer une décision', 'Preparing a decision'], body: ['Recruter, remplacer, migrer : angles morts et chiffrage sourcé.', 'Hire, replace, migrate: blind spots and sourced costing.'] },
  { title: ['Confiance et preuves', 'Confidence and evidence'], body: ['Valider une dépendance et lire la base probante d’un chiffrage.', 'Validating a dependency and reading a costing’s evidence base.'] },
]

export function Videos() {
  const { t } = useLang()
  const navigate = useNavigate()
  usePageMeta(t('Vidéos de démonstration — Lenexux', 'Demo videos — Lenexux'),
    t('Le produit en action : cartographie, simulation de panne et d’attaque, décision.', 'The product in action: mapping, outage and attack simulation, decision-making.'), '/videos')
  const [topic, setTopic] = useState<(typeof TOPICS)[number]['key']>('all')
  const [active, setActive] = useState(0)
  const list = DEMO_VIDEOS.filter((v) => topic === 'all' || v.topic === topic)
  const v = list[Math.min(active, list.length - 1)]

  return (
    <SitePage>
      <PageHero eyebrow={t('Vidéos', 'Videos')} title={t('Le produit en action', 'The product in action')}
        sub={t('Des démonstrations courtes, une fonction à la fois, sur des données réalistes.', 'Short demos, one feature at a time, on realistic data.')} />

      <section className="px-6 py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          {DEMO_VIDEOS.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {TOPICS.filter((x) => x.key === 'all' || DEMO_VIDEOS.some((d) => d.topic === x.key)).map((x) => (
                  <button key={x.key} onClick={() => { setTopic(x.key); setActive(0) }} className="slb-shot-tab" aria-pressed={topic === x.key}
                    style={{ borderColor: topic === x.key ? '#22d3ee' : '#26262e', color: topic === x.key ? '#7fe8f7' : '#a2a2b0' }}>{t(...x.label)}</button>
                ))}
              </div>
              {v && (
                <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                  <div className="slb-card overflow-hidden">
                    <video key={v.src} src={v.src} poster={v.poster} controls preload="metadata" className="aspect-video w-full bg-black" />
                    <div className="p-5">
                      <h2 style={{ fontFamily: geist, fontSize: 22, fontWeight: 600, color: '#f3f3f6' }}>{t(...v.title)}</h2>
                      <p className="mt-2" style={{ color: '#a2a2b0', lineHeight: 1.6 }}>{t(...v.body)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {list.map((d, i) => (
                      <button key={d.src} onClick={() => setActive(i)} className="slb-card flex items-start gap-3 p-4 text-left"
                        style={{ borderColor: d === v ? '#22d3ee' : undefined }}>
                        <PlayCircle size={18} className="mt-0.5 shrink-0" style={{ color: d === v ? '#22d3ee' : '#6b6b78' }} />
                        <span className="flex flex-col gap-1">
                          <span style={{ color: '#f3f3f6', fontWeight: 500 }}>{t(...d.title)}</span>
                          {d.duration && <span className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 11, color: '#8a8a98' }}><Clock size={11} />{d.duration}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="slb-card flex flex-col items-center gap-4 px-6 py-14 text-center">
                <Film size={30} style={{ color: '#22d3ee' }} />
                <h2 style={{ fontFamily: geist, fontSize: 24, fontWeight: 600, color: '#f3f3f6' }}>{t('Les vidéos arrivent', 'Videos are on their way')}</h2>
                <p style={{ maxWidth: 560, color: '#a2a2b0', lineHeight: 1.6 }}>
                  {t('En attendant, la démo interactive vous laisse explorer le produit sur un jeu de données complet — sans créer de compte.',
                    'Meanwhile, the interactive demo lets you explore the product on a full dataset — no account needed.')}
                </p>
                <BoxBtn primary onClick={() => navigate('/demo')} label={t('Explorer la démo', 'Explore the demo')} icon={<PlayCircle size={15} />} />
              </div>
              <div>
                <div className="slb-label mb-5">{t('Au programme', 'Coming up')}</div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {PLANNED.map((p, i) => (
                    <div key={i} className="slb-card gap-2 p-6">
                      <span style={{ fontFamily: mono, fontSize: 11, color: '#6b6b78' }}>{String(i + 1).padStart(2, '0')} · {t('bientôt', 'soon')}</span>
                      <span style={{ fontFamily: geist, fontSize: 18, fontWeight: 600, color: '#f3f3f6' }}>{t(...p.title)}</span>
                      <span style={{ color: '#a2a2b0', fontSize: 14.5, lineHeight: 1.55 }}>{t(...p.body)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </SitePage>
  )
}
