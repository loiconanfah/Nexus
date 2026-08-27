import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Blocks, Check, Clock, ExternalLink, KeyRound, Plug, Search, Sparkles } from 'lucide-react'
import { useLang } from '../lib/i18n'
import { CATEGORIES, CONNECTORS, TIER_META, type Connector, type Tier } from '../lib/connectors'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN_T = 'var(--nx-cyan-text)'

export function IntegrationMarketplace() {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const [q, setQ] = useState('')
  const [tier, setTier] = useState<Tier | 'all'>('all')

  const counts = useMemo(() => {
    const c: Record<string, number> = { active: 0, assisted: 0, key: 0, roadmap: 0 }
    CONNECTORS.forEach((k) => { c[k.tier]++ })
    return c
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return CONNECTORS.filter((k) => (tier === 'all' || k.tier === tier)
      && (!term || k.name.toLowerCase().includes(term) || k.descFr.toLowerCase().includes(term) || k.descEn.toLowerCase().includes(term)))
  }, [q, tier])

  const byCat = useMemo(() => {
    return CATEGORIES.map((cat) => ({ cat, items: filtered.filter((k) => k.category === cat.key) })).filter((g) => g.items.length > 0)
  }, [filtered])

  const usable = counts.active + counts.assisted

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <Blocks size={22} style={{ color: 'var(--nx-cyan)' }} /> {t('Place de marché des connecteurs', 'Integration Marketplace')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
          {t(`${CONNECTORS.length} connecteurs · ${usable} exploitables aujourd’hui`, `${CONNECTORS.length} connectors · ${usable} usable today`)}
          {' — '}{t('alimentez NEXUS depuis vos systèmes existants.', 'feed NEXUS from your existing systems.')}
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <TierChip label={t('Tous', 'All')} active={tier === 'all'} color="var(--nx-outline)" count={CONNECTORS.length} onClick={() => setTier('all')} />
          {(['active', 'assisted', 'key', 'roadmap'] as Tier[]).map((tk) => (
            <TierChip key={tk} label={lang === 'fr' ? TIER_META[tk].fr : TIER_META[tk].en} active={tier === tk} color={TIER_META[tk].color} count={counts[tk]} onClick={() => setTier(tk)} />
          ))}
        </div>
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3" style={{ color: 'var(--nx-text-muted)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Rechercher un connecteur…', 'Search a connector…')} className="w-full rounded-sm border py-1.5 pl-9 pr-3 outline-none md:w-72" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }} />
        </div>
      </div>

      {byCat.map(({ cat, items }) => (
        <div key={cat.key}>
          <div className="mb-2 mt-2 flex items-center gap-2">
            <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: CYAN_T }}>{lang === 'fr' ? cat.fr : cat.en}</span>
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>· {items.length}</span>
            <div className="h-px flex-1" style={{ background: 'var(--nx-border)' }} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((k) => <Card key={k.id} k={k} onImport={() => navigate(`/onboarding?connector=${k.id}`)} onKey={() => navigate('/admin')} />)}
          </div>
        </div>
      ))}

      {filtered.length === 0 && <div className="rounded-sm border p-8 text-center" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Aucun connecteur ne correspond.', 'No connector matches.')}</div>}
    </div>
  )
}

function Card({ k, onImport, onKey }: { k: Connector; onImport: () => void; onKey: () => void }) {
  const { t, lang } = useLang()
  const meta = TIER_META[k.tier]
  const border = k.tier === 'active' ? 'rgba(74,222,128,0.35)' : k.tier === 'key' ? 'rgba(192,132,252,0.35)' : 'var(--nx-border)'

  return (
    <div className="flex flex-col gap-3 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: border }}>
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)', fontFamily: mono, fontSize: 10, color: 'var(--nx-text)' }}>{k.glyph}</div>
        <span className="flex items-center gap-1 rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}40` }}>
          {k.tier === 'active' ? <Check size={10} /> : k.tier === 'key' ? <KeyRound size={10} /> : k.tier === 'assisted' ? <Plug size={10} /> : <Clock size={10} />} {lang === 'fr' ? meta.fr : meta.en}
        </span>
      </div>
      <div>
        <h3 style={{ fontFamily: geist, fontSize: 15, color: 'var(--nx-text)' }}>{k.name}</h3>
        <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{lang === 'fr' ? k.bringsFr : k.bringsEn}</div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5, flex: 1 }}>{lang === 'fr' ? k.descFr : k.descEn}</p>

      <div className="flex items-center gap-2">
        {(k.tier === 'active' || k.tier === 'assisted') && (
          <button onClick={onImport} className="flex flex-1 items-center justify-center gap-1.5 rounded-sm py-2" style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.30)', color: CYAN_T, fontFamily: mono, fontSize: 11, textTransform: 'uppercase' }}>
            {k.tier === 'active' ? <><Sparkles size={13} /> {t('Connecter', 'Connect')}</> : <><Plug size={13} /> {t('Importer l’export', 'Import export')}</>}
          </button>
        )}
        {k.tier === 'key' && (
          <button onClick={onKey} className="flex flex-1 items-center justify-center gap-1.5 rounded-sm py-2" style={{ background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.35)', color: '#c084fc', fontFamily: mono, fontSize: 11, textTransform: 'uppercase' }}>
            <KeyRound size={13} /> {t('Ajouter une clé', 'Add a key')}
          </button>
        )}
        {k.tier === 'roadmap' && (
          <button disabled className="flex flex-1 items-center justify-center gap-1.5 rounded-sm py-2" style={{ background: 'transparent', border: '1px solid var(--nx-border)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 11, textTransform: 'uppercase', cursor: 'not-allowed' }}>
            {t('Roadmap', 'Planned')}
          </button>
        )}
        <a href={k.docUrl} target="_blank" rel="noreferrer" title={t('Documentation', 'Documentation')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  )
}

function TierChip({ label, active, color, count, onClick }: { label: string; active: boolean; color: string; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-sm border px-2.5 py-1" style={{ borderColor: active ? color : 'var(--nx-border)', background: active ? `${color}18` : 'transparent', fontFamily: mono, fontSize: 11, color: active ? 'var(--nx-text)' : 'var(--nx-text-muted)' }}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} /> {label} <span style={{ opacity: 0.6 }}>{count}</span>
    </button>
  )
}
