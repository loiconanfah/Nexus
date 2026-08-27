import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertOctagon, AlertTriangle, ArrowRight, DownloadCloud, HelpCircle, History, Network,
  Package, PieChart, Radar,
} from 'lucide-react'
import { api } from '../lib/api'
import { importDemoData } from '../lib/demo'
import type { GraphData, Overview, PriorityItem } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = '#ffb4ab'
const HIGH = '#ff897d'

export function Dashboard() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({ queryKey: ['overview'], queryFn: api.overview })
  const graph = useQuery({ queryKey: ['graph'], queryFn: api.graph })

  const importDemo = useMutation({
    mutationFn: importDemoData,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overview'] }); qc.invalidateQueries({ queryKey: ['graph'] }) },
  })

  const empty = data && data.entityCount === 0

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>LOADING TELEMETRY…</div>
  if (error) return <ErrorBox message={(error as Error).message} />
  if (!data) return null

  if (empty) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-sm border p-14 text-center" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <div className="rounded-sm p-4" style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)' }}>
          <Network size={26} style={{ color: CYAN }} />
        </div>
        <div style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>No telemetry for this tenant</div>
        <p style={{ fontSize: 14, color: 'var(--nx-text-muted)' }}>Import the demo dataset to reveal the dependency graph, its risks and single points of failure.</p>
        <button
          onClick={() => importDemo.mutate()} disabled={importDemo.isPending}
          className="flex items-center gap-2 rounded-sm px-4 py-2.5"
          style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          <DownloadCloud size={16} /> {importDemo.isPending ? 'Importing…' : 'Load demo dataset'}
        </button>
        {importDemo.error && <ErrorBox message={(importDemo.error as Error).message} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <section className="flex flex-col items-start justify-between gap-4 border-b pb-4 lg:flex-row lg:items-end" style={{ borderColor: 'rgba(59,73,76,0.3)' }}>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: CYAN }} />
            <span style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: CYAN_T }}>Live Telemetry</span>
          </div>
          <h2 className="mb-1" style={{ fontFamily: geist, fontSize: 24, letterSpacing: '-0.01em', color: 'var(--nx-text)' }}>{greeting()}, Operations Team</h2>
          <p style={{ fontSize: 14, color: 'var(--nx-text-muted)' }}>
            Organization: NEXUS Tenant <span className="mx-2 opacity-50">|</span> Region: NA-EAST
          </p>
        </div>
        <ResiliencePanel score={data.organizationHealthScore} />
      </section>

      {/* Métriques */}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="CRIT_RISK" value={data.criticalRiskCount} color={ERR} accent={ERR} icon={<AlertOctagon size={14} />} />
        <Metric label="HIGH_RISK" value={data.highRiskCount} color={HIGH} accent={HIGH} icon={<AlertTriangle size={14} />} />
        <Metric label="CRIT_ASSET" value={data.criticalAssetCount} color="var(--nx-text)" accent="rgba(0,229,255,0.5)" icon={<Package size={14} />} />
        <Metric label="UNK_DEP" value={data.unknownDependencyCount} color="var(--nx-text)" accent="var(--nx-outline)" icon={<HelpCircle size={14} />} />
        <Metric label="SPOF_COUNT" value={data.spofCount} color={ERR} accent={ERR} icon={<Network size={14} />} />
        <Metric label="SUPP_CONC" value={`${data.supplierConcentrationPercent}%`} color={CYAN_T} accent={CYAN} icon={<PieChart size={14} />} />
      </section>

      {/* Grille principale */}
      <div className="grid min-h-[460px] grid-cols-1 gap-4 lg:grid-cols-4">
        <Topology graph={graph.data} onNode={(id, name) => navigate(`/simulations?asset=${id}&name=${encodeURIComponent(name)}`)} />
        <PriorityIntelligence items={data.priorityIntelligence} onInvestigate={() => navigate('/risks')} />
      </div>

      {/* Telemetry log */}
      <Telemetry data={data} />
    </div>
  )
}

/* ---------- Sous-composants ---------- */

function ResiliencePanel({ score }: { score: number }) {
  const color = score >= 75 ? '#3fb27f' : score >= 50 ? '#c8b040' : ERR
  return (
    <div className="flex items-center gap-4 rounded-sm border px-5 py-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div>
        <p className="mb-1" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>Operational Resilience</p>
        <div className="flex items-baseline gap-2">
          <span style={{ fontFamily: geist, fontSize: 32, lineHeight: 1, color }}>{score}</span>
          <span style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>/100</span>
        </div>
      </div>
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--nx-surface-high)" strokeWidth="3" />
        <circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 2 * Math.PI * 20} ${2 * Math.PI * 20}`} />
      </svg>
    </div>
  )
}

function Metric({ label, value, color, accent, icon }: { label: string; value: number | string; color: string; accent: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between rounded-sm border p-3" style={{ background: 'var(--nx-surface-high)', borderColor: 'var(--nx-border)', borderLeft: `2px solid ${accent}` }}>
      <span className="mb-4" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{label}</span>
      <div className="flex items-end justify-between">
        <span style={{ fontFamily: geist, fontSize: 24, color }}>{value}</span>
        <span style={{ color: accent }}>{icon}</span>
      </div>
    </div>
  )
}

const CLUSTER: { label: string; color: string; types: string[] }[] = [
  { label: 'Business Services', color: '#00e5ff', types: ['BusinessProcess', 'BusinessService'] },
  { label: 'Applications', color: '#a3defe', types: ['Application', 'Service', 'System'] },
  { label: 'Infrastructure', color: '#849396', types: ['Server', 'Database', 'Network', 'Device', 'CloudResource', 'DataStore', 'Infrastructure'] },
  { label: 'People (Risk)', color: '#ffb4ab', types: ['Person'] },
  { label: 'Suppliers', color: '#c8c5cb', types: ['Supplier'] },
]

function nodeColor(type: string): string {
  return CLUSTER.find((c) => c.types.includes(type))?.color ?? '#849396'
}

function Topology({ graph, onNode }: { graph?: GraphData; onNode: (id: string, name: string) => void }) {
  const layout = useMemo(() => {
    if (!graph) return null
    const nodes = graph.nodes.slice(0, 40)
    const idx = new Map(nodes.map((n, i) => [n.id, i]))
    const n = nodes.length || 1
    const cx = 50, cy = 50, R = 38
    const pos = nodes.map((node, i) => {
      // disposition en anneau, criticité vers le centre
      const ring = node.criticality >= 80 ? 0.45 : node.criticality >= 50 ? 0.72 : 1
      const a = (i / n) * 2 * Math.PI - Math.PI / 2
      return { node, x: cx + Math.cos(a) * R * ring, y: cy + Math.sin(a) * R * ring }
    })
    const edges = graph.edges
      .filter((e) => idx.has(e.source) && idx.has(e.target))
      .map((e) => ({ e, a: pos[idx.get(e.source)!], b: pos[idx.get(e.target)!] }))
    return { pos, edges }
  }, [graph])

  return (
    <section className="relative flex flex-col overflow-hidden rounded-sm border lg:col-span-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="absolute top-0 z-10 flex w-full items-center justify-between border-b p-3 backdrop-blur-sm" style={{ borderColor: 'var(--nx-border)', background: 'rgba(32,31,32,0.5)' }}>
        <div className="flex items-center gap-2">
          <Network size={14} style={{ color: 'var(--nx-text-muted)' }} />
          <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>ORG_DEPENDENCY_TOPOLOGY</span>
        </div>
        <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{graph?.nodes.length ?? 0} nodes · {graph?.edges.length ?? 0} edges</span>
      </div>

      <div className="relative h-full min-h-[420px] w-full" style={{ background: 'var(--nx-panel)' }}>
        <div className="nx-grid absolute inset-0" />
        {layout && (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {layout.edges.map(({ e, a, b }) => (
              <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3b494c" strokeWidth={0.15} opacity={e.confidence < 0.5 ? 0.4 : 0.8} />
            ))}
            {layout.pos.map(({ node, x, y }) => (
              <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => onNode(node.id, node.name)}>
                <circle cx={x} cy={y} r={node.criticality >= 80 ? 1.1 : 0.8} fill={nodeColor(node.entityType)} />
                <title>{node.name} · {node.entityType} · crit {node.criticality}</title>
              </g>
            ))}
          </svg>
        )}

        {/* Légende */}
        <div className="absolute bottom-4 left-4 space-y-2 rounded-sm border p-3 backdrop-blur" style={{ background: 'rgba(42,42,43,0.8)', borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 10 }}>
          <div className="mb-1 border-b pb-1" style={{ color: 'var(--nx-text-muted)', borderColor: 'rgba(59,73,76,0.5)' }}>NODE CLUSTERS</div>
          {CLUSTER.map((c) => (
            <div key={c.label} className="flex items-center gap-2" style={{ color: 'var(--nx-text)' }}>
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PriorityIntelligence({ items, onInvestigate }: { items: PriorityItem[]; onInvestigate: () => void }) {
  return (
    <section className="flex flex-col rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="mb-4 flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--nx-border)' }}>
        <Radar size={14} style={{ color: ERR }} />
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>Priority Intelligence</h3>
      </div>
      <div className="space-y-3 overflow-y-auto pr-1">
        {items.length === 0 && <p style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>No active priority alerts.</p>}
        {items.map((it, i) => {
          const c = it.severity === 'SEV_CRIT' ? ERR : it.severity === 'SEV_HIGH' ? HIGH : 'var(--nx-outline)'
          return (
            <div key={i} className="relative overflow-hidden rounded-sm border p-3" style={{ background: 'var(--nx-panel)', borderColor: it.severity === 'SEV_CRIT' ? 'rgba(255,180,171,0.3)' : 'var(--nx-border)' }}>
              <div className="absolute bottom-0 left-0 top-0 w-1" style={{ background: c }} />
              <div className="mb-2 flex items-start justify-between">
                <span className="rounded px-1.5" style={{ fontFamily: mono, fontSize: 10, background: `color-mix(in srgb, ${c} 20%, transparent)`, color: c }}>{it.severity}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>CONF: {it.confidence}%</span>
              </div>
              <p className="mb-3" style={{ fontSize: 13, color: 'var(--nx-text)' }}>{it.text}</p>
              <button onClick={onInvestigate} className="flex w-full items-center justify-center gap-1 rounded py-1" style={{ fontFamily: mono, fontSize: 12, color: CYAN_T, border: `1px solid ${it.severity === 'SEV_CRIT' ? 'rgba(0,229,255,0.4)' : 'var(--nx-border)'}` }}>
                Investigate <ArrowRight size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Telemetry({ data }: { data: Overview }) {
  const events = [
    { label: 'Health computed', kind: CYAN },
    { label: `${data.spofCount} SPOF detected`, kind: data.spofCount > 0 ? ERR : 'var(--nx-outline)' },
    { label: `${data.criticalAssetCount} critical assets`, kind: 'var(--nx-outline)' },
    { label: `${data.entityCount} entities mapped`, kind: 'var(--nx-outline)' },
    { label: `${data.unknownDependencyCount} unverified deps`, kind: 'var(--nx-outline)' },
  ]
  return (
    <section className="rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="mb-4 flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--nx-border)' }}>
        <History size={14} style={{ color: 'var(--nx-text-muted)' }} />
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>System Telemetry Log</h3>
      </div>
      <div className="relative flex h-16 items-center overflow-x-auto pb-2">
        <div className="absolute left-0 right-0 top-1/2 z-0 h-px -translate-y-1/2" style={{ background: 'var(--nx-border)' }} />
        <div className="z-10 flex w-max gap-12 px-4">
          {events.map((e, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="mb-1" style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)' }}>{i === 0 ? 'LIVE' : '—'}</span>
              <div className="h-3 w-3 rounded-full" style={{ background: 'var(--nx-surface)', border: `2px solid ${e.kind}` }} />
              <span className="mt-1 whitespace-nowrap" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text)' }}>{e.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-sm border p-3" style={{ borderColor: ERR, color: ERR, background: 'color-mix(in srgb, #ffb4ab 10%, transparent)', fontSize: 14 }}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div><div className="font-medium">API error</div><div style={{ color: 'var(--nx-text-muted)' }}>{message}</div></div>
    </div>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
