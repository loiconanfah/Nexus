import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Share2, ArrowRight, ArrowLeft, Building2, Radio, Loader2, Boxes, Share as ShareIcon, ShieldAlert } from 'lucide-react'
import { login } from '../lib/auth'
import { useLang } from '../lib/i18n'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'

const DEMO_PWD = 'lenexus-demo-2026'

interface Demo {
  id: string; email: string; icon: typeof Building2; sectorFr: string; sectorEn: string
  name: string; entities: number; links: number; accent: string
  pitchFr: string; pitchEn: string; highlightsFr: string[]; highlightsEn: string[]
}
const DEMOS: Demo[] = [
  {
    id: 'cgi', email: 'demo-cgi@lenexus.demo', icon: Building2, accent: '#0aa5bd',
    name: 'CGI Inc.', sectorFr: 'Services professionnels & TI', sectorEn: 'Professional & IT services',
    entities: 58, links: 64,
    pitchFr: 'Une firme de services TI : applications d’affaires, cloud, fournisseurs et personnes clés.',
    pitchEn: 'An IT services firm: business applications, cloud, suppliers and key people.',
    highlightsFr: ['Entra ID en point unique de défaillance', 'Concentration fournisseur Microsoft', 'Impact chiffré 1,70 M$'],
    highlightsEn: ['Entra ID single point of failure', 'Microsoft supplier concentration', 'Quantified impact $1.70M'],
  },
  {
    id: 'bell', email: 'demo-bell@lenexus.demo', icon: Radio, accent: '#8a5cff',
    name: 'Bell Telecom', sectorFr: 'Télécommunications', sectorEn: 'Telecommunications',
    entities: 97, links: 116,
    pitchFr: 'Un opérateur télécom : réseau cœur (IMS, HSS, 5GC), RAN, OSS/BSS, facturation, fournisseurs.',
    pitchEn: 'A telecom carrier: core network (IMS, HSS, 5GC), RAN, OSS/BSS, billing, suppliers.',
    highlightsFr: ['HSS & IMS au cœur des services', 'Chaîne de facturation Amdocs', 'Experts uniques (facturation, IMS)'],
    highlightsEn: ['HSS & IMS at the core of services', 'Amdocs billing chain', 'Single-expert knowledge (billing, IMS)'],
  },
]

export function DemoChoice() {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(d: Demo) {
    if (busy) return
    setBusy(d.id); setError(null)
    try {
      await login(d.email, DEMO_PWD)
      navigate('/')
    } catch {
      setError(t('Connexion à la démo impossible. Réessayez.', 'Could not open the demo. Please retry.'))
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col" style={{ background: 'var(--nx-bg)', color: 'var(--nx-text)', fontFamily: 'var(--font-inter)' }}>
      {/* Barre */}
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--nx-border)' }}>
        <button onClick={() => navigate('/welcome')} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded" style={{ background: 'var(--nx-cyan)' }}>
            <Share2 size={17} strokeWidth={2.4} style={{ color: 'var(--nx-on-cyan)' }} />
          </div>
          <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: geist }}>Lenexus</span>
        </button>
        <button onClick={() => navigate('/welcome')} className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>
          <ArrowLeft size={14} /> {t('Retour', 'Back')}
        </button>
      </header>

      {/* Contenu */}
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-2" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-cyan-text)' }}>
          {t('Accès démo', 'Demo access')}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ fontFamily: geist, color: 'var(--nx-text)' }}>
          {t('Choisissez une démonstration', 'Choose a demo')}
        </h1>
        <p className="mt-2 max-w-2xl" style={{ fontSize: 15, color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
          {t('Chaque démo est un espace de travail complet et indépendant, avec ses propres données. Explorez-le librement.',
             'Each demo is a complete, independent workspace with its own data. Explore it freely.')}
        </p>

        {error && (
          <div className="mt-5 flex items-center gap-2 rounded-sm border px-3 py-2" style={{ borderColor: 'rgba(224,85,75,0.4)', background: 'color-mix(in srgb, #e0554b 8%, transparent)', color: '#e0554b', fontSize: 13 }}>
            <ShieldAlert size={15} /> {error}
          </div>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {DEMOS.map((d) => (
            <button key={d.id} onClick={() => choose(d)} disabled={!!busy}
              className="group flex flex-col rounded-xl border p-6 text-left transition-all hover:-translate-y-0.5 disabled:opacity-60"
              style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${d.accent} 15%, transparent)` }}>
                  <d.icon size={24} style={{ color: d.accent }} />
                </div>
                <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{lang === 'fr' ? d.sectorFr : d.sectorEn}</span>
              </div>
              <h2 className="mt-5 text-2xl font-semibold" style={{ fontFamily: geist }}>{d.name}</h2>
              <p className="mt-2 flex-1" style={{ fontSize: 13.5, color: 'var(--nx-text-muted)', lineHeight: 1.55 }}>{lang === 'fr' ? d.pitchFr : d.pitchEn}</p>

              <div className="mt-4 flex gap-4">
                <Stat icon={Boxes} value={d.entities} label={t('entités', 'entities')} />
                <Stat icon={ShareIcon} value={d.links} label={t('liens', 'links')} />
              </div>

              <ul className="mt-4 flex flex-col gap-1.5">
                {(lang === 'fr' ? d.highlightsFr : d.highlightsEn).map((hl) => (
                  <li key={hl} className="flex items-center gap-2" style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>
                    <span className="h-1 w-1 rounded-full" style={{ background: d.accent }} /> {hl}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-center justify-between rounded-sm px-3 py-2 transition-colors"
                style={{ background: d.accent, color: '#fff', fontFamily: mono, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {busy === d.id ? t('Ouverture…', 'Opening…') : t('Explorer cette démo', 'Explore this demo')}
                {busy === d.id ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              </div>
            </button>
          ))}
        </div>

        <p className="mt-6" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>
          {t('Vous préférez partir d’une page blanche ? ', 'Prefer a blank slate? ')}
          <button onClick={() => navigate('/login?signup=1')} style={{ color: 'var(--nx-cyan-text)' }}>{t('Créer un compte', 'Create an account')}</button>
        </p>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, value, label }: { icon: typeof Boxes; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={14} style={{ color: 'var(--nx-text-muted)' }} />
      <span style={{ fontFamily: geist, fontSize: 16, fontWeight: 600 }}>{value}</span>
      <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{label}</span>
    </div>
  )
}
