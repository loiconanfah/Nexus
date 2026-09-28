import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ListPlus, Network, ShieldCheck, Sparkles, X } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { entityTypeLabel, bandLabel, relationTypeLabel } from '../lib/labels'
import { ActionModal } from '../components/ActionModal'
import { SavedViews } from '../components/SavedViews'
import type { RiskBand, RiskRow, ViewConfig } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

const BAND_COLOR: Record<RiskBand, string> = {
  Critical: 'var(--nx-danger)', High: 'var(--nx-orange)', Elevated: 'var(--nx-warning)', Moderate: 'var(--nx-warning)', Low: 'var(--nx-cyan)',
}
const TILES: { label: string; bands: RiskBand[]; color: string }[] = [
  { label: 'CRITICAL', bands: ['Critical'], color: 'var(--nx-danger)' },
  { label: 'HIGH', bands: ['High'], color: 'var(--nx-orange)' },
  { label: 'ELEVATED', bands: ['Elevated'], color: 'var(--nx-warning)' },
  { label: 'LOW', bands: ['Moderate', 'Low'], color: 'var(--nx-cyan)' },
]

export function RiskCenter() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { data, isLoading, error } = useQuery({ queryKey: ['riskEntities'], queryFn: api.riskEntities })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Les critères du tableau courant. Les tuiles de bandes écrivent dedans, comme
  // les autres filtres : une seule vérité, donc un seul objet à enregistrer.
  const [cfg, setCfg] = useState<ViewConfig>({})
  const [viewId, setViewId] = useState<string | null>(null)

  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => b.score - a.score), [data])
  const types = useMemo(() => [...new Set(rows.map((r) => r.entityType))].sort(), [rows])
  const filtered = useMemo(() => applyRiskFilters(rows, cfg), [rows, cfg])
  const selected = useMemo(() => filtered.find((r) => r.id === selectedId) ?? filtered[0], [filtered, selectedId])
  const columns = cfg.columns ?? DEFAULT_COLUMNS
  const bandFilter = cfg.bands ?? null

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('ÉVALUATION DU RISQUE…', 'ASSESSING RISK…')}</div>
  if (error) return <div style={{ color: 'var(--nx-danger)' }}>{(error as Error).message}</div>

  const tileLabel = (l: string) => l === 'CRITICAL' ? t('CRITIQUE', 'CRITICAL') : l === 'HIGH' ? t('ÉLEVÉ', 'HIGH') : l === 'ELEVATED' ? t('SURÉLEVÉ', 'ELEVATED') : t('FAIBLE', 'LOW')

  const setBands = (bands: RiskBand[] | null) => setCfg((c) => ({ ...c, bands: bands ?? undefined }))

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 style={{ fontFamily: geist, fontSize: 24, letterSpacing: '-0.01em', color: 'var(--nx-text)' }}>{t('Intelligence des risques', 'Risk Intelligence')}</h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Identifiez les dépendances les plus susceptibles de perturber les opérations critiques.', 'Identify the dependencies most likely to disrupt critical operations.')}</p>
        </div>
        <div className="hidden items-center gap-2 rounded-sm border px-4 py-2 lg:flex" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 12 }}>
          <span style={{ color: 'var(--nx-text-muted)' }}>{t('État du système :', 'System Status:')}</span>
          <span className="flex items-center gap-1" style={{ color: CYAN }}><span className="h-2 w-2 animate-pulse rounded-full" style={{ background: CYAN }} /> {t('EN LIGNE', 'ONLINE')}</span>
        </div>
      </div>

      {/* Tuiles de bandes */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {TILES.map((tile) => {
          const count = rows.filter((r) => tile.bands.includes(r.band)).length
          const active = bandFilter && bandFilter.join() === tile.bands.join()
          return (
            <button key={tile.label} onClick={() => setBands(active ? null : tile.bands as RiskBand[])}
              className="relative flex flex-col gap-1 overflow-hidden rounded-sm border p-3 text-left"
              style={{ background: 'var(--nx-surface-container)', borderColor: active ? tile.color : 'var(--nx-border)' }}>
              <span style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{tileLabel(tile.label)}</span>
              <span style={{ fontFamily: geist, fontSize: 28, fontWeight: 500, color: tile.color }}>{count}</span>
              <div className="absolute bottom-0 left-0 h-1 w-full" style={{ background: tile.color, opacity: active ? 1 : 0.5 }} />
            </button>
          )
        })}
      </div>

      {/* Tableaux personnalisés : la barre des vues, puis les filtres */}
      <div className="flex flex-col gap-3 rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <SavedViews kind="risk" current={cfg} active={viewId} onActiveChange={setViewId}
          onApply={(c) => { setCfg(c); setSelectedId(null) }} />
        <RiskFilters cfg={cfg} types={types} onChange={setCfg} count={filtered.length} total={rows.length} />
      </div>

      {/* Zone dynamique */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Colonne centrale : matrice + table */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <RiskMatrix rows={rows} selectedId={selected?.id} onSelect={setSelectedId} />
          <RiskTable rows={filtered} columns={columns} selectedId={selected?.id} onSelect={setSelectedId} />
        </div>

        {/* Panneau Priority Risk */}
        {selected && <PriorityRisk row={selected} onClose={() => setBands(null)} onSimulate={() => navigate(`/simulations?asset=${selected.id}&name=${encodeURIComponent(selected.name)}`)} onView={() => navigate('/graph')} />}
      </div>
    </div>
  )
}

/* ---------- Matrice de risque ---------- */
function RiskMatrix({ rows, selectedId, onSelect }: { rows: RiskRow[]; selectedId?: string; onSelect: (id: string) => void }) {
  const { t } = useLang()
  const maxBlast = Math.max(4, ...rows.map((r) => r.blastRadius))
  const cell = (r: RiskRow) => ({
    col: Math.min(4, Math.floor((r.blastRadius / maxBlast) * 4.999)),
    row: Math.min(4, Math.floor((r.effectiveCriticality / 100) * 4.999)),
  })
  const byCell = new Map<string, RiskRow[]>()
  rows.forEach((r) => { const c = cell(r); const k = `${c.row}-${c.col}`; byCell.set(k, [...(byCell.get(k) ?? []), r]) })

  return (
    <div className="relative flex min-h-[380px] items-center justify-center rounded-sm border p-6" style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}>
      <div className="nx-grid absolute inset-0" />
      <div className="relative flex aspect-square w-full max-w-[440px] flex-col">
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Impact métier', 'Business Impact')}</div>
        <div className="grid flex-1 grid-cols-5 grid-rows-5 gap-1 rounded-sm border p-1" style={{ background: 'var(--nx-surface-high)', borderColor: 'var(--nx-border)' }}>
          {Array.from({ length: 5 }).flatMap((_, ri) => {
            const row = 4 - ri // haut = impact max
            return Array.from({ length: 5 }).map((__, col) => {
              const risk = (row + col) / 8
              const hue = 140 - risk * 140
              const here = byCell.get(`${row}-${col}`) ?? []
              return (
                <div key={`${row}-${col}`} className="relative rounded-sm" style={{ background: `hsla(${hue}, 65%, 45%, ${0.1 + risk * 0.5})` }}>
                  {here.map((r, i) => {
                    const sel = r.id === selectedId
                    return (
                      <button key={r.id} onClick={() => onSelect(r.id)} title={`${r.name} · ${r.score.toFixed(0)}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          top: `${30 + (i % 3) * 20}%`, left: `${30 + (Math.floor(i / 3) % 3) * 20}%`,
                          width: sel ? 14 : 8, height: sel ? 14 : 8,
                          background: sel ? CYAN : 'var(--nx-text)', opacity: sel ? 1 : 0.55,
                          boxShadow: sel ? '0 0 12px color-mix(in srgb, var(--nx-cyan) 80%, transparent)' : 'none',
                        }} />
                    )
                  })}
                </div>
              )
            })
          })}
        </div>
        <div className="mt-3 text-center" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Probabilité', 'Likelihood')}</div>
      </div>
    </div>
  )
}

/* ---------- Table ---------- */
function RiskTable({ rows, columns, selectedId, onSelect }: { rows: RiskRow[]; columns: string[]; selectedId?: string; onSelect: (id: string) => void }) {
  const { t } = useLang()
  const show = (k: string) => columns.includes(k)
  return (
    <div className="overflow-auto rounded-sm border" style={{ borderColor: 'var(--nx-border)', maxHeight: '26rem' }}>
      <table className="w-full text-left">
        <thead className="sticky top-0 z-10" style={{ background: 'var(--nx-surface-container)' }}>
          <tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
            {COLUMNS.filter((c) => show(c.key)).map((c) => (
              <th key={c.key} className={`px-3 py-2 ${c.right ? 'text-right' : ''}`} style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>
                {t(c.fr, c.en)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = BAND_COLOR[r.band]
            const sel = r.id === selectedId
            return (
              <tr key={r.id} onClick={() => onSelect(r.id)} className="cursor-pointer border-b transition-colors"
                style={{ borderColor: 'var(--nx-border)', background: sel ? 'var(--nx-surface-high)' : 'transparent', borderLeft: `2px solid ${sel ? CYAN : 'transparent'}` }}>
                {show('name') && <td className="px-3 py-3" style={{ fontSize: 13, fontWeight: 500, color: 'var(--nx-text)' }}>{r.name}{!r.hasRedundancy && r.directDependents > 0 && <span style={{ color: 'var(--nx-orange)', fontSize: 10 }}> · SPOF</span>}</td>}
                {show('type') && <td className="px-3 py-3" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{entityTypeLabel(r.entityType, t)}</td>}
                {show('band') && <td className="px-3 py-3"><span className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 11, color: c, background: `color-mix(in srgb, ${c} 20%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}>{bandLabel(r.band, t).toUpperCase()}</span></td>}
                {show('criticality') && <td className="px-3 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{r.effectiveCriticality}</td>}
                {show('blast') && <td className="px-3 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: c }}>{r.blastRadius}</td>}
                {show('dependents') && <td className="px-3 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{r.directDependents}</td>}
                {show('score') && <td className="px-3 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: c }}>{r.score.toFixed(0)}</td>}
                {show('status') && <td className="px-3 py-3" style={{ fontSize: 13, color: r.hasRedundancy ? 'var(--nx-text-muted)' : CYAN_T }}>{r.hasRedundancy ? t('Protégé', 'Protected') : t('Ouvert', 'Open')}</td>}
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-6" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>
              {t('Aucun actif ne correspond à ces critères.', 'No asset matches these criteria.')}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Les colonnes possibles, dans l'ordre où elles s'affichent. */
const COLUMNS: { key: string; fr: string; en: string; right?: boolean }[] = [
  { key: 'name', fr: 'Risque', en: 'Risk' },
  { key: 'type', fr: 'Actif', en: 'Asset' },
  { key: 'band', fr: 'Impact métier', en: 'Business impact' },
  { key: 'criticality', fr: 'Criticité', en: 'Criticality', right: true },
  { key: 'blast', fr: 'Propagation', en: 'Propagation', right: true },
  { key: 'dependents', fr: 'Dépendants', en: 'Dependents', right: true },
  { key: 'score', fr: 'Score', en: 'Score', right: true },
  { key: 'status', fr: 'Statut', en: 'Status' },
]

const DEFAULT_COLUMNS = ['name', 'type', 'band', 'blast', 'dependents', 'score', 'status']

/** Les critères appliqués aux lignes. Tout est facultatif : rien ne filtre tout. */
function applyRiskFilters(rows: RiskRow[], cfg: ViewConfig): RiskRow[] {
  const q = (cfg.search ?? '').trim().toLowerCase()
  const out = rows.filter((r) => {
    if (cfg.bands?.length && !cfg.bands.includes(r.band)) return false
    if (cfg.types?.length && !cfg.types.includes(r.entityType)) return false
    if (cfg.minCriticality != null && r.effectiveCriticality < cfg.minCriticality) return false
    if (cfg.minScore != null && r.score < cfg.minScore) return false
    if (cfg.redundancy === 'with' && !r.hasRedundancy) return false
    if (cfg.redundancy === 'without' && r.hasRedundancy) return false
    if (q && !r.name.toLowerCase().includes(q)) return false
    return true
  })
  const key = cfg.sort?.key
  if (!key) return out
  const dir = cfg.sort?.dir === 'asc' ? 1 : -1
  const value = (r: RiskRow) => key === 'name' ? r.name : key === 'criticality' ? r.effectiveCriticality
    : key === 'blast' ? r.blastRadius : key === 'dependents' ? r.directDependents : r.score
  return [...out].sort((a, b) => {
    const va = value(a), vb = value(b)
    return typeof va === 'string' || typeof vb === 'string'
      ? String(va).localeCompare(String(vb)) * dir
      : ((va as number) - (vb as number)) * dir
  })
}

/**
 * Les filtres du tableau. Chacun écrit dans le même objet de critères, celui
 * que la barre des vues enregistre : ce que l'on voit est exactement ce que l'on
 * garde.
 */
function RiskFilters({ cfg, types, onChange, count, total }: {
  cfg: ViewConfig; types: string[]; onChange: (c: ViewConfig) => void; count: number; total: number
}) {
  const { t } = useLang()
  const set = (patch: Partial<ViewConfig>) => onChange({ ...cfg, ...patch })
  const toggleType = (ty: string) => {
    const cur = cfg.types ?? []
    const next = cur.includes(ty) ? cur.filter((x) => x !== ty) : [...cur, ty]
    set({ types: next.length ? next : undefined })
  }
  const toggleColumn = (key: string) => {
    const cur = cfg.columns ?? DEFAULT_COLUMNS
    const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...COLUMNS.map((c) => c.key)].filter((k) => cur.includes(k) || k === key)
    if (next.length === 0) return
    set({ columns: next })
  }
  const chip = (on: boolean) => ({
    fontSize: 12, fontFamily: mono,
    color: on ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)',
    background: on ? CYAN : 'var(--nx-surface)',
    border: `1px solid ${on ? CYAN : 'var(--nx-border)'}`,
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>{t('Types', 'Types')}</span>
        {types.map((ty) => (
          <button key={ty} onClick={() => toggleType(ty)} className="rounded-sm px-2 py-0.5" style={chip((cfg.types ?? []).includes(ty))}>
            {entityTypeLabel(ty, t)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
          {t('Criticité minimale', 'Minimum criticality')}
          <input type="number" min={0} max={100} value={cfg.minCriticality ?? ''} placeholder="0"
            onChange={(e) => set({ minCriticality: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="w-16 rounded-sm border bg-transparent px-1.5 py-0.5 outline-none"
            style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 12 }} />
        </label>
        <label className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
          {t('Score minimal', 'Minimum score')}
          <input type="number" min={0} max={100} value={cfg.minScore ?? ''} placeholder="0"
            onChange={(e) => set({ minScore: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="w-16 rounded-sm border bg-transparent px-1.5 py-0.5 outline-none"
            style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 12 }} />
        </label>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Secours', 'Backup')}</span>
          {([['without', t('sans', 'without')], ['with', t('avec', 'with')]] as const).map(([v, label]) => (
            <button key={v} onClick={() => set({ redundancy: cfg.redundancy === v ? undefined : v })}
              className="rounded-sm px-2 py-0.5" style={chip(cfg.redundancy === v)}>{label}</button>
          ))}
        </div>
        <input value={cfg.search ?? ''} onChange={(e) => set({ search: e.target.value || undefined })}
          placeholder={t('Rechercher un actif…', 'Search an asset…')}
          className="min-w-40 flex-1 rounded-sm border bg-transparent px-2 py-1 outline-none"
          style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 12.5 }} />
        <button onClick={() => onChange({})} style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Tout effacer', 'Clear all')}</button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>{t('Colonnes', 'Columns')}</span>
        {COLUMNS.map((c) => (
          <button key={c.key} onClick={() => toggleColumn(c.key)} className="rounded-sm px-2 py-0.5"
            style={chip((cfg.columns ?? DEFAULT_COLUMNS).includes(c.key))}>{t(c.fr, c.en)}</button>
        ))}
        <span className="ml-auto" style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--nx-outline)' }}>
          {count} / {total} {t('actifs', 'assets')}
        </span>
      </div>
    </div>
  )
}

/* ---------- Panneau Priority Risk ---------- */
function PriorityRisk({ row, onClose, onSimulate, onView }: { row: RiskRow; onClose: () => void; onSimulate: () => void; onView: () => void }) {
  const { t } = useLang()
  const [actionOpen, setActionOpen] = useState(false)
  const risk = useQuery({ queryKey: ['risk', row.id], queryFn: () => api.entityRisk(row.id) })
  // Le détail qui manquait : les dépendances nommées, dans les deux sens. Un
  // score sans elles ne se vérifie pas, et ne se discute donc pas.
  const deps = useQuery({ queryKey: ['deps', row.id], queryFn: () => api.dependencies(row.id) })
  const dependents = useQuery({ queryKey: ['dependents', row.id], queryFn: () => api.dependents(row.id) })
  const c = BAND_COLOR[row.band]
  const breakdown = risk.data?.assessment.breakdown ?? []
  const factor = (name: string) => breakdown.find((b) => b.factor === name)?.value ?? 0
  const confidence = Math.round((1 - factor('Uncertainty')) * 100)

  const bars = [
    { label: t('Criticité', 'Criticality'), v: factor('Criticality') },
    { label: t('Propagation', 'Propagation'), v: factor('PropagationPotential') },
    { label: t('Concentration', 'Concentration'), v: factor('Concentration') },
    { label: t('Redondance', 'Redundancy'), v: row.hasRedundancy ? 1 : 0.2 },
  ]

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 rounded-sm border p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:w-[320px] lg:self-start lg:overflow-y-auto" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center justify-between">
        <h3 style={{ fontFamily: geist, fontSize: 18, fontWeight: 600, color: 'var(--nx-text)' }}>{t('Risque prioritaire', 'Priority Risk')}</h3>
        <button onClick={onClose} style={{ color: 'var(--nx-text-muted)' }}><X size={18} /></button>
      </div>

      {/* Score */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-sm border p-6" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <div className="absolute inset-0" style={{ background: `color-mix(in srgb, ${c} 6%, transparent)` }} />
        <span className="z-10" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Score de risque', 'Risk Score')}</span>
        <div className="z-10 mt-2 flex items-baseline gap-1">
          <span style={{ fontFamily: geist, fontSize: 64, lineHeight: 1, color: c }}>{row.score.toFixed(0)}</span>
          <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>/100</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="flex flex-col gap-3">
        <h4 className="border-b pb-1" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>{t('Décomposition détaillée', 'Detail Breakdown')}</h4>
        {bars.map((b) => {
          const pct = Math.round(b.v * 100)
          const bc = pct >= 70 ? 'var(--nx-danger)' : pct >= 40 ? 'var(--nx-orange)' : 'var(--nx-warning)'
          return (
            <div key={b.label} className="flex items-center justify-between">
              <span style={{ fontSize: 13, color: 'var(--nx-text)' }}>{b.label}</span>
              <div className="flex items-center gap-2">
                <div className="h-1 w-24 overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-highest)' }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: bc }} /></div>
                <span className="w-6 text-right" style={{ fontFamily: mono, fontSize: 12, color: bc }}>{pct}</span>
              </div>
            </div>
          )
        })}
        <div className="mt-2 flex items-center justify-between rounded-sm border p-2" style={{ background: 'var(--nx-surface-high)', borderColor: 'var(--nx-border)' }}>
          <span className="flex items-center gap-1" style={{ fontSize: 13, color: 'var(--nx-text)' }}><CheckCircle2 size={16} style={{ color: CYAN }} /> {t('Confiance', 'Confidence')}</span>
          <span style={{ fontFamily: mono, fontSize: 14, color: CYAN }}>{confidence}%</span>
        </div>
      </div>

      {/* Le détail nommé, dans les deux sens */}
      <div className="flex flex-col gap-3">
        <h4 className="border-b pb-1" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>
          {t('Ce dont il dépend', 'What it depends on')}
        </h4>
        {deps.data?.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{t('Rien n’est déclaré. Un actif isolé n’entre dans aucun chiffrage.', 'Nothing declared. An isolated asset enters no estimate.')}</span>}
        {(deps.data ?? []).slice(0, 8).map((d) => (
          <div key={d.target.id} className="flex items-baseline justify-between gap-2">
            <span style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>{d.target.name}</span>
            <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-outline)' }}>{relationTypeLabel(d.relationType, t)} · {Math.round(d.confidence * 100)} %</span>
          </div>
        ))}

        <h4 className="mt-2 border-b pb-1" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>
          {t('Ce qui tombe avec lui', 'What falls with it')}
        </h4>
        {dependents.data?.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{t('Personne n’en dépend directement.', 'Nothing depends on it directly.')}</span>}
        {(dependents.data ?? []).slice(0, 8).map((d) => (
          <div key={d.id} className="flex items-baseline justify-between gap-2">
            <span style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>{d.name}</span>
            <span style={{ fontFamily: mono, fontSize: 10.5, color: d.criticality >= 80 ? 'var(--nx-danger)' : 'var(--nx-outline)' }}>{entityTypeLabel(d.entityType, t)} · {d.criticality}</span>
          </div>
        ))}
        {(dependents.data?.length ?? 0) > 8 && (
          <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>
            {t(`et ${(dependents.data?.length ?? 0) - 8} autres`, `and ${(dependents.data?.length ?? 0) - 8} more`)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button onClick={onSimulate} className="flex w-full items-center justify-center gap-2 rounded-sm py-2" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 500 }}><Sparkles size={16} /> {t('Simuler', 'Simulate')}</button>
        <button onClick={() => setActionOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-sm border py-2" style={{ color: CYAN_T, borderColor: 'var(--nx-border)', fontSize: 13, fontWeight: 500 }}><ListPlus size={16} /> {t('Créer une action', 'Create Action')}</button>
        <button onClick={onView} className="flex w-full items-center justify-center gap-2 rounded-sm py-2" style={{ color: 'var(--nx-text-muted)', fontSize: 13, fontWeight: 500 }}><Network size={16} /> {t('Voir les dépendances', 'View Dependencies')}</button>
      </div>

      <ActionModal
        open={actionOpen}
        onClose={() => setActionOpen(false)}
        defaultTitle={t(`Réduire le risque sur ${row.name}`, `Reduce risk on ${row.name}`)}
        defaultTargetId={row.id}
        defaultTargetName={row.name}
        kind="remediation"
      />

      {row.hasRedundancy && (
        <div className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}><ShieldCheck size={13} /> {t('Redondance présente', 'Redundancy present')}</div>
      )}
    </aside>
  )
}
