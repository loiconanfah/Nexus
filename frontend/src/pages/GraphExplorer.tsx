import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Background, Controls, Handle, MiniMap, Position, ReactFlow,
  type Edge, type Node, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Search, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { scoreColor } from '../lib/format'
import { layoutGraph } from '../lib/layout'
import { Badge, Button, Card, Spinner } from '../components/ui'

type EntityData = { label: string; entityType: string; criticality: number; dim: boolean }

function EntityNode({ data, selected }: NodeProps) {
  const d = data as EntityData
  return (
    <div
      className="rounded-lg border px-3 py-2 text-left transition-opacity"
      style={{
        width: 170,
        background: 'var(--color-surface-2)',
        borderColor: selected ? 'var(--color-brand)' : 'var(--color-border)',
        borderLeft: `4px solid ${scoreColor(d.criticality)}`,
        opacity: d.dim ? 0.25 : 1,
        boxShadow: selected ? '0 0 0 2px var(--color-brand-soft)' : 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-border)' }} />
      <div className="truncate text-sm font-medium" style={{ color: 'var(--color-text-strong)' }}>{d.label}</div>
      <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        <span>{d.entityType}</span>
        <span className="tabular-nums">crit {d.criticality}</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--color-border)' }} />
    </div>
  )
}

const nodeTypes = { entity: EntityNode }

export function GraphExplorer() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const types = useMemo(
    () => [...new Set(data?.nodes.map((n) => n.entityType) ?? [])].sort(),
    [data],
  )

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] }
    const q = query.trim().toLowerCase()

    const rfNodes: Node[] = data.nodes.map((n) => {
      const dim =
        (!!q && !n.name.toLowerCase().includes(q)) ||
        (!!typeFilter && n.entityType !== typeFilter)
      return {
        id: n.id,
        type: 'entity',
        position: { x: 0, y: 0 },
        data: { label: n.name, entityType: n.entityType, criticality: n.criticality, dim },
      }
    })

    const rfEdges: Edge[] = data.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.type === 'DEPENDS_ON' ? undefined : e.type,
      animated: e.type === 'DEPENDS_ON',
      style: {
        stroke: e.status === 'AI_SUGGESTED' ? 'var(--color-elevated)' : 'var(--color-border)',
        strokeDasharray: e.status === 'AI_SUGGESTED' ? '4 3' : undefined,
        opacity: e.confidence < 0.5 ? 0.4 : 0.8,
      },
      labelStyle: { fill: 'var(--color-text-muted)', fontSize: 10 },
    }))

    return { nodes: layoutGraph(rfNodes, rfEdges), edges: rfEdges }
  }, [data, query, typeFilter])

  if (isLoading) return <Spinner label="Chargement du graphe…" />
  if (error) return <div style={{ color: 'var(--color-critical)' }}>{(error as Error).message}</div>
  if (!data || data.nodes.length === 0)
    return <Card><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Graphe vide — importez des données depuis l'Overview.</p></Card>

  return (
    <div className="flex h-[calc(100vh-7.5rem)] gap-4">
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
        {/* Barre d'outils flottante */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-40 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-strong)' }}
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-sm outline-none"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <option value="">Tous les types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, n) => setSelected(n.id)}
          onPaneClick={() => setSelected(null)}
        >
          <Background color="var(--color-border)" gap={20} />
          <Controls style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => scoreColor((n.data as EntityData).criticality)}
            style={{ background: 'var(--color-surface)' }}
            maskColor="rgba(11,14,20,0.6)"
          />
        </ReactFlow>
      </div>

      {selected && <NodePanel id={selected} onClose={() => setSelected(null)} onSimulate={(id, name) => navigate(`/simulations?asset=${id}&name=${encodeURIComponent(name)}`)} />}
    </div>
  )
}

function NodePanel({ id, onClose, onSimulate }: { id: string; onClose: () => void; onSimulate: (id: string, name: string) => void }) {
  const entity = useQuery({ queryKey: ['entity', id], queryFn: () => api.entity(id) })
  const deps = useQuery({ queryKey: ['deps', id], queryFn: () => api.dependencies(id) })
  const dependents = useQuery({ queryKey: ['dependents', id], queryFn: () => api.dependents(id) })

  return (
    <Card className="flex w-80 shrink-0 flex-col overflow-auto">
      {entity.data && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg font-semibold" style={{ color: 'var(--color-text-strong)' }}>{entity.data.name}</div>
              <div className="mt-1 flex items-center gap-2"><Badge>{entity.data.entityType}</Badge><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>crit {entity.data.criticality}</span></div>
            </div>
            <button onClick={onClose} className="text-sm" style={{ color: 'var(--color-text-muted)' }}>✕</button>
          </div>

          {entity.data.aliases.length > 0 && (
            <div className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Alias : {entity.data.aliases.join(', ')}
            </div>
          )}

          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>Dépend de</div>
            {deps.data?.length ? deps.data.map((d) => (
              <div key={d.target.id} className="flex items-center justify-between py-0.5 text-sm">
                <span style={{ color: 'var(--color-text)' }}>{d.target.name}</span>
                <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{Math.round(d.confidence * 100)}%</span>
              </div>
            )) : <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</div>}
          </div>

          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>Dépendants ({dependents.data?.length ?? 0})</div>
            {dependents.data?.slice(0, 8).map((d) => (
              <div key={d.id} className="py-0.5 text-sm" style={{ color: 'var(--color-text)' }}>{d.name}</div>
            ))}
          </div>

          <div className="mt-4">
            <Button onClick={() => onSimulate(entity.data!.id, entity.data!.name)}>
              <Zap size={16} /> Simuler une panne
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
