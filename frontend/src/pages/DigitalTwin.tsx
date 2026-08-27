import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Activity, Boxes, Cpu, Radio } from 'lucide-react'
import { api } from '../lib/api'
import type { GraphEntityRecord } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

function statusOf(crit: number, deg: number) {
  const eff = crit + deg
  if (eff >= 85) return { label: 'CRITICAL', color: '#ffb4ab' }
  if (eff >= 65) return { label: 'ELEVATED', color: '#fb923c' }
  if (eff >= 45) return { label: 'WATCH', color: '#facc15' }
  return { label: 'NOMINAL', color: '#4ade80' }
}

export function DigitalTwin() {
  const navigate = useNavigate()
  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: api.overview })
  const { data: graph, isLoading } = useQuery({ queryKey: ['graph'], queryFn: api.graph })

  // Degre entrant = nombre de dependants (poids operationnel dans le twin).
  const inDegree = useMemo(() => {
    const m = new Map<string, number>()
    graph?.edges.forEach((e) => m.set(e.target, (m.get(e.target) ?? 0) + 1))
    return m
  }, [graph])

  const grouped = useMemo(() => {
    const g: Record<string, GraphEntityRecord[]> = {}
    graph?.nodes.forEach((n) => { (g[n.entityType] ??= []).push(n) })
    Object.values(g).forEach((arr) => arr.sort((a, b) => b.criticality - a.criticality))
    return g
  }, [graph])

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>SYNCING OPERATIONAL TWIN…</div>
  if (!graph) return null

  const health = overview?.organizationHealthScore ?? 0
  const healthColor = health >= 75 ? '#4ade80' : health >= 50 ? '#facc15' : '#ffb4ab'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
            <Radio size={22} style={{ color: CYAN }} /> Operational Digital Twin
          </h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>A live mirror of your operational estate — each node reflects real criticality and dependency load.</p>
        </div>
        <div className="flex items-center gap-4 rounded-sm border px-5 py-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
          <div className="text-center">
            <div style={{ fontFamily: geist, fontSize: 30, lineHeight: 1, color: healthColor }}>{health}</div>
            <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)', textTransform: 'uppercase' }}>Health</div>
          </div>
          <div className="h-8 w-px" style={{ background: 'var(--nx-border)' }} />
          <Stat icon={Boxes} label="NODES" value={graph.nodes.length} />
          <Stat icon={Activity} label="LINKS" value={graph.edges.length} />
          <Stat icon={Cpu} label="SPOF" value={overview?.spofCount ?? 0} color="#ffb4ab" />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <div className="mb-2 flex items-center gap-2">
              <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: CYAN_T }}>{type}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>· {items.length}</span>
              <div className="h-px flex-1" style={{ background: 'var(--nx-border)' }} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((n) => {
                const deg = inDegree.get(n.id) ?? 0
                const st = statusOf(n.criticality, deg * 3)
                return (
                  <button key={n.id} onClick={() => navigate(`/graph?focus=${n.id}`)} className="group relative flex flex-col gap-1 rounded-sm border p-3 text-left transition-transform hover:-translate-y-0.5" style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}>
                    <div className="flex items-center justify-between">
                      <span className="nx-node-pulse inline-block h-2 w-2 rounded-full" style={{ background: st.color, boxShadow: `0 0 6px ${st.color}` }} />
                      <span style={{ fontFamily: mono, fontSize: 9, color: st.color }}>{st.label}</span>
                    </div>
                    <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--nx-text)' }} title={n.name}>{n.name}</span>
                    <div className="flex items-center justify-between" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>
                      <span>crit {n.criticality}</span>
                      <span>↓{deg} deps</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof Boxes; label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1" style={{ fontFamily: geist, fontSize: 20, color: color ?? 'var(--nx-text)' }}><Icon size={14} style={{ color: 'var(--nx-text-muted)' }} /> {value}</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}
