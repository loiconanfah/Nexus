import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Background, BackgroundVariant, Handle, Panel, Position, ReactFlow, ReactFlowProvider,
  useReactFlow, type Edge, type Node, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Boxes, ChevronsDownUp, ChevronsUpDown, Crosshair, Database, FileText, Mail,
  Network, ScanSearch, Server, Share2, Sparkles, Users, X,
} from 'lucide-react'
import { api } from '../lib/api'
import { layoutGraph } from '../lib/layout'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import type { GraphEntityRecord } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = '#ffb4ab'

function bandColor(crit: number): string {
  if (crit >= 80) return ERR
  if (crit >= 60) return '#ff897d'
  if (crit >= 40) return '#e08a3c'
  return '#00daf3'
}

function typeIcon(type: string, size = 14) {
  const t = type.toLowerCase()
  if (t.includes('process') || t.includes('service')) return <Share2 size={size} />
  if (t.includes('application') || t.includes('system')) return <Boxes size={size} />
  if (t.includes('database') || t.includes('store')) return <Database size={size} />
  if (t.includes('person')) return <Users size={size} />
  if (t.includes('supplier')) return <Users size={size} />
  return <Server size={size} />
}

type NodeData = { rec: GraphEntityRecord; dim: boolean }

function EntityNode({ data, selected }: NodeProps) {
  const { t } = useLang()
  const { rec, dim } = data as NodeData
  const c = bandColor(rec.criticality)
  return (
    <div
      className="rounded-sm transition-all"
      style={{
        width: 190,
        background: selected ? 'var(--nx-surface)' : 'var(--nx-surface-container)',
        border: `${selected ? 2 : 1}px solid ${selected ? CYAN : 'var(--nx-border)'}`,
        borderLeft: `2px solid ${c}`,
        boxShadow: selected ? '0 0 15px rgba(0,229,255,0.15)' : 'none',
        opacity: dim ? 0.25 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--nx-border)', width: 6, height: 6 }} />
      <div className="flex items-center justify-between border-b p-2" style={{ borderColor: 'var(--nx-border)', background: selected ? 'rgba(0,229,255,0.05)' : 'rgba(42,42,43,0.4)' }}>
        <div className="flex items-center gap-1.5" style={{ color: selected ? CYAN : 'var(--nx-text-muted)' }}>
          {typeIcon(rec.entityType)}
          <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase' }}>{entityTypeLabel(rec.entityType, t)}</span>
        </div>
        <span className="rounded px-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)', background: 'var(--nx-surface-highest)' }}>{rec.criticality}</span>
      </div>
      <div className="p-2.5">
        <div className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--nx-text)' }}>{rec.name}</div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span style={{ fontFamily: mono, fontSize: 10, color: c }}>{rec.criticality >= 80 ? t('CRITIQUE', 'CRITICAL') : rec.criticality >= 40 ? t('ÉLEVÉ', 'ELEVATED') : 'OK'}</span>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--nx-border)', width: 6, height: 6 }} />
    </div>
  )
}

const nodeTypes = { entity: EntityNode }

function CommandBar({ selected, onSimulate }: { selected: string | null; onSimulate: () => void }) {
  const { t } = useLang()
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const Btn = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded px-3 py-1 transition-colors"
      style={{ fontSize: 13, fontWeight: 500, color: active ? CYAN_T : 'var(--nx-text-muted)', background: active ? 'rgba(0,229,255,0.1)' : 'transparent', border: active ? '1px solid rgba(0,229,255,0.3)' : '1px solid transparent' }}
    >
      {icon}{label}
    </button>
  )
  return (
    <div className="flex gap-1 rounded p-1.5 shadow-lg" style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', border: '1px solid var(--nx-border)', backdropFilter: 'blur(8px)' }}>
      <Btn icon={<ChevronsUpDown size={15} />} label={t('Agrandir', 'Expand')} onClick={() => zoomIn()} />
      <Btn icon={<ChevronsDownUp size={15} />} label={t('Réduire', 'Collapse')} onClick={() => zoomOut()} />
      <div className="mx-1 my-auto h-4 w-px" style={{ background: 'var(--nx-border)' }} />
      <Btn icon={<ScanSearch size={15} />} label={t('Analyse d’impact', 'Impact Analysis')} active onClick={onSimulate} />
      <Btn icon={<Sparkles size={15} />} label={t('Simuler', 'Simulate')} onClick={onSimulate} />
      <Btn icon={<Crosshair size={15} />} label={t('Centrer', 'Focus')} onClick={() => fitView({ duration: 400 })} />
      {selected && <span className="sr-only">selected</span>}
    </div>
  )
}

function GraphInner() {
  const navigate = useNavigate()
  const { t } = useLang()
  const [searchParams] = useSearchParams()
  const focusId = searchParams.get('focus')
  const { data, isLoading, error } = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<GraphEntityRecord | null>(null)

  // Focus depuis la recherche globale ou le Jumeau numérique (?focus=id).
  useEffect(() => {
    if (!focusId || !data) return
    const node = data.nodes.find((n) => n.id === focusId)
    if (node) { setSelected(node); setQuery(node.name) }
  }, [focusId, data])

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] }
    const q = query.trim().toLowerCase()
    const rfNodes: Node[] = data.nodes.map((n) => ({
      id: n.id, type: 'entity', position: { x: 0, y: 0 },
      data: { rec: n, dim: !!q && !n.name.toLowerCase().includes(q) } as NodeData,
    }))
    const rfEdges: Edge[] = data.edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      label: e.type === 'DEPENDS_ON' ? undefined : e.type,
      animated: true,
      style: { stroke: e.status === 'AiSuggested' ? '#e08a3c' : '#00e5ff', strokeWidth: 1.5, opacity: e.confidence < 0.5 ? 0.4 : 0.65, strokeDasharray: e.status === 'AiSuggested' ? '4 3' : undefined },
      labelStyle: { fill: 'var(--nx-text-muted)', fontSize: 9, fontFamily: 'JetBrains Mono' },
      labelBgStyle: { fill: 'var(--nx-panel)' },
    }))
    return { nodes: layoutGraph(rfNodes, rfEdges), edges: rfEdges }
  }, [data, query])

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('CHARGEMENT DU GRAPHE…', 'LOADING GRAPH…')}</div>
  if (error) return <div style={{ color: ERR }}>{(error as Error).message}</div>
  if (!data || data.nodes.length === 0)
    return <div className="rounded-sm border p-6" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>{t('Le graphe est vide — importez des données depuis la Vue d’ensemble.', 'Graph is empty — import data from the Overview.')}</div>

  return (
    <div className="relative h-[calc(100vh-7rem)] overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
      {/* Glow de fond */}
      <div className="pointer-events-none absolute inset-0 z-0" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(0,229,255,0.05) 0%, transparent 60%)' }} />

      {/* Recherche */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded px-2 py-1.5" style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', border: '1px solid var(--nx-border)' }}>
        <Network size={14} style={{ color: 'var(--nx-text-muted)' }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Trouver un nœud…', 'Find a node…')} className="w-40 bg-transparent outline-none" style={{ color: 'var(--nx-text)', fontSize: 13 }} />
      </div>

      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.2}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => setSelected((n.data as NodeData).rec)}
        onPaneClick={() => setSelected(null)}
        style={{ background: 'var(--nx-panel)' }}
      >
        <Background variant={BackgroundVariant.Lines} gap={40} color="rgba(59,73,76,0.15)" />
        <Panel position="top-center"><CommandBar selected={selected?.id ?? null} onSimulate={() => selected && navigate(`/simulations?asset=${selected.id}&name=${encodeURIComponent(selected.name)}`)} /></Panel>
      </ReactFlow>

      {selected && <Inspector rec={selected} onClose={() => setSelected(null)} onAnalyze={() => navigate(`/simulations?asset=${selected.id}&name=${encodeURIComponent(selected.name)}`)} />}
    </div>
  )
}

function Inspector({ rec, onClose, onAnalyze }: { rec: GraphEntityRecord; onClose: () => void; onAnalyze: () => void }) {
  const { t } = useLang()
  const risk = useQuery({ queryKey: ['risk', rec.id], queryFn: () => api.entityRisk(rec.id) })
  const deps = useQuery({ queryKey: ['deps', rec.id], queryFn: () => api.dependencies(rec.id) })
  const dependents = useQuery({ queryKey: ['dependents', rec.id], queryFn: () => api.dependents(rec.id) })

  const confidence = useMemo(() => {
    const d = deps.data ?? []
    if (d.length === 0) return 100
    return Math.round((d.reduce((s, x) => s + x.confidence, 0) / d.length) * 100)
  }, [deps.data])

  const c = bandColor(rec.criticality)
  const score = risk.data?.assessment.score
  const band = risk.data?.assessment.band

  return (
    <div className="absolute bottom-0 right-0 top-0 z-40 flex w-[320px] flex-col border-l shadow-2xl" style={{ background: 'rgba(32,31,32,0.96)', borderColor: 'var(--nx-border)', backdropFilter: 'blur(12px)' }}>
      {/* Header */}
      <div className="border-b p-4" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="mb-1 flex items-start justify-between">
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: CYAN_T }}>{t('Entité', 'Entity')} {entityTypeLabel(rec.entityType, t)}</span>
          <button onClick={onClose} style={{ color: 'var(--nx-text-muted)' }}><X size={18} /></button>
        </div>
        <h2 style={{ fontFamily: geist, fontSize: 22, fontWeight: 500, color: 'var(--nx-text)' }}>{rec.name}</h2>
        <div className="mt-3 flex gap-2">
          {rec.criticality >= 80 && <Badge color={ERR}>{t('CRITIQUE', 'CRITICAL')}</Badge>}
          {band && <Badge color={c} dot>{band.toUpperCase()}</Badge>}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t('SCORE DE RISQUE', 'RISK SCORE')} value={score !== undefined ? score.toFixed(0) : '—'} suffix="/100" color={score !== undefined ? bandColor(score) : 'var(--nx-text)'} />
          <Stat label={t('CONFIANCE', 'CONFIDENCE')} value={String(confidence)} suffix="%" color={CYAN_T} />
          <div className="col-span-2 flex items-center justify-between rounded-sm border p-3" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>SOURCE</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--nx-text)' }}>{rec.sourceSystem ?? t('Non attribué', 'Unassigned')}</div>
            </div>
            <Mail size={16} style={{ color: CYAN_T }} />
          </div>
        </div>

        {/* Topology metrics */}
        <Section title={t('Métriques de topologie', 'Topology Metrics')}>
          <MetricRow label={t('Dépendances', 'Dependencies')} value={deps.data?.length ?? '…'} />
          <MetricRow label={t('Dépendants', 'Dependents')} value={dependents.data?.length ?? '…'} />
        </Section>

        {/* Evidence & sources */}
        <Section title={t('Preuves & sources', 'Evidence & Sources')}>
          {deps.data && deps.data.length > 0 ? deps.data.slice(0, 6).map((d) => (
            <div key={d.target.id} className="flex items-center gap-3 rounded-sm border p-2" style={{ borderColor: 'rgba(59,73,76,0.5)', background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)' }}>
              <div className="flex h-6 w-6 items-center justify-center rounded-sm" style={{ background: 'var(--nx-surface-container)' }}>{typeIcon(d.target.entityType, 12)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ fontSize: 12, fontWeight: 500, color: 'var(--nx-text)' }}>{d.target.name}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{d.relationType} · {Math.round(d.confidence * 100)}% · {d.status}</div>
              </div>
            </div>
          )) : (
            <div className="flex items-center gap-3 rounded-sm border p-2" style={{ borderColor: 'rgba(59,73,76,0.5)' }}>
              <div className="flex h-6 w-6 items-center justify-center rounded-sm" style={{ background: 'var(--nx-surface-container)' }}><FileText size={12} style={{ color: CYAN_T }} /></div>
              <div style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{rec.sourceSystem ?? t('Aucune dépendance amont', 'No upstream dependencies')}</div>
            </div>
          )}
        </Section>
      </div>

      {/* Footer */}
      <div className="border-t p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-container)' }}>
        <button onClick={onAnalyze} className="flex w-full items-center justify-center gap-2 rounded-sm py-2 transition-colors" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 500 }}>
          <ScanSearch size={16} /> {t('Analyser l’impact', 'Analyze Impact')}
        </button>
      </div>
    </div>
  )
}

function Badge({ children, color, dot }: { children: React.ReactNode; color: string; dot?: boolean }) {
  return (
    <span className="flex items-center gap-1 rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, color, background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {children}
    </span>
  )
}

function Stat({ label, value, suffix, color }: { label: string; value: string; suffix: string; color: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)', boxShadow: 'inset 0 0 0 1px rgba(0,229,255,0.05)' }}>
      <div className="mb-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 24, fontWeight: 600, color }}>{value}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--nx-text-muted)' }}>{suffix}</span></div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 border-b pb-1" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between rounded p-2" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
      <span>{label}</span>
      <span className="rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)', background: 'var(--nx-surface-high)' }}>{value}</span>
    </div>
  )
}

export function GraphExplorer() {
  return (
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  )
}
