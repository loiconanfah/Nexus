import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Boxes, Brain, Database, Layers, MapPin, Play, Search, Server,
  ShieldAlert, Users,
} from 'lucide-react'
import { api } from '../lib/api'
import type { GraphEntityRecord } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = '#ffb4ab'

function bandColor(v: number): string {
  if (v >= 80) return ERR
  if (v >= 60) return '#fb923c'
  if (v >= 40) return '#facc15'
  return '#00daf3'
}
function typeIcon(t: string, size = 16) {
  const s = t.toLowerCase()
  if (s.includes('database') || s.includes('store')) return <Database size={size} />
  if (s.includes('application') || s.includes('service') || s.includes('system')) return <Boxes size={size} />
  if (s.includes('person') || s.includes('supplier')) return <Users size={size} />
  return <Server size={size} />
}

export function Assets() {
  const { data, isLoading } = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return (data?.nodes ?? [])
      .filter((n) => !query || n.name.toLowerCase().includes(query) || n.aliases.some((a) => a.toLowerCase().includes(query)))
      .sort((a, b) => b.criticality - a.criticality)
  }, [data, q])

  const selected = rows.find((r) => r.id === selId) ?? rows[0]

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>LOADING ASSETS…</div>

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
      {/* Liste */}
      <div className="flex w-72 shrink-0 flex-col border-r" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
        <div className="border-b p-3" style={{ borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center gap-2 rounded-sm border px-2 py-1.5" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
            <Search size={14} style={{ color: 'var(--nx-text-muted)' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assets…" className="w-full bg-transparent outline-none" style={{ color: 'var(--nx-text)', fontSize: 13 }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rows.map((n) => {
            const active = selected?.id === n.id
            return (
              <button key={n.id} onClick={() => setSelId(n.id)} className="flex w-full items-center justify-between border-b px-3 py-2.5 text-left transition-colors"
                style={{ borderColor: 'var(--nx-border)', background: active ? 'var(--nx-surface-high)' : 'transparent', borderLeftWidth: 2, borderLeftStyle: 'solid', borderLeftColor: active ? CYAN : 'transparent' }}>
                <div className="flex min-w-0 items-center gap-2">
                  <span style={{ color: active ? CYAN_T : 'var(--nx-text-muted)' }}>{typeIcon(n.entityType, 15)}</span>
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--nx-text)' }}>{n.name}</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{n.entityType}</div>
                  </div>
                </div>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: bandColor(n.criticality) }} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Détail */}
      <div className="min-w-0 flex-1 overflow-y-auto" style={{ background: 'var(--nx-panel)' }}>
        {selected ? <AssetDetail asset={selected} /> : <div className="p-6" style={{ color: 'var(--nx-text-muted)' }}>No assets. Import data from the Overview.</div>}
      </div>
    </div>
  )
}

function AssetDetail({ asset }: { asset: GraphEntityRecord }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('Overview')
  const risk = useQuery({ queryKey: ['risk', asset.id], queryFn: () => api.entityRisk(asset.id) })
  const deps = useQuery({ queryKey: ['deps', asset.id], queryFn: () => api.dependencies(asset.id) })
  const dependents = useQuery({ queryKey: ['dependents', asset.id], queryFn: () => api.dependents(asset.id) })

  const confidence = useMemo(() => {
    const d = deps.data ?? []
    return d.length === 0 ? 100 : Math.round((d.reduce((s, x) => s + x.confidence, 0) / d.length) * 100)
  }, [deps.data])

  const score = risk.data?.assessment.score
  const band = risk.data?.assessment.band
  const hasRedundancy = risk.data?.hasRedundancy ?? true
  const dependentCount = dependents.data?.length ?? 0
  const tabs = ['Overview', 'Dependencies', 'Dependents', 'Risks']

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full" style={{ background: bandColor(asset.criticality) }} />
              <h1 style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>{asset.name}</h1>
              {asset.criticality >= 80 && <span className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: ERR, background: 'rgba(255,180,171,0.15)', border: '1px solid rgba(255,180,171,0.3)' }}>CRITICAL</span>}
            </div>
            <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{asset.entityType} · {asset.sourceSystem ?? 'unknown source'}</p>
          </div>
          <div className="flex gap-6">
            <Stat label="RISK SCORE" value={score !== undefined ? score.toFixed(0) : '—'} suffix="/100" color={score !== undefined ? bandColor(score) : 'var(--nx-text)'} />
            <Stat label="CONFIDENCE" value={String(confidence)} suffix="%" color={CYAN_T} />
          </div>
        </div>
        {/* Tabs */}
        <div className="mt-4 flex gap-6 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className="whitespace-nowrap pb-2 transition-colors"
              style={{ fontSize: 13, color: tab === t ? CYAN_T : 'var(--nx-text-muted)', borderBottom: `2px solid ${tab === t ? CYAN : 'transparent'}` }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {tab === 'Overview' && (
          <>
            <div className="flex flex-col gap-4 lg:flex-row">
              {/* Properties */}
              <div className="w-full shrink-0 lg:w-72">
                <Panel title="Properties">
                  <Prop label="Type" value={<span className="flex items-center gap-2">{typeIcon(asset.entityType, 15)} {asset.entityType}</span>} />
                  <Prop label="Criticality" value={String(asset.criticality)} />
                  <Prop label="Location" value={<span className="flex items-center gap-2"><MapPin size={14} /> Unassigned</span>} />
                  <Prop label="Owner" value={<span className="flex items-center gap-2"><Users size={14} /> Unassigned</span>} />
                  <Prop label="Source" value={asset.sourceSystem ?? '—'} />
                  <Prop label="Aliases" value={asset.aliases.length ? asset.aliases.join(', ') : '—'} last />
                </Panel>
              </div>
              {/* Local topography */}
              <div className="min-h-[300px] flex-1">
                <Panel title="Local Topography" fill>
                  <LocalTopography name={asset.name} deps={(deps.data ?? []).map((d) => ({ name: d.target.name, crit: d.target.criticality }))} dependents={(dependents.data ?? []).map((d) => ({ name: d.name, crit: d.criticality }))} />
                </Panel>
              </div>
              {/* Intelligence */}
              <div className="w-full shrink-0 lg:w-80">
                <Panel title={<span className="flex items-center gap-2"><Brain size={15} style={{ color: CYAN }} /> Intelligence Center</span>}>
                  <div className="flex flex-col gap-3">
                    {!hasRedundancy && dependentCount > 0 && <Finding icon={<AlertTriangle size={15} />} color={ERR} title="Single point of failure" sub="SEV-1 STRUCTURAL" />}
                    {!hasRedundancy && <Finding icon={<ShieldAlert size={15} />} color={ERR} title="No verified secondary" sub="SEV-2 REDUNDANCY" />}
                    <Finding icon={<Layers size={15} />} color={CYAN} title={`Supports ${dependentCount} downstream asset(s)`} sub="IMPACT ANALYSIS" />
                    {band && (band === 'High' || band === 'Critical') && <Finding icon={<AlertTriangle size={15} />} color={ERR} title={`Elevated operational risk (${band})`} sub="RISK ENGINE" />}
                    {hasRedundancy && dependentCount === 0 && <Finding icon={<Layers size={15} />} color="#3fb27f" title="No structural risks detected" sub="NOMINAL" />}
                  </div>
                  <button onClick={() => navigate(`/simulations?asset=${asset.id}&name=${encodeURIComponent(asset.name)}`)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm py-2.5"
                    style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600, boxShadow: '0 0 10px rgba(0,229,255,0.2)' }}>
                    <Play size={16} /> Simulate Failure
                  </button>
                </Panel>
              </div>
            </div>

            {/* Evidence & lineage */}
            <div className="mt-4">
              <Panel title="Evidence & Data Lineage">
                <div className="flex flex-wrap gap-3">
                  {(deps.data ?? []).length > 0 ? (deps.data ?? []).slice(0, 6).map((d) => (
                    <div key={d.target.id} className="flex min-w-[200px] items-center gap-3 rounded-sm border px-3 py-2" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
                      <div className="flex h-6 w-6 items-center justify-center rounded-sm border" style={{ background: 'var(--nx-surface-highest)', borderColor: 'var(--nx-border)' }}>{typeIcon(d.target.entityType, 12)}</div>
                      <div className="min-w-0">
                        <div className="truncate" style={{ fontSize: 12, fontWeight: 500, color: 'var(--nx-text)' }}>{d.target.name}</div>
                        <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{d.relationType} · {Math.round(d.confidence * 100)}%</div>
                      </div>
                    </div>
                  )) : <div style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>Source: {asset.sourceSystem ?? 'unknown'} — no upstream dependencies.</div>}
                </div>
              </Panel>
            </div>
          </>
        )}

        {tab === 'Dependencies' && <EntityList title="Depends on" items={(deps.data ?? []).map((d) => ({ id: d.target.id, name: d.target.name, type: d.target.entityType, meta: `${d.relationType} · ${Math.round(d.confidence * 100)}% · ${d.status}` }))} />}
        {tab === 'Dependents' && <EntityList title="Depended on by" items={(dependents.data ?? []).map((d) => ({ id: d.id, name: d.name, type: d.entityType, meta: `criticality ${d.criticality}` }))} />}
        {tab === 'Risks' && (
          <Panel title="Risk Breakdown">
            {risk.data ? (
              <div className="flex flex-col gap-2">
                <div className="mb-2 flex items-baseline gap-2"><span style={{ fontFamily: geist, fontSize: 32, color: bandColor(risk.data.assessment.score) }}>{risk.data.assessment.score.toFixed(0)}</span><span style={{ color: 'var(--nx-text-muted)' }}>/100 · {risk.data.assessment.band}</span></div>
                {risk.data.assessment.breakdown.filter((b) => b.points > 0).map((b) => (
                  <div key={b.factor} className="flex items-center justify-between">
                    <span style={{ fontSize: 13, color: 'var(--nx-text)' }}>{b.factor}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-32 overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-highest)' }}><div className="h-full" style={{ width: `${b.value * 100}%`, background: bandColor(b.value * 100) }} /></div>
                      <span className="w-8 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{b.points.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ color: 'var(--nx-text-muted)' }}>Loading…</div>}
          </Panel>
        )}
      </div>
    </div>
  )
}

function LocalTopography({ name, deps, dependents }: { name: string; deps: { name: string; crit: number }[]; dependents: { name: string; crit: number }[] }) {
  const up = dependents.slice(0, 4)
  const down = deps.slice(0, 4)
  return (
    <div className="relative h-full min-h-[260px] w-full">
      <div className="nx-grid absolute inset-0" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {up.map((_, i) => { const x = 20 + (i * 60) / Math.max(1, up.length - 1 || 1); return <line key={`u${i}`} x1={x} y1={18} x2={50} y2={50} stroke="#00daf3" strokeWidth={0.4} strokeDasharray="2 1" opacity={0.5} /> })}
        {down.map((d, i) => { const x = 20 + (i * 60) / Math.max(1, down.length - 1 || 1); return <line key={`d${i}`} x1={50} y1={50} x2={x} y2={82} stroke={d.crit >= 80 ? ERR : '#00daf3'} strokeWidth={0.5} opacity={0.6} /> })}
        {up.map((u, i) => { const x = 20 + (i * 60) / Math.max(1, up.length - 1 || 1); return <g key={`nu${i}`}><circle cx={x} cy={18} r={1.6} fill="#849396" /><text x={x} y={14} textAnchor="middle" fill="var(--nx-text-muted)" fontFamily="JetBrains Mono" fontSize="3">{u.name}</text></g> })}
        {down.map((d, i) => { const x = 20 + (i * 60) / Math.max(1, down.length - 1 || 1); return <g key={`nd${i}`}><circle cx={x} cy={82} r={1.6} fill={d.crit >= 80 ? ERR : '#849396'} /><text x={x} y={88} textAnchor="middle" fill="var(--nx-text-muted)" fontFamily="JetBrains Mono" fontSize="3">{d.name}</text></g> })}
        <circle cx={50} cy={50} r={4} fill="var(--nx-surface-bright)" stroke={CYAN} strokeWidth={0.7} />
        <text x={50} y={57} textAnchor="middle" fill="var(--nx-text)" fontFamily="JetBrains Mono" fontSize="3.4" fontWeight="700">{name}</text>
      </svg>
      {up.length === 0 && down.length === 0 && <div className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>Isolated node</div>}
    </div>
  )
}

/* primitives */
function Panel({ title, children, fill }: { title: React.ReactNode; children: React.ReactNode; fill?: boolean }) {
  return (
    <div className={`rounded-sm border p-4 ${fill ? 'h-full' : ''}`} style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <h3 className="mb-3 uppercase" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', color: 'var(--nx-text-muted)' }}>{title}</h3>
      {children}
    </div>
  )
}
function Prop({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${last ? '' : 'mb-3 border-b border-dashed pb-3'}`} style={{ borderColor: 'var(--nx-border)' }}>
      <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--nx-text)' }}>{value}</span>
    </div>
  )
}
function Stat({ label, value, suffix, color }: { label: string; value: string; suffix: string; color: string }) {
  return (
    <div className="text-right">
      <div style={{ fontFamily: geist, fontSize: 26, fontWeight: 600, color }}>{value}<span style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{suffix}</span></div>
      <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</div>
    </div>
  )
}
function Finding({ icon, color, title, sub }: { icon: React.ReactNode; color: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 rounded-sm border p-3" style={{ background: 'var(--nx-surface)', borderColor: `color-mix(in srgb, ${color} 25%, transparent)` }}>
      <span className="mt-0.5" style={{ color }}>{icon}</span>
      <div><p style={{ fontSize: 13, fontWeight: 500, color: 'var(--nx-text)', lineHeight: 1.2 }}>{title}</p><p className="mt-1" style={{ fontFamily: mono, fontSize: 10, color }}>{sub}</p></div>
    </div>
  )
}
function EntityList({ title, items }: { title: string; items: { id: string; name: string; type: string; meta: string }[] }) {
  return (
    <Panel title={`${title} (${items.length})`}>
      {items.length === 0 ? <div style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>None.</div> : (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-sm border p-2" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--nx-text)' }}>{it.name} <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>· {it.type}</span></span>
              <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{it.meta}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
