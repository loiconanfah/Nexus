import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Database, Route, Search, X } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { relationTypeLabel } from '../lib/labels'
import type { GraphEdge, GraphEntityRecord } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = '#ffb4ab'

type T = (fr: string, en: string) => string
function critColor(v: number): string {
  if (v >= 80) return ERR
  if (v >= 60) return '#fb923c'
  if (v >= 40) return '#facc15'
  return '#849396'
}
function critBand(v: number, t: T): string {
  if (v >= 80) return t('Critique', 'Critical')
  if (v >= 60) return t('Élevé', 'High')
  if (v >= 40) return t('Modéré', 'Moderate')
  return t('Faible', 'Low')
}
function tier(v: number, t: T): { label: string; color: string } {
  if (v >= 80) return { label: t('Niveau 1 · Critique', 'Tier 1 · Critical'), color: ERR }
  if (v >= 60) return { label: t('Niveau 2 · Élevé', 'Tier 2 · High'), color: '#fb923c' }
  if (v >= 40) return { label: t('Niveau 3 · Modéré', 'Tier 3 · Moderate'), color: '#facc15' }
  return { label: t('Niveau 4 · Faible', 'Tier 4 · Low'), color: '#849396' }
}

interface Row { edge: GraphEdge; source?: GraphEntityRecord; target?: GraphEntityRecord }

export function DependencyIntelligence() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { data, isLoading, error } = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const [q, setQ] = useState('')
  const [onlyUnknown, setOnlyUnknown] = useState(false)
  const [selId, setSelId] = useState<string | null>(null)

  const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data])
  const rows = useMemo<Row[]>(() => {
    const query = q.trim().toLowerCase()
    return (data?.edges ?? [])
      .map((edge) => ({ edge, source: byId.get(edge.source), target: byId.get(edge.target) }))
      .filter((r) => !onlyUnknown || r.edge.status === 'Unknown' || r.edge.status === 'AiSuggested' || r.edge.confidence < 0.5)
      .filter((r) => !query || (r.source?.name.toLowerCase().includes(query) || r.target?.name.toLowerCase().includes(query) || r.edge.type.toLowerCase().includes(query)))
      .sort((a, b) => (b.target?.criticality ?? 0) - (a.target?.criticality ?? 0))
  }, [data, byId, q, onlyUnknown])

  const selected = rows.find((r) => r.edge.id === selId) ?? rows[0]
  const stats = useMemo(() => {
    const e = data?.edges ?? []
    return {
      total: e.length,
      verified: e.filter((x) => x.status === 'Verified').length,
      inferred: e.filter((x) => x.status === 'Inferred').length,
      unknown: e.filter((x) => x.status === 'Unknown' || x.status === 'AiSuggested').length,
      exposures: e.filter((x) => (byId.get(x.target)?.criticality ?? 0) >= 80 || x.confidence < 0.5).length,
    }
  }, [data, byId])

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('CARTOGRAPHIE DES DÉPENDANCES…', 'MAPPING DEPENDENCIES…')}</div>
  if (error) return <div style={{ color: ERR }}>{(error as Error).message}</div>

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>{t('Intelligence des dépendances', 'Dependency Intelligence')}</h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Comprenez ce qui dépend de quoi — et où l’organisation est exposée.', 'Understand what depends on what — and where the organization is exposed.')}</p>
        </div>
        <button onClick={() => setOnlyUnknown((v) => !v)} className="flex items-center gap-2 rounded-sm border px-3 py-1.5"
          style={{ borderColor: onlyUnknown ? CYAN : 'var(--nx-border)', color: onlyUnknown ? CYAN_T : 'var(--nx-text-muted)', background: onlyUnknown ? 'rgba(0,229,255,0.08)' : 'transparent', fontFamily: mono, fontSize: 12 }}>
          <Search size={14} /> {t('Découvrir les dépendances inconnues', 'Discover Unknown Dependencies')}
        </button>
      </div>

      {/* Tuiles */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Tile label={t('TOTAL DÉPENDANCES', 'TOTAL DEPENDENCIES')} value={stats.total} color="var(--nx-text)" />
        <Tile label={t('VÉRIFIÉES', 'VERIFIED')} value={stats.verified} color={CYAN_T} />
        <Tile label={t('INFÉRÉES', 'INFERRED')} value={stats.inferred} color="#facc15" />
        <Tile label={t('INCONNUES', 'UNKNOWN')} value={stats.unknown} color="#fb923c" />
        <Tile label={t('EXPOSITIONS CRITIQUES', 'CRITICAL EXPOSURES')} value={stats.exposures} color={ERR} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Table */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)', maxHeight: 'calc(100vh - 15rem)' }}>
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--nx-border)' }}>
            <Search size={14} style={{ color: 'var(--nx-text-muted)' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Filtrer les dépendances…', 'Filter dependencies…')} className="w-full bg-transparent outline-none" style={{ color: 'var(--nx-text)', fontSize: 13 }} />
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{rows.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--nx-surface-container)' }}>
                <tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
                  {[t('Nœud source', 'Source Node'), t('Relation', 'Relationship'), t('Nœud cible', 'Target Node'), t('Criticité', 'Criticality'), t('Confiance', 'Confidence')].map((h, i) => (
                    <th key={h} className={`px-3 py-2 ${i >= 3 ? 'text-right' : ''}`} style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const crit = r.target?.criticality ?? 0
                  const sel = selected?.edge.id === r.edge.id
                  const unknown = r.edge.status === 'Unknown' || r.edge.status === 'AiSuggested' || r.edge.confidence < 0.5
                  return (
                    <tr key={r.edge.id} onClick={() => setSelId(r.edge.id)} className="cursor-pointer border-b transition-colors"
                      style={{ borderColor: 'var(--nx-border)', background: sel ? 'var(--nx-surface-high)' : 'transparent', borderLeft: `2px solid ${sel ? CYAN : 'transparent'}` }}>
                      <td className="px-3 py-2.5" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{r.source?.name ?? '—'}</td>
                      <td className="px-3 py-2.5"><span style={{ fontFamily: mono, fontSize: 11, color: unknown ? '#fb923c' : 'var(--nx-text-muted)' }}>{relationTypeLabel(r.edge.type, t)}</span></td>
                      <td className="px-3 py-2.5" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{r.target?.name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right"><span className="rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: critColor(crit), background: `color-mix(in srgb, ${critColor(crit)} 18%, transparent)` }}>{critBand(crit, t)}</span></td>
                      <td className="px-3 py-2.5 text-right" style={{ fontFamily: mono, fontSize: 12, color: r.edge.confidence < 0.5 ? ERR : CYAN_T }}>{Math.round(r.edge.confidence * 100)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail */}
        {selected && <DependencyDetail row={selected} onTarget={() => navigate('/graph')} onMap={() => selected.target && navigate(`/simulations?asset=${selected.target.id}&name=${encodeURIComponent(selected.target.name)}`)} onClose={() => setSelId(null)} />}
      </div>
    </div>
  )
}

function DependencyDetail({ row, onTarget, onMap, onClose }: { row: Row; onTarget: () => void; onMap: () => void; onClose: () => void }) {
  const { t } = useLang()
  const { edge, source, target } = row
  const crit = target?.criticality ?? 0
  const ti = tier(crit, t)
  const conf = Math.round(edge.confidence * 100)
  const rel = relationTypeLabel(edge.type, t)
  const why = edge.evidence
    ? edge.evidence
    : t(
        `${source?.name ?? 'Source'} établit une relation « ${rel} » avec ${target?.name ?? 'la cible'}. Classée ${edge.status} à ${conf}% de confiance.`,
        `${source?.name ?? 'Source'} establishes a ${edge.type} relationship with ${target?.name ?? 'target'}. Classified ${edge.status.toLowerCase()} with ${conf}% confidence.`,
      )

  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 rounded-sm border p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:w-[340px] lg:self-start lg:overflow-y-auto" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center justify-between">
        <h3 style={{ fontFamily: geist, fontSize: 18, color: 'var(--nx-text)' }}>{t('Détail de la dépendance', 'Dependency Detail')}</h3>
        <button onClick={onClose} style={{ color: 'var(--nx-text-muted)' }}><X size={18} /></button>
      </div>

      <div className="flex items-center gap-2 rounded-sm border p-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
        <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{source?.name}</span>
        <ArrowRight size={14} style={{ color: CYAN }} />
        <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{rel}</span>
        <ArrowRight size={14} style={{ color: CYAN }} />
        <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{target?.name}</span>
      </div>

      <Section title={t('Pourquoi cette dépendance existe', 'Why this dependency exists')}>
        <p style={{ fontSize: 13, color: 'var(--nx-text)', lineHeight: 1.5 }}>{why}</p>
      </Section>

      <Section title={t('Sources de preuve', 'Evidence Sources')}>
        <div className="flex items-center gap-3 rounded-sm border p-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
          <div className="flex h-7 w-7 items-center justify-center rounded-sm" style={{ background: 'var(--nx-surface-highest)' }}><Database size={14} style={{ color: CYAN_T }} /></div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--nx-text)' }}>{edge.sourceSystem ?? t('Système de référence', 'System of record')}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{edge.status} · {t('traçabilité', 'data lineage')}</div>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-sm border p-3" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('CONFIANCE', 'CONFIDENCE')}</div>
          <div className="flex items-center gap-1" style={{ fontFamily: geist, fontSize: 22, fontWeight: 600, color: conf < 50 ? ERR : CYAN_T }}>{conf}%</div>
          <div className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}><CheckCircle2 size={11} /> {edge.status}</div>
        </div>
        <div className="rounded-sm border p-3" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('RAYON D’IMPACT', 'IMPACT RADIUS')}</div>
          <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: ti.color, marginTop: 4 }}>{ti.label}</div>
        </div>
      </div>

      {crit >= 60 && (
        <Section title={t('Risques associés', 'Related Risks')}>
          <div className="rounded-sm border p-3" style={{ borderColor: 'rgba(255,180,171,0.3)', background: 'color-mix(in srgb, #ffb4ab 8%, transparent)' }}>
            <div className="mb-1 flex items-center gap-1" style={{ color: ERR, fontFamily: mono, fontSize: 11 }}><AlertTriangle size={12} /> {t('RISQUE AMONT', 'UPSTREAM RISK')}</div>
            <p style={{ fontSize: 12, color: 'var(--nx-text)' }}>{t(`${target?.name} est un nœud ${critBand(crit, t).toLowerCase()}. Sa défaillance se propagerait à ${source?.name} et à ses dépendants.`, `${target?.name} is a ${critBand(crit, t).toLowerCase()} node. Its failure would propagate to ${source?.name} and dependents.`)}</p>
          </div>
        </Section>
      )}

      <div className="mt-auto flex gap-2">
        <button onClick={onTarget} className="flex flex-1 items-center justify-center gap-1 rounded-sm border py-2" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 11, textTransform: 'uppercase' }}>{t('Nœud cible', 'Target Node')}</button>
        <button onClick={onMap} className="flex flex-1 items-center justify-center gap-1 rounded-sm py-2" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 11, textTransform: 'uppercase' }}><Route size={13} /> {t('Tracer le chemin', 'Map Path')}</button>
      </div>
    </aside>
  )
}

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 26, fontWeight: 500, color }}>{value.toLocaleString()}</div>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 uppercase" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', color: 'var(--nx-text-muted)' }}>{title}</h4>
      {children}
    </div>
  )
}
