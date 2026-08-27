import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitPullRequest, Search, ShieldCheck, ShieldAlert } from 'lucide-react'
import { api } from '../lib/api'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

function band(score: number) {
  if (score >= 80) return { label: 'HIGH RISK', color: '#ffb4ab' }
  if (score >= 60) return { label: 'ELEVATED', color: '#fb923c' }
  if (score >= 40) return { label: 'MODERATE', color: '#facc15' }
  return { label: 'LOW RISK', color: '#4ade80' }
}

export function ChangeImpact() {
  const { data: graph } = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const [selId, setSelId] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const nodes = useMemo(() => (graph?.nodes ?? []).slice().sort((a, b) => b.criticality - a.criticality), [graph])
  const filtered = nodes.filter((n) => n.name.toLowerCase().includes(q.toLowerCase()))
  const target = nodes.find((n) => n.id === selId)

  const { data: risk, isLoading: rl } = useQuery({ queryKey: ['risk', selId], queryFn: () => api.entityRisk(selId!), enabled: !!selId })
  const { data: dependents, isLoading: dl } = useQuery({ queryKey: ['dependents', selId], queryFn: () => api.dependents(selId!), enabled: !!selId })

  const changeScore = risk?.assessment.score ?? 0
  const b = band(changeScore)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <GitPullRequest size={22} style={{ color: CYAN }} /> Change Impact Analysis
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>Before you change, patch, or decommission a system — see exactly what breaks downstream.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Selecteur de systeme */}
        <div className="flex flex-col rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', maxHeight: 560 }}>
          <div className="relative flex items-center border-b p-2" style={{ borderColor: 'var(--nx-border)' }}>
            <Search size={14} className="absolute left-4" style={{ color: 'var(--nx-text-muted)' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Select a system to change…" className="w-full rounded-sm py-1.5 pl-8 pr-2 outline-none" style={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((n) => {
              const sel = n.id === selId
              return (
                <button key={n.id} onClick={() => setSelId(n.id)} className="flex w-full items-center justify-between px-3 py-2.5 text-left" style={{ background: sel ? 'var(--nx-surface-high)' : 'transparent', borderLeft: `2px solid ${sel ? CYAN : 'transparent'}` }}>
                  <span>
                    <span style={{ fontSize: 13, color: sel ? CYAN_T : 'var(--nx-text)' }}>{n.name}</span>
                    <span className="block" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{n.entityType}</span>
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: n.criticality >= 80 ? '#ffb4ab' : 'var(--nx-text-muted)' }}>c{n.criticality}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Analyse d'impact */}
        <div className="flex flex-col gap-4">
          {!target && <div className="flex h-full min-h-[300px] items-center justify-center rounded-sm border" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>← Select a system to assess change impact.</div>}
          {target && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', borderLeft: `3px solid ${b.color}` }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>Change target</div>
                  <h3 style={{ fontFamily: geist, fontSize: 22, color: 'var(--nx-text)' }}>{target.name}</h3>
                  <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{target.entityType} · criticality {target.criticality}</div>
                </div>
                <div className="text-center">
                  <div style={{ fontFamily: geist, fontSize: 40, lineHeight: 1, color: b.color }}>{rl ? '…' : changeScore.toFixed(0)}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: b.color }}>{b.label}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Metric label="DIRECT DEPENDENTS" value={risk?.directDependents ?? 0} />
                <Metric label="BLAST RADIUS" value={risk?.blastRadius ?? 0} color={CYAN_T} />
                <Metric label="EFFECTIVE CRIT." value={risk?.effectiveCriticality ?? 0} />
                <Metric label="REDUNDANCY" text={risk?.hasRedundancy ? 'YES' : 'NONE'} color={risk?.hasRedundancy ? '#4ade80' : '#ffb4ab'} />
              </div>

              <div className={`flex items-start gap-3 rounded-sm p-4`} style={{ background: risk?.hasRedundancy ? 'rgba(74,222,128,0.08)' : 'rgba(255,180,171,0.08)', border: `1px solid ${risk?.hasRedundancy ? '#4ade8040' : '#ffb4ab40'}` }}>
                {risk?.hasRedundancy ? <ShieldCheck size={18} style={{ color: '#4ade80', flexShrink: 0 }} /> : <ShieldAlert size={18} style={{ color: '#ffb4ab', flexShrink: 0 }} />}
                <p style={{ fontSize: 13, color: 'var(--nx-text)', lineHeight: 1.5 }}>
                  {risk?.hasRedundancy
                    ? `${target.name} has redundancy — a controlled change carries lower operational risk, but validate failover before proceeding.`
                    : `${target.name} has no redundancy and ${risk?.blastRadius ?? 0} system(s) in its blast radius. A change window should include a rollback plan and stakeholder notice.`}
                </p>
              </div>

              <div className="rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
                <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
                  <h4 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>Systems impacted by this change {dependents ? `(${dependents.length})` : ''}</h4>
                </div>
                <div className="flex flex-col divide-y" style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {dl && <div className="p-4" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>Computing downstream impact…</div>}
                  {dependents?.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderColor: 'var(--nx-border)' }}>
                      <span style={{ fontSize: 13, color: CYAN_T }}>{d.name} <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{d.entityType}</span></span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: d.criticality >= 80 ? '#ffb4ab' : 'var(--nx-text-muted)' }}>criticality {d.criticality}</span>
                    </div>
                  ))}
                  {dependents?.length === 0 && <div className="p-4" style={{ fontFamily: mono, fontSize: 12, color: '#4ade80' }}>No direct dependents — safe to change in isolation.</div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, text, color }: { label: string; value?: number; text?: string; color?: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 22, fontWeight: 500, color: color ?? 'var(--nx-text)' }}>{text ?? value}</div>
    </div>
  )
}
