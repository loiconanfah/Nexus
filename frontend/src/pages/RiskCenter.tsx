import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ListPlus, Network, ShieldCheck, Sparkles, X } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { entityTypeLabel, bandLabel } from '../lib/labels'
import { ActionModal } from '../components/ActionModal'
import type { RiskBand, RiskRow } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

const BAND_COLOR: Record<RiskBand, string> = {
  Critical: '#ffb4ab', High: '#fb923c', Elevated: '#facc15', Moderate: '#eab308', Low: '#00e5ff',
}
const TILES: { label: string; bands: RiskBand[]; color: string }[] = [
  { label: 'CRITICAL', bands: ['Critical'], color: '#ffb4ab' },
  { label: 'HIGH', bands: ['High'], color: '#fb923c' },
  { label: 'ELEVATED', bands: ['Elevated'], color: '#facc15' },
  { label: 'LOW', bands: ['Moderate', 'Low'], color: '#00e5ff' },
]

export function RiskCenter() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { data, isLoading, error } = useQuery({ queryKey: ['riskEntities'], queryFn: api.riskEntities })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bandFilter, setBandFilter] = useState<RiskBand[] | null>(null)

  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => b.score - a.score), [data])
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? rows[0], [rows, selectedId])
  const filtered = useMemo(() => (bandFilter ? rows.filter((r) => bandFilter.includes(r.band)) : rows), [rows, bandFilter])

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('ÉVALUATION DU RISQUE…', 'ASSESSING RISK…')}</div>
  if (error) return <div style={{ color: '#ffb4ab' }}>{(error as Error).message}</div>

  const tileLabel = (l: string) => l === 'CRITICAL' ? t('CRITIQUE', 'CRITICAL') : l === 'HIGH' ? t('ÉLEVÉ', 'HIGH') : l === 'ELEVATED' ? t('SURÉLEVÉ', 'ELEVATED') : t('FAIBLE', 'LOW')

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
            <button key={tile.label} onClick={() => setBandFilter(active ? null : tile.bands)}
              className="relative flex flex-col gap-1 overflow-hidden rounded-sm border p-3 text-left"
              style={{ background: 'var(--nx-surface-container)', borderColor: active ? tile.color : 'var(--nx-border)' }}>
              <span style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{tileLabel(tile.label)}</span>
              <span style={{ fontFamily: geist, fontSize: 28, fontWeight: 500, color: tile.color }}>{count}</span>
              <div className="absolute bottom-0 left-0 h-1 w-full" style={{ background: tile.color, opacity: active ? 1 : 0.5 }} />
            </button>
          )
        })}
      </div>

      {/* Zone dynamique */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Colonne centrale : matrice + table */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <RiskMatrix rows={rows} selectedId={selected?.id} onSelect={setSelectedId} />
          <RiskTable rows={filtered} selectedId={selected?.id} onSelect={setSelectedId} />
        </div>

        {/* Panneau Priority Risk */}
        {selected && <PriorityRisk row={selected} onClose={() => setBandFilter(null)} onSimulate={() => navigate(`/simulations?asset=${selected.id}&name=${encodeURIComponent(selected.name)}`)} onView={() => navigate('/graph')} />}
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
                          boxShadow: sel ? '0 0 12px rgba(0,229,255,0.8)' : 'none',
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
function RiskTable({ rows, selectedId, onSelect }: { rows: RiskRow[]; selectedId?: string; onSelect: (id: string) => void }) {
  const { t } = useLang()
  return (
    <div className="overflow-x-auto rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
            {[t('Risque', 'Risk'), t('Actif', 'Asset'), t('Impact métier', 'Business Impact'), t('Propagation', 'Propagation'), t('Dépendants', 'Dependents'), t('Score', 'Score'), t('Statut', 'Status')].map((h, i) => (
              <th key={h} className={`px-3 py-2 ${i >= 3 && i <= 5 ? 'text-right' : ''}`} style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{h}</th>
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
                <td className="px-3 py-3" style={{ fontSize: 13, fontWeight: 500, color: 'var(--nx-text)' }}>{r.name}{!r.hasRedundancy && r.directDependents > 0 && <span style={{ color: '#fb923c', fontSize: 10 }}> · SPOF</span>}</td>
                <td className="px-3 py-3" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{entityTypeLabel(r.entityType, t)}</td>
                <td className="px-3 py-3"><span className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 11, color: c, background: `color-mix(in srgb, ${c} 20%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}>{bandLabel(r.band, t).toUpperCase()}</span></td>
                <td className="px-3 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: c }}>{r.blastRadius}</td>
                <td className="px-3 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{r.directDependents}</td>
                <td className="px-3 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: c }}>{r.score.toFixed(0)}</td>
                <td className="px-3 py-3" style={{ fontSize: 13, color: r.hasRedundancy ? 'var(--nx-text-muted)' : CYAN_T }}>{r.hasRedundancy ? t('Protégé', 'Protected') : t('Ouvert', 'Open')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- Panneau Priority Risk ---------- */
function PriorityRisk({ row, onClose, onSimulate, onView }: { row: RiskRow; onClose: () => void; onSimulate: () => void; onView: () => void }) {
  const { t } = useLang()
  const [actionOpen, setActionOpen] = useState(false)
  const risk = useQuery({ queryKey: ['risk', row.id], queryFn: () => api.entityRisk(row.id) })
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
    <aside className="flex w-full shrink-0 flex-col gap-6 rounded-sm border p-5 lg:w-[320px]" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
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
          const bc = pct >= 70 ? '#ffb4ab' : pct >= 40 ? '#fb923c' : '#facc15'
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
