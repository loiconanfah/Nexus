import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Background, BackgroundVariant, Handle, Panel, Position, ReactFlow, ReactFlowProvider,
  useReactFlow, type Edge, type Node, type NodeChange, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Boxes, ChevronsDownUp, ChevronsUpDown, Crosshair, Database, FileText, Group, Mail,
  Maximize2, Minimize2, Network, RotateCcw, ScanSearch, Server, Share2, SlidersHorizontal, Sparkles,
  Loader2, Users, Workflow, X,
} from 'lucide-react'
import { api } from '../lib/api'
import { layoutClustered, layoutGraph } from '../lib/layout'
import { useLang } from '../lib/i18n'
import { confidenceStatusLabel, entityTypeLabel, relationTypeLabel } from '../lib/labels'
import { SavedViews } from '../components/SavedViews'
import { notify } from '../lib/notify'
import { useMoney } from '../lib/money'
import type { GraphEntityRecord, ScopeSimulation, ViewConfig } from '../lib/types'

const Graph3D = lazy(() => import('../components/Graph3D').then((m) => ({ default: m.Graph3D })))

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = 'var(--nx-danger)'

function bandColor(crit: number): string {
  if (crit >= 80) return ERR
  if (crit >= 60) return 'var(--nx-high)'
  if (crit >= 40) return 'var(--nx-orange)'
  return 'var(--nx-cyan)'
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

type NodeData = { rec: GraphEntityRecord; dim: boolean; fixed?: boolean }

/** Une relation écrite par une correction déclarée (voir le journal des corrections). */
const FIXED = (e: { sourceSystem?: string | null }) => e.sourceSystem === 'Remediation'

function EntityNode({ data, selected }: NodeProps) {
  const { t } = useLang()
  const { rec, dim, fixed } = data as NodeData
  const c = bandColor(rec.criticality)
  return (
    <div
      className="rounded-sm transition-all"
      style={{
        width: 190,
        background: selected ? 'var(--nx-surface)' : 'var(--nx-surface-container)',
        border: `${selected ? 2 : 1}px solid ${fixed ? 'var(--nx-success)' : selected ? CYAN : 'var(--nx-border)'}`,
        borderLeft: `2px solid ${c}`,
        boxShadow: selected ? '0 0 15px color-mix(in srgb, var(--nx-cyan) 15%, transparent)' : 'none',
        opacity: dim ? 0.25 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--nx-border)', width: 6, height: 6 }} />
      <div className="flex items-center justify-between border-b p-2" style={{ borderColor: 'var(--nx-border)', background: selected ? 'color-mix(in srgb, var(--nx-cyan) 5%, transparent)' : 'rgba(42,42,43,0.4)' }}>
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

type ClusterData = { label: string; count: number }

/** Fond nommé d'une famille d'actifs. Purement visuel : ni cliquable, ni déplaçable. */
function ClusterNode({ data }: NodeProps) {
  const { label, count } = data as ClusterData
  return (
    <div className="h-full w-full rounded-md"
      style={{ border: '1px solid var(--nx-border)', background: 'color-mix(in srgb, var(--nx-surface) 55%, transparent)' }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-outline)' }}>{count}</span>
      </div>
    </div>
  )
}

const nodeTypes = { entity: EntityNode, cluster: ClusterNode }

function CommandBar({ selected, onSimulate }: { selected: string | null; onSimulate: () => void }) {
  const { t } = useLang()
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const Btn = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded px-3 py-1 transition-colors"
      style={{ fontSize: 13, fontWeight: 500, color: active ? CYAN_T : 'var(--nx-text-muted)', background: active ? 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)' : 'transparent', border: active ? '1px solid color-mix(in srgb, var(--nx-cyan) 30%, transparent)' : '1px solid transparent' }}
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
  const [view, setView] = useState<'flow' | 'holo'>('flow')
  // Mise en page : par familles (par défaut, lisible) ou selon le sens des dépendances.
  const [arrange, setArrange] = useState<'clusters' | 'flow'>('clusters')
  // Le plan n'est pas figé : ce que l'utilisateur déplace reste où il l'a mis.
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({})
  // Les critères du graphe courant, et la vue enregistrée qui les porte. Un
  // graphe entier est illisible passé quelques centaines d'éléments : une vue
  // nommée (« chaîne paiement », « périmètre agences ») est ce qui rend le plan
  // utilisable au quotidien.
  const [cfg, setCfg] = useState<ViewConfig>({})
  const [viewId, setViewId] = useState<string | null>(null)
  const [viewName, setViewName] = useState<string | null>(null)
  const [panel, setPanel] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [fs, setFs] = useState(false)

  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else canvasRef.current?.requestFullscreen?.()
  }

  // Focus depuis la recherche globale ou le Jumeau numérique (?focus=id).
  useEffect(() => {
    if (!focusId || !data) return
    const node = data.nodes.find((n) => n.id === focusId)
    if (node) { setSelected(node); setQuery(node.name) }
  }, [focusId, data])

  // 0) Le périmètre : ce que la vue retient, avant toute mise en page. Les liens
  //    dont une extrémité sort du périmètre sont écartés, sinon le plan
  //    afficherait des arêtes vers le vide.
  const scoped = useMemo(() => {
    if (!data) return null
    const types = cfg.types ?? []
    const rels = cfg.relationTypes ?? []
    const keep = data.nodes.filter((n) => {
      if (types.length && !types.includes(n.entityType)) return false
      if (cfg.minCriticality != null && n.criticality < cfg.minCriticality) return false
      return true
    })
    const ids = new Set(keep.map((n) => n.id))
    const edges = data.edges.filter((e) => {
      if (!ids.has(e.source) || !ids.has(e.target)) return false
      if (rels.length && !rels.includes(e.type)) return false
      if (cfg.minConfidence != null && e.confidence < cfg.minConfidence) return false
      return true
    })
    return { nodes: keep, edges }
  }, [data, cfg])

  // Chaque élément du périmètre mis en panne à son tour : le classement des
  // pires cas individuels, là où il fallait les essayer un par un.
  const scope = useMutation({
    mutationFn: () => api.simulateScope((scoped?.nodes ?? []).map((n) => n.id), viewName),
    onError: (e) => notify({ kind: 'error', title: t('Simulation impossible', 'Simulation failed'), message: (e as Error).message.slice(0, 160) }),
  })

  // 1) Mise en page STABLE (ne dépend que des données + recherche).
  const laidOut = useMemo(() => {
    if (!scoped) return { nodes: [] as Node[], edges: [] as Edge[] }
    const data = scoped
    const q = query.trim().toLowerCase()
    // Les éléments qu'une correction a touchés, pour les marquer eux aussi.
    const fixed = new Set<string>()
    for (const e of data.edges) if (FIXED(e)) { fixed.add(e.source); fixed.add(e.target) }
    const rfNodes: Node[] = data.nodes.map((n) => ({
      id: n.id, type: 'entity', position: { x: 0, y: 0 },
      data: { rec: n, dim: !!q && !n.name.toLowerCase().includes(q), fixed: fixed.has(n.id) } as NodeData,
    }))
    const rfEdges: Edge[] = data.edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      label: e.type === 'DEPENDS_ON' ? undefined : e.type,
      animated: true,
      // Une relation née d'une correction déclarée se voit en VERT, pleine et plus
      // épaisse : c'est la trace du travail fait, et le seul endroit où le plan
      // montre un progrès plutôt qu'un problème.
      style: FIXED(e)
        ? { stroke: 'var(--nx-success)', strokeWidth: 2.6, opacity: 0.95 }
        : { stroke: e.status === 'AiSuggested' ? 'var(--nx-orange)' : 'var(--nx-cyan)', strokeWidth: 1.5, opacity: e.confidence < 0.5 ? 0.4 : 0.65, strokeDasharray: e.status === 'AiSuggested' ? '4 3' : undefined },
      labelStyle: { fill: 'var(--nx-text-muted)', fontSize: 9, fontFamily: 'JetBrains Mono' },
      labelBgStyle: { fill: 'var(--nx-panel)' },
    }))
    if (arrange === 'flow') return { nodes: layoutGraph(rfNodes, rfEdges), edges: rfEdges }

    // Par familles : chaque type d'actif forme une grappe encadrée, au lieu de
    // colonnes alignées d'un bout à l'autre du plan.
    const { nodes: placed, clusters } = layoutClustered(rfNodes, rfEdges, (n) => (n.data as NodeData).rec.entityType)
    const frames: Node[] = clusters.map((c) => ({
      id: `cluster:${c.key}`, type: 'cluster', position: { x: c.x, y: c.y },
      data: { label: entityTypeLabel(c.key, t), count: c.count } as ClusterData,
      draggable: false, selectable: false, focusable: false, zIndex: -1,
      style: { width: c.width, height: c.height, pointerEvents: 'none' as const },
    }))
    return { nodes: [...frames, ...placed], edges: rfEdges }
  }, [scoped, query, arrange, t])

  // Un changement de mise en page ou de périmètre repart d'une disposition propre.
  useEffect(() => { setMoved({}) }, [arrange, scoped])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setMoved((prev) => {
      let next = prev
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position) {
          if (next === prev) next = { ...prev }
          next[ch.id] = ch.position
        }
      }
      return next
    })
  }, [])

  // 2) MISE EN AVANT à la sélection : le nœud + ses relations liées ressortent,
  //    le reste est atténué (lecture facilitée des courants). Léger (pas de re-layout).
  const { nodes, edges } = useMemo(() => {
    const selId = selected?.id ?? null
    if (!selId) return laidOut
    const neighbors = new Set<string>([selId])
    for (const e of laidOut.edges) {
      if (e.source === selId) neighbors.add(e.target)
      if (e.target === selId) neighbors.add(e.source)
    }
    const nodes = laidOut.nodes.map((n) => n.type === 'cluster' ? n : ({
      ...n, selected: n.id === selId,
      data: { ...(n.data as NodeData), dim: (n.data as NodeData).dim || !neighbors.has(n.id) } as NodeData,
    }))
    const edges = laidOut.edges.map((e) => {
      const conn = e.source === selId || e.target === selId
      return {
        ...e, animated: conn, zIndex: conn ? 10 : 0,
        // Le vert d'une correction résiste à la mise en avant : il dit un fait,
        // pas un état de sélection.
        style: {
          ...e.style,
          stroke: e.style?.stroke === 'var(--nx-success)' ? 'var(--nx-success)' : conn ? 'var(--nx-cyan)' : e.style?.stroke,
          strokeWidth: conn ? 2.4 : e.style?.strokeWidth ?? 1.5,
          opacity: conn ? 0.95 : 0.05,
        },
        labelStyle: { ...(e.labelStyle as object), opacity: conn ? 1 : 0.08 },
      }
    })
    return { nodes, edges }
  }, [laidOut, selected])

  // Positions déplacées à la main : elles priment sur la mise en page calculée.
  const placedNodes = useMemo(
    () => (Object.keys(moved).length === 0 ? nodes : nodes.map((n) => (moved[n.id] ? { ...n, position: moved[n.id] } : n))),
    [nodes, moved],
  )

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('CHARGEMENT DU GRAPHE…', 'LOADING GRAPH…')}</div>
  if (error) return <div style={{ color: ERR }}>{(error as Error).message}</div>
  if (!data || data.nodes.length === 0)
    return <div className="rounded-sm border p-6" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>{t('Le graphe est vide — importez des données depuis la Vue d’ensemble.', 'Graph is empty — import data from the Overview.')}</div>

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-2">
      {/* En-tête : bascule de vue + recherche */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex rounded-sm border p-0.5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
            <ViewTab active={view === 'flow'} onClick={() => setView('flow')} icon={<Network size={14} />} label={t('Plan 2D', '2D map')} />
            <ViewTab active={view === 'holo'} onClick={() => setView('holo')} icon={<Boxes size={14} />} label={t('Hologramme 3D', '3D hologram')} />
          </div>
          <div className="flex items-center gap-2 rounded px-2 py-1.5" style={{ background: 'var(--nx-panel)', border: '1px solid var(--nx-border)' }}>
            <ScanSearch size={14} style={{ color: 'var(--nx-text-muted)' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Trouver un nœud…', 'Find a node…')} className="w-40 bg-transparent outline-none" style={{ color: 'var(--nx-text)', fontSize: 13 }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-sm border p-0.5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
            <ViewTab active={arrange === 'clusters'} onClick={() => setArrange('clusters')} icon={<Group size={14} />} label={t('Par familles', 'By family')} />
            <ViewTab active={arrange === 'flow'} onClick={() => setArrange('flow')} icon={<Workflow size={14} />} label={t('Par dépendances', 'By dependency')} />
          </div>
          <span className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
            <span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--nx-success)' }} />
            {t('corrigé', 'fixed')}
          </span>
          {Object.keys(moved).length > 0 && (
            <button onClick={() => setMoved({})} className="flex items-center gap-1.5 rounded-sm border px-2 py-1.5"
              style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)', color: 'var(--nx-cyan-text)', fontSize: 12 }}>
              <RotateCcw size={13} /> {t('Replacer', 'Reset positions')}
            </button>
          )}
          <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
            {scoped?.nodes.length ?? 0} {t('nœuds', 'nodes')} · {scoped?.edges.length ?? 0} {t('liens', 'links')}
            {(scoped?.nodes.length ?? 0) !== data.nodes.length && (
              <span style={{ color: 'var(--nx-outline)' }}> {t('sur', 'of')} {data.nodes.length}</span>
            )}
          </span>
          <button onClick={toggleFullscreen} title={fs ? t('Quitter le plein écran', 'Exit fullscreen') : t('Plein écran', 'Fullscreen')}
            aria-label={fs ? t('Quitter le plein écran', 'Exit fullscreen') : t('Plein écran', 'Fullscreen')}
            className="flex h-8 w-8 items-center justify-center rounded-sm border transition-colors hover:brightness-125"
            style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)', color: 'var(--nx-cyan-text)' }}>
            {fs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Graphes personnalisés */}
      <div className="flex flex-col gap-2 rounded-sm border p-2.5" style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SavedViews kind="graph" current={{ ...cfg, arrange }} active={viewId}
            onActiveChange={(id) => { setViewId(id); if (id === null) setViewName(null) }}
            onApply={(c) => { setCfg(c); if (c.arrange) setArrange(c.arrange); setSelected(null); scope.reset() }}
            onName={setViewName} />
          <div className="flex items-center gap-2">
            <button onClick={() => scope.mutate()} disabled={scope.isPending || (scoped?.nodes.length ?? 0) === 0}
              className="flex items-center gap-1.5 rounded-sm px-2 py-1 disabled:opacity-50"
              style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 11.5, textTransform: 'uppercase' }}>
              {scope.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {t('Simuler ce périmètre', 'Simulate this scope')}
            </button>
            <button onClick={() => setPanel((v) => !v)} className="flex items-center gap-1.5 rounded-sm border px-2 py-1"
              style={{ borderColor: 'var(--nx-border)', color: CYAN_T, fontFamily: mono, fontSize: 11.5, textTransform: 'uppercase' }}>
              <SlidersHorizontal size={13} /> {panel ? t('Masquer les critères', 'Hide criteria') : t('Critères', 'Criteria')}
            </button>
          </div>
        </div>
        {panel && data && (
          <GraphCriteria cfg={cfg} onChange={setCfg} nodes={data.nodes} edges={data.edges}
            kept={scoped?.nodes.length ?? 0} links={scoped?.edges.length ?? 0} />
        )}
        {scope.data && <ScopeResults data={scope.data} onClose={() => scope.reset()} onOpen={(id, name) => navigate(`/simulations?asset=${id}&name=${encodeURIComponent(name)}`)} />}
      </div>

      {/* Canevas */}
      <div ref={canvasRef} className="relative flex-1 overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
        <div className="pointer-events-none absolute inset-0 z-0" style={{ background: 'radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--nx-cyan) 5%, transparent) 0%, transparent 60%)' }} />

        {view === 'flow' ? (
          <ReactFlow
            nodes={placedNodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.2}
            proOptions={{ hideAttribution: true }}
            onNodesChange={onNodesChange}
            nodesDraggable
            onNodeClick={(_, n) => { if (n.type !== 'cluster') setSelected((n.data as NodeData).rec) }}
            onPaneClick={() => setSelected(null)}
            style={{ background: 'var(--nx-panel)' }}
          >
            <Background variant={BackgroundVariant.Lines} gap={40} color="color-mix(in srgb, var(--nx-border) 15%, transparent)" />
            <Panel position="top-center"><CommandBar selected={selected?.id ?? null} onSimulate={() => selected && navigate(`/simulations?asset=${selected.id}&name=${encodeURIComponent(selected.name)}`)} /></Panel>
          </ReactFlow>
        ) : (
          <Suspense fallback={<div className="flex h-full items-center justify-center" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('CHARGEMENT DE L’HOLOGRAMME…', 'LOADING HOLOGRAM…')}</div>}>
            <Graph3D
              nodes={scoped?.nodes ?? []}
              edges={(scoped?.edges ?? []).map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, status: e.status, confidence: e.confidence, sourceSystem: e.sourceSystem }))}
              query={query}
              selectedId={selected?.id ?? null}
              onSelect={(id) => setSelected(data.nodes.find((n) => n.id === id) ?? null)}
            />
          </Suspense>
        )}

        {selected && <Inspector rec={selected} onClose={() => setSelected(null)} onAnalyze={() => navigate(`/simulations?asset=${selected.id}&name=${encodeURIComponent(selected.name)}`)} />}
      </div>
    </div>
  )
}

function ViewTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 transition-colors"
      style={{ fontSize: 12.5, fontWeight: 500, fontFamily: mono, letterSpacing: '0.02em',
        color: active ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', background: active ? CYAN : 'transparent' }}>
      {icon}{label}
    </button>
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
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>{t('Entité', 'Entity')} {entityTypeLabel(rec.entityType, t)}</span>
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
            <div key={d.target.id} className="flex items-center gap-3 rounded-sm border p-2" style={{ borderColor: 'color-mix(in srgb, var(--nx-border) 50%, transparent)', background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)' }}>
              <div className="flex h-6 w-6 items-center justify-center rounded-sm" style={{ background: 'var(--nx-surface-container)' }}>{typeIcon(d.target.entityType, 12)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ fontSize: 12, fontWeight: 500, color: 'var(--nx-text)' }}>{d.target.name}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{relationTypeLabel(d.relationType, t)} · {Math.round(d.confidence * 100)}% · {confidenceStatusLabel(d.status, t)}</div>
              </div>
            </div>
          )) : (
            <div className="flex items-center gap-3 rounded-sm border p-2" style={{ borderColor: 'color-mix(in srgb, var(--nx-border) 50%, transparent)' }}>
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
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--nx-cyan) 5%, transparent)' }}>
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


/**
 * Les critères d'un graphe personnalisé. Les types proposés sont ceux que le
 * graphe contient VRAIMENT, pas la liste théorique de l'ontologie : proposer un
 * filtre qui ne retient rien n'aide personne.
 */
function GraphCriteria({ cfg, onChange, nodes, edges, kept, links }: {
  cfg: ViewConfig
  onChange: (c: ViewConfig) => void
  nodes: GraphEntityRecord[]
  edges: { type: string }[]
  kept: number
  links: number
}) {
  const { t } = useLang()
  const types = useMemo(() => [...new Set(nodes.map((n) => n.entityType))].sort(), [nodes])
  const relTypes = useMemo(() => [...new Set(edges.map((e) => e.type))].sort(), [edges])
  const set = (patch: Partial<ViewConfig>) => onChange({ ...cfg, ...patch })
  const toggle = (key: 'types' | 'relationTypes', v: string) => {
    const cur = cfg[key] ?? []
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    set({ [key]: next.length ? next : undefined } as Partial<ViewConfig>)
  }
  const chip = (on: boolean) => ({
    fontSize: 11.5, fontFamily: mono,
    color: on ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)',
    background: on ? CYAN : 'var(--nx-surface)',
    border: `1px solid ${on ? CYAN : 'var(--nx-border)'}`,
  })

  return (
    <div className="flex flex-col gap-2 border-t pt-2" style={{ borderColor: 'var(--nx-border)' }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>{t('Types', 'Types')}</span>
        {types.map((ty) => (
          <button key={ty} onClick={() => toggle('types', ty)} className="rounded-sm px-2 py-0.5" style={chip((cfg.types ?? []).includes(ty))}>
            {entityTypeLabel(ty, t)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>{t('Liens', 'Links')}</span>
        {relTypes.map((rt) => (
          <button key={rt} onClick={() => toggle('relationTypes', rt)} className="rounded-sm px-2 py-0.5" style={chip((cfg.relationTypes ?? []).includes(rt))}>
            {relationTypeLabel(rt, t)}
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
          {t('Confiance minimale', 'Minimum confidence')}
          <input type="number" min={0} max={100} value={cfg.minConfidence != null ? Math.round(cfg.minConfidence * 100) : ''} placeholder="0"
            onChange={(e) => set({ minConfidence: e.target.value === '' ? undefined : Number(e.target.value) / 100 })}
            className="w-16 rounded-sm border bg-transparent px-1.5 py-0.5 outline-none"
            style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 12 }} />
        </label>
        <button onClick={() => onChange({})} style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Tout effacer', 'Clear all')}</button>
        <span className="ml-auto" style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--nx-outline)' }}>
          {kept} {t('nœuds', 'nodes')} · {links} {t('liens', 'links')}
        </span>
      </div>
    </div>
  )
}


/**
 * Le classement des pires pannes du périmètre. Chaque élément y a été mis en
 * panne ISOLÉMENT : ce n'est pas un scénario où tout tombe ensemble, et le dire
 * évite de faire passer une somme pour une prévision.
 */
function ScopeResults({ data, onClose, onOpen }: {
  data: ScopeSimulation
  onClose: () => void
  onOpen: (id: string, name: string) => void
}) {
  const { t } = useLang()
  const money = useMoney()
  return (
    <div className="flex flex-col gap-2 border-t pt-2" style={{ borderColor: 'var(--nx-border)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>
          {data.name
            ? t(`Pires pannes de « ${data.name} »`, `Worst outages in “${data.name}”`)
            : t('Pires pannes de ce périmètre', 'Worst outages in this scope')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
          {t(`${data.simulated} élément(s) simulé(s) séparément`, `${data.simulated} element(s) simulated separately`)}
          {data.truncated && t(`, sur ${data.requested} : les plus critiques d'abord`, `, of ${data.requested}: most critical first`)}
        </span>
        <button onClick={onClose} style={{ color: 'var(--nx-text-muted)' }}><X size={14} /></button>
      </div>
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--nx-border)', maxHeight: 220, overflowY: 'auto' }}>
        {data.results.map((r, i) => (
          <button key={r.id} onClick={() => onOpen(r.id, r.name)} className="flex items-baseline justify-between gap-3 py-1.5 text-left">
            <span className="flex min-w-0 items-baseline gap-2">
              <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>{i + 1}</span>
              <span className="truncate" style={{ fontSize: 13, color: 'var(--nx-text)' }}>{r.name}</span>
              <span className="truncate" style={{ fontSize: 11.5, color: 'var(--nx-text-muted)' }}>
                {r.affected} {t('touchés', 'affected')}{r.top.length > 0 && ` · ${r.top.join(', ')}`}
              </span>
            </span>
            <span className="shrink-0" style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: 'var(--nx-danger)' }}>
              {money.compact(r.hourlyCost)}<span style={{ color: 'var(--nx-text-muted)', fontWeight: 400 }}> /h</span>
            </span>
          </button>
        ))}
        {data.results.length === 0 && (
          <span className="py-2" style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>
            {t('Aucun élément de ce périmètre n’entraîne de cascade.', 'No element in this scope triggers a cascade.')}
          </span>
        )}
      </div>
    </div>
  )
}
