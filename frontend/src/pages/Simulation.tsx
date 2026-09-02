import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Bolt, ChevronDown, Plus, X, Trash2, Bug, ShieldAlert,
  Power, WifiOff, Database, Truck, CloudOff, UserMinus, Maximize2, Minimize2, GripVertical,
} from 'lucide-react'
import { api } from '../lib/api'

// Chargé à la demande : Three.js ne pèse que sur cette page.
const Graph3D = lazy(() => import('../components/Graph3D').then((m) => ({ default: m.Graph3D })))
import type { SimAction, SimCascade } from '../components/Graph3D'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import type { BlastNode, PropagationResult, ScenarioType, SimExplainPayload } from '../lib/types'
import { Sparkles } from 'lucide-react'

/** Agrège les KPIs d'un scénario à partir d'une liste de nœuds affectés. */
function aggregate(meta: { assetId: string; scenario: ScenarioType; currency: string }, affected: BlastNode[]): PropagationResult {
  const affectedByType: Record<string, number> = {}
  let impact = 0, perHour = 0, worst = 0, expected = 0, maxRec = 0, probSum = 0, maxDepth = 0
  const nodeDetails = affected.map((n) => {
    affectedByType[n.entity.entityType] = (affectedByType[n.entity.entityType] ?? 0) + 1
    impact += n.entity.criticality
    maxDepth = Math.max(maxDepth, n.depth)
    const cost = costPerHour(n.entity.criticality)
    const rto = rtoHours(n.entity.entityType, n.entity.criticality)
    const p = failureProbability(n.depth)
    const ni = Math.round(cost * rto)
    perHour += cost; worst += ni; expected += cost * rto * p; maxRec = Math.max(maxRec, rto); probSum += p
    return { id: n.entity.id, name: n.entity.name, type: n.entity.entityType, depth: n.depth, criticality: n.entity.criticality, hourlyCost: cost, rtoHours: rto, probability: p, nodeImpact: ni }
  })
  return {
    assetId: meta.assetId,
    scenario: meta.scenario,
    maxDepth: Math.max(1, maxDepth),
    affectedTotal: affected.length,
    affectedByType,
    estimatedOperationalImpact: impact,
    affected,
    estimatedFinancialImpactPerHour: perHour,
    worstCaseImpact: worst,
    expectedImpact: Math.round(expected),
    maxRecoveryHours: affected.length ? Math.round(maxRec * 10) / 10 : 0,
    avgProbability: affected.length ? Math.round((probSum / affected.length) * 100) / 100 : 0,
    currency: meta.currency,
    nodeDetails,
  }
}

/** Fusionne plusieurs résultats de propagation en un scénario composé (union). */
function mergeResults(results: PropagationResult[]): PropagationResult {
  const byId = new Map<string, BlastNode>()
  for (const r of results) {
    for (const node of r.affected) {
      const prev = byId.get(node.entity.id)
      if (!prev || node.depth < prev.depth) byId.set(node.entity.id, node)
    }
  }
  return aggregate({ assetId: results[0].assetId, scenario: results[0].scenario, currency: results[0].currency || 'CAD' }, [...byId.values()])
}

// Miroirs déterministes du modèle backend (BusinessImpactModel).
function costPerHour(c: number): number {
  if (c >= 90) return 50000
  if (c >= 80) return 25000
  if (c >= 70) return 15000
  if (c >= 60) return 10000
  if (c >= 40) return 3000
  if (c >= 20) return 800
  return 200
}
function rtoHours(type: string, crit: number): number {
  const b = ['Database', 'System', 'Infrastructure', 'DataStore'].includes(type) ? 8
    : ['Server', 'CloudResource', 'Network', 'Device'].includes(type) ? 6
    : ['Application', 'Service'].includes(type) ? 3
    : ['BusinessProcess', 'BusinessService', 'Process'].includes(type) ? 4
    : type === 'Supplier' ? 24 : type === 'Contract' ? 72
    : ['Person', 'Role', 'Team'].includes(type) ? 48 : type === 'Location' ? 12 : 6
  return Math.round(b * (0.75 + 0.5 * crit / 100) * 10) / 10
}
function failureProbability(depth: number): number {
  return Math.round(Math.min(1, Math.max(0.25, Math.pow(0.92, Math.max(0, depth)))) * 1000) / 1000
}

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = '#ffb4ab'
const ORANGE = '#fb923c'

const SCENARIOS: { value: ScenarioType; fr: string; en: string }[] = [
  { value: 'ServerFailure', fr: 'Défaillance infrastructure', en: 'Infrastructure Failure' },
  { value: 'DatabaseFailure', fr: 'Défaillance base de données', en: 'Database Failure' },
  { value: 'ApplicationFailure', fr: 'Défaillance application', en: 'Application Failure' },
  { value: 'NetworkFailure', fr: 'Défaillance réseau', en: 'Network Failure' },
  { value: 'SupplierFailure', fr: 'Défaillance fournisseur', en: 'Supplier Failure' },
  { value: 'CyberIncident', fr: 'Incident cyber', en: 'Cyber Incident' },
  { value: 'PowerOutage', fr: 'Panne électrique (datacenter)', en: 'Power Loss (Datacenter)' },
  { value: 'CloudRegionFailure', fr: 'Panne région cloud', en: 'Cloud Region Failure' },
  { value: 'EmployeeLoss', fr: 'Perte d’un employé clé', en: 'Key Employee Loss' },
  { value: 'DataLoss', fr: 'Perte de données', en: 'Data Loss' },
]

// 10 actions de simulation : chacune anime la cascade différemment et fixe le scénario.
const ACTIONS: { key: SimAction; fr: string; en: string; icon: typeof Bolt; color: string; scenario: ScenarioType }[] = [
  { key: 'fail', fr: 'Faire tomber', en: 'Fail', icon: Bolt, color: '#ff5a3c', scenario: 'ServerFailure' },
  { key: 'error', fr: 'Injecter une erreur', en: 'Inject error', icon: Bug, color: '#f5c542', scenario: 'ApplicationFailure' },
  { key: 'remove', fr: 'Supprimer', en: 'Remove', icon: Trash2, color: '#9aa7b0', scenario: 'ServerFailure' },
  { key: 'cyber', fr: 'Cyberattaque', en: 'Cyber attack', icon: ShieldAlert, color: '#ff4d8d', scenario: 'CyberIncident' },
  { key: 'power', fr: 'Panne électrique', en: 'Power outage', icon: Power, color: '#ffb03c', scenario: 'PowerOutage' },
  { key: 'network', fr: 'Coupure réseau', en: 'Network loss', icon: WifiOff, color: '#4ab8ff', scenario: 'NetworkFailure' },
  { key: 'data', fr: 'Perte de données', en: 'Data loss', icon: Database, color: '#b98aff', scenario: 'DataLoss' },
  { key: 'supplier', fr: 'Défaillance fournisseur', en: 'Supplier failure', icon: Truck, color: '#e0a44e', scenario: 'SupplierFailure' },
  { key: 'cloud', fr: 'Panne région cloud', en: 'Cloud region down', icon: CloudOff, color: '#4ae0d0', scenario: 'CloudRegionFailure' },
  { key: 'employee', fr: 'Perte employé clé', en: 'Key employee loss', icon: UserMinus, color: '#ff8ac6', scenario: 'EmployeeLoss' },
]

/**
 * Modèle d'impact PAR TYPE d'incident. Chaque action ne se propage pas de la même
 * façon : « affinité » par type d'entité (0 = épargné, 1 = plein impact) + portée
 * maximale (profondeur). Un incident logiciel ne grille pas un serveur ; une perte
 * d'employé n'éteint pas une base de données. C'est ce qui distingue les impacts
 * directs/indirects réels des simples liaisons visibles.
 */
type ImpactCard = { id: string; name: string; type: string; depth: number; criticality: number; euro: number; rto: number; prob: number; direct: boolean }
type Modeled = {
  result: PropagationResult; cards: ImpactCard[]
  spared: number; direct: number; indirect: number; affectedMap: Record<string, number>
}
const ACTION_MODEL: Record<SimAction, { reach: number; affDefault: number; aff: Record<string, number> }> = {
  // Panne / suppression : tout ce qui dépend de la cible tombe (profond).
  fail: { reach: 99, affDefault: 1, aff: { Supplier: 0.3, Person: 0.2, Role: 0.2, Team: 0.2, Contract: 0.3 } },
  remove: { reach: 99, affDefault: 1, aff: { Supplier: 0.4, Person: 0.2, Role: 0.2, Team: 0.2 } },
  // Erreur logicielle : reste dans la couche applicative, peu profonde.
  error: { reach: 2, affDefault: 0, aff: { Application: 1, Service: 1, System: 1, Database: 0.6, BusinessService: 0.7, BusinessProcess: 0.7, Process: 0.7 } },
  // Cyberattaque : données, identités, applicatif ; réseau moyen.
  cyber: { reach: 99, affDefault: 0.25, aff: { Application: 1, Service: 1, System: 1, Database: 1, DataStore: 1, Identity: 1, Credential: 1, Control: 1, Network: 0.6, BusinessService: 0.7, BusinessProcess: 0.7 } },
  // Panne électrique : tout ce qui est physiquement hébergé ; pas les fournisseurs externes.
  power: { reach: 99, affDefault: 0.2, aff: { Location: 1, Server: 1, Infrastructure: 1, Device: 1, Network: 1, System: 1, Database: 1, Application: 0.9, Service: 0.9, CloudResource: 0.3, BusinessService: 0.6, BusinessProcess: 0.6, Supplier: 0, Person: 0.1 } },
  // Coupure réseau : réseau + ce qui en dépend ; pas les contrats/personnes.
  network: { reach: 99, affDefault: 0.15, aff: { Network: 1, Application: 1, Service: 1, System: 1, CloudResource: 0.6, Database: 0.5, BusinessService: 0.7, BusinessProcess: 0.7, Supplier: 0.2, Person: 0, Contract: 0 } },
  // Perte de données : bases/stockage et applicatif dépendant ; pas l'infra réseau.
  data: { reach: 4, affDefault: 0, aff: { Database: 1, DataStore: 1, Application: 0.8, Service: 0.8, System: 0.7, BusinessService: 0.6, BusinessProcess: 0.6 } },
  // Défaillance fournisseur : contrats + services dépendants ; propagation plus lente.
  supplier: { reach: 99, affDefault: 0.2, aff: { Supplier: 1, Contract: 1, Application: 0.7, Service: 0.7, System: 0.7, BusinessService: 0.8, BusinessProcess: 0.8, Network: 0.4, CloudResource: 0.4, Person: 0.2 } },
  // Panne région cloud : ressources cloud + applicatif ; peu l'on-prem.
  cloud: { reach: 99, affDefault: 0.2, aff: { CloudResource: 1, Application: 0.9, Service: 0.9, System: 0.9, Database: 0.7, BusinessService: 0.7, BusinessProcess: 0.7, Network: 0.3, Server: 0.2, Supplier: 0 } },
  // Perte d'employé clé : personnes/équipes + processus métier ; peu la technique.
  employee: { reach: 3, affDefault: 0, aff: { Person: 1, Role: 1, Team: 1, BusinessProcess: 0.8, BusinessService: 0.8, Process: 0.8, Application: 0.3, Service: 0.3, System: 0.3 } },
}
function affinity(action: SimAction, type: string): number {
  const m = ACTION_MODEL[action]
  return m.aff[type] ?? m.affDefault
}
type OriginInfo = { id: string; name: string; entityType: string; criticality: number }

/** Applique le modèle d'impact d'une action à un résultat de propagation brut. */
function applyModel(result: PropagationResult, action: SimAction, origin?: OriginInfo): Modeled {
  const m = ACTION_MODEL[action]
  const kept = result.affected.filter((a) => a.depth <= m.reach && affinity(action, a.entity.entityType) > 0)
  const filtered = aggregate({ assetId: result.assetId, scenario: result.scenario, currency: result.currency || 'CAD' }, kept)
  const deps: ImpactCard[] = filtered.nodeDetails
    .map((n) => ({ id: n.id, name: n.name, type: n.type, depth: n.depth, criticality: n.criticality, euro: n.nodeImpact, rto: n.rtoHours, prob: n.probability, direct: n.depth <= 1 }))
    .sort((a, b) => (a.direct === b.direct ? b.criticality - a.criticality : a.direct ? -1 : 1))

  // L'ORIGINE est toujours le premier élément impacté (l'élément qui subit l'incident).
  let originEuro = 0
  const cards: ImpactCard[] = [...deps]
  if (origin) {
    const rto = rtoHours(origin.entityType, origin.criticality)
    originEuro = Math.round(costPerHour(origin.criticality) * rto)
    cards.unshift({ id: origin.id, name: origin.name, type: origin.entityType, depth: 0, criticality: origin.criticality, euro: originEuro, rto, prob: 1, direct: true })
  }

  const affectedMap: Record<string, number> = {}
  for (const n of filtered.nodeDetails) affectedMap[n.id] = n.depth

  // Totaux : on ajoute l'origine (elle est toujours touchée à 100 %).
  const withOrigin: PropagationResult = {
    ...filtered,
    affectedTotal: filtered.affectedTotal + (origin ? 1 : 0),
    worstCaseImpact: filtered.worstCaseImpact + originEuro,
    expectedImpact: filtered.expectedImpact + originEuro,
    maxRecoveryHours: Math.max(filtered.maxRecoveryHours, origin ? rtoHours(origin.entityType, origin.criticality) : 0),
    avgProbability: filtered.affected.length === 0 ? 1 : filtered.avgProbability,
  }
  return {
    result: withOrigin, cards,
    spared: result.affected.length - kept.length,
    direct: cards.filter((c) => c.direct).length,
    indirect: cards.filter((c) => !c.direct).length,
    affectedMap,
  }
}

export function Simulation() {
  const { t, lang } = useLang()
  const scenarioOptions = SCENARIOS.map((s) => ({ value: s.value, label: lang === 'fr' ? s.fr : s.en }))
  const [params] = useSearchParams()
  const rawAsset = params.get('asset') ?? ''
  const rawName = params.get('name') ?? ''
  const graph = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const [assetId, setAssetId] = useState<string>('')
  const [scenario, setScenario] = useState<ScenarioType>('ServerFailure')
  const [secondary, setSecondary] = useState<{ assetId: string; scenario: ScenarioType } | null>(null)
  const [depth, setDepth] = useState(6)
  const [result, setResult] = useState<PropagationResult | null>(null)
  // Impact MODÉLISÉ par le type d'action (sous-ensemble logiquement affecté + cartes).
  const [modeled, setModeled] = useState<Modeled | null>(null)
  // Cascade à animer dans l'hologramme (origine + dépendants par profondeur).
  const [sim, setSim] = useState<SimCascade | null>(null)
  const actionRef = useRef<SimAction>('fail')
  const nonceRef = useRef(0)
  const pendingScenarioRef = useRef<ScenarioType | null>(null)
  // Mode focus : masque les panneaux latéraux pour agrandir l'hologramme.
  const [focus, setFocus] = useState(false)

  const nodes = graph.data?.nodes ?? []
  const origin = nodes.find((n) => n.id === assetId)
  // assetId doit être un vrai identifiant de nœud (Guid) — sinon le backend refuse.
  const validTarget = !!origin

  const run = useMutation({
    mutationFn: async () => {
      const sc = pendingScenarioRef.current ?? scenario
      const primary = await api.simulate(assetId, sc, depth)
      if (!secondary?.assetId) return primary
      const second = await api.simulate(secondary.assetId, secondary.scenario, depth)
      return mergeResults([primary, second])
    },
    onSuccess: (r) => {
      const o = origin ? { id: origin.id, name: origin.name, entityType: origin.entityType, criticality: origin.criticality } : undefined
      const m = applyModel(r, actionRef.current, o)
      setResult(r); setModeled(m)
      nonceRef.current += 1
      setSim({ originId: assetId, affected: m.affectedMap, action: actionRef.current, nonce: nonceRef.current })
    },
  })

  // Déclenche une action sur le nœud ciblé et anime la cascade.
  function launch(action: SimAction) {
    if (!validTarget) return
    actionRef.current = action
    const cfg = ACTIONS.find((a) => a.key === action)
    if (cfg) { pendingScenarioRef.current = cfg.scenario; setScenario(cfg.scenario) }
    run.mutate()
  }


  // Résout le paramètre entrant (id direct OU nom) vers un vrai id de nœud ;
  // sinon présélectionne le premier actif. Corrige les liens qui passent un nom.
  useEffect(() => {
    if (!graph.data || assetId) return
    const resolved =
      nodes.find((n) => n.id === rawAsset) ??
      nodes.find((n) => n.name === rawAsset) ??
      nodes.find((n) => n.name === rawName) ??
      (!rawAsset && !rawName ? nodes[0] : undefined)
    if (resolved) setAssetId(resolved.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.data])

  // Auto-run uniquement quand une cible a été passée ET résolue en id valide.
  useEffect(() => {
    if (validTarget && (rawAsset || rawName) && !run.isPending && !result) run.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId])

  const impactById = modeled ? Object.fromEntries(modeled.cards.map((c) => [c.id, c.euro])) : undefined
  const rootClass = focus
    ? 'fixed inset-0 z-50 overflow-hidden'
    : 'relative h-[calc(100vh-7rem)] overflow-hidden rounded-sm border'

  return (
    <div className={rootClass} style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      {/* Hologramme plein-cadre (fond) */}
      <div className="nx-grid absolute inset-0" />
      {nodes.length > 0 ? (
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Chargement de l’hologramme…', 'Loading hologram…')}</div>}>
          <Graph3D
            nodes={nodes}
            edges={(graph.data?.edges ?? []).map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, status: e.status, confidence: e.confidence }))}
            selectedId={assetId}
            onSelect={(id) => { setAssetId(id); setResult(null); setModeled(null); setSim(null) }}
            sim={sim}
            impactById={impactById}
          />
        </Suspense>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-center" style={{ fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>
          {graph.isLoading ? t('CHARGEMENT DU GRAPHE…', 'LOADING GRAPH…') : t('Aucun graphe — importez des données', 'No graph — import data first')}
        </div>
      )}

      {/* Plein écran complet */}
      <button
        onClick={() => setFocus((f) => !f)}
        title={focus ? t('Quitter le plein écran', 'Exit fullscreen') : t('Plein écran', 'Fullscreen')}
        className="absolute left-1/2 top-3 z-40 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-sm border px-2.5 transition-colors hover:brightness-125"
        style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', color: 'var(--nx-cyan-text)', fontFamily: mono, fontSize: 11 }}
      >
        {focus ? <><Minimize2 size={14} /> {t('Réduire', 'Exit')}</> : <><Maximize2 size={14} /> {t('Plein écran', 'Fullscreen')}</>}
      </button>

      {/* Panneau CONFIG flottant & déplaçable */}
      <DraggablePanel title={t('Scénario', 'Scenario')} side="left" top={12} width={288}>
        <div className="flex flex-col gap-4 p-3">
          <Select label={t('Nœud d’origine cible', 'Target Origin Node')} value={assetId} onChange={setAssetId} options={nodes.map((n) => ({ value: n.id, label: `${n.name} · ${n.entityType}` }))} />
          <Select label={t('Profondeur d’analyse', 'Analysis depth')} value={String(depth)} onChange={(v) => setDepth(Number(v))} options={[{ value: '3', label: t('Court terme (3 sauts)', 'Short (3 hops)') }, { value: '6', label: t('Moyen terme (6 sauts)', 'Mid (6 hops)') }, { value: '10', label: t('Long terme (10 sauts)', 'Long (10 hops)') }]} />
          {secondary ? (
            <div className="flex flex-col gap-2 rounded-sm border p-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-container)' }}>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: ORANGE }}>{t('Événement secondaire', 'Secondary event')}</span>
                <button onClick={() => setSecondary(null)} style={{ color: 'var(--nx-text-muted)' }}><X size={14} /></button>
              </div>
              <Select label={t('Nœud', 'Node')} value={secondary.assetId} onChange={(v) => setSecondary({ ...secondary, assetId: v })} options={nodes.map((n) => ({ value: n.id, label: `${n.name} · ${n.entityType}` }))} />
              <Select label={t('Type', 'Type')} value={secondary.scenario} onChange={(v) => setSecondary({ ...secondary, scenario: v as ScenarioType })} options={scenarioOptions} />
            </div>
          ) : (
            <button onClick={() => setSecondary({ assetId: nodes.find((n) => n.id !== assetId)?.id ?? assetId, scenario: 'ApplicationFailure' })} className="flex h-8 items-center justify-center gap-2 rounded-sm border border-dashed" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}>
              <Plus size={14} /> {t('Événement secondaire', 'Secondary event')}
            </button>
          )}
          <p style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>
            {t('Cliquez un nœud dans l’hologramme, puis choisissez une perturbation en bas.', 'Click a node in the hologram, then pick a disruption below.')}
          </p>
        </div>
      </DraggablePanel>

      {/* Panneau IMPACT flottant & déplaçable */}
      {modeled && (
        <DraggablePanel title={t('Impact par élément', 'Impact by element')} side="right" top={52} width={340} onClose={() => { setModeled(null); setSim(null) }}>
          <ImpactPanel origin={origin?.name ?? 'origin'} originType={origin?.entityType ?? '—'} action={actionRef.current} modeled={modeled} />
        </DraggablePanel>
      )}
      {run.error && (
        <div className="absolute right-3 top-14 z-40 rounded-sm border px-3 py-2" style={{ borderColor: '#ffb4ab55', color: ERR, fontSize: 12, background: 'var(--nx-panel)' }}>{(run.error as Error).message}</div>
      )}

      {/* Barre d'actions flottante : 10 perturbations à appliquer sur le nœud ciblé */}
      {origin && (
        <div className="absolute bottom-4 left-1/2 z-30 flex max-w-[92%] -translate-x-1/2 flex-col items-center gap-1.5 rounded-lg border px-3 py-2 backdrop-blur"
          style={{ background: 'color-mix(in srgb, var(--nx-panel) 90%, transparent)', borderColor: 'var(--nx-border)' }}>
          <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-text-muted)' }}>
            {t('Cible', 'Target')} : <span style={{ color: 'var(--nx-text)' }}>{origin.name}</span>
            {run.isPending && <span style={{ color: CYAN }}> · {t('propagation…', 'propagating…')}</span>}
          </span>
          <div className="flex max-w-[860px] flex-wrap justify-center gap-1.5">
            {ACTIONS.map((a) => (
              <ActionBtn key={a.key} onClick={() => launch(a.key)} busy={run.isPending} showLabel={focus}
                icon={<a.icon size={15} />} label={t(a.fr, a.en)} color={a.color} active={actionRef.current === a.key && !!modeled} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Panneau flottant déplaçable par sa poignée (positionné dans l'hologramme). */
function DraggablePanel({ title, side, top, width, onClose, children }: {
  title: string; side: 'left' | 'right'; top: number; width: number; onClose?: () => void; children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const parent = el.offsetParent as HTMLElement | null
    const pw = parent?.clientWidth ?? window.innerWidth
    setPos({ x: side === 'right' ? Math.max(12, pw - el.offsetWidth - 12) : 12, y: top })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onMove(e: PointerEvent) {
    if (!drag.current) return
    setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy })
  }
  function onUp() {
    drag.current = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  function onDown(e: React.PointerEvent) {
    if (!pos) return
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div ref={ref} className="absolute z-30 flex flex-col rounded-lg border shadow-xl"
      style={{ left: pos?.x ?? (side === 'right' ? undefined : 12), right: pos ? undefined : (side === 'right' ? 12 : undefined), top: pos?.y ?? top, width, maxHeight: 'calc(100% - 96px)', background: 'color-mix(in srgb, var(--nx-panel) 95%, transparent)', borderColor: 'var(--nx-border)', backdropFilter: 'blur(6px)' }}>
      <div onPointerDown={onDown} className="flex shrink-0 cursor-move items-center justify-between gap-2 border-b px-3 py-2 select-none" style={{ borderColor: 'var(--nx-border)' }}>
        <span className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: CYAN_T }}>
          <GripVertical size={12} /> {title}
        </span>
        {onClose && <button onClick={onClose} title="×" style={{ color: 'var(--nx-text-muted)' }}><X size={14} /></button>}
      </div>
      <div className="overflow-y-auto">{children}</div>
    </div>
  )
}


function ImpactPanel({ origin, originType, action, modeled }: { origin: string; originType: string; action: SimAction; modeled: Modeled }) {
  const { t, lang } = useLang()
  const r = modeled.result
  const fmtMoney = (n: number) => new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 }).format(n)
  const act = ACTIONS.find((a) => a.key === action)
  const actColor = act?.color ?? ERR

  // Analyse IA : reformule le résultat en langage clair (repli déterministe sans clé).
  const explain = useMutation({ mutationFn: (p: SimExplainPayload) => api.explainSimulation(p) })
  useEffect(() => {
    explain.mutate({
      originName: origin, originType, action, actionLabel: act ? t(act.fr, act.en) : action,
      direct: modeled.direct, indirect: modeled.indirect, spared: modeled.spared,
      worstCase: r.worstCaseImpact, expected: r.expectedImpact, currency: r.currency,
      byType: r.affectedByType,
      topElements: modeled.cards.slice(0, 8).map((c) => ({ name: c.name, type: c.type, direct: c.direct, criticality: c.criticality })),
      lang,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeled])
  const ai = explain.data

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Incident */}
      <div className="flex items-center gap-3 rounded-md border p-3" style={{ borderColor: `color-mix(in srgb, ${actColor} 35%, transparent)`, background: `color-mix(in srgb, ${actColor} 8%, transparent)`, borderLeft: `3px solid ${actColor}` }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${actColor} 18%, transparent)`, color: actColor }}>
          {act ? <act.icon size={18} /> : null}
        </div>
        <div className="min-w-0">
          <div style={{ fontFamily: mono, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nx-text-muted)' }}>{t('Incident simulé', 'Simulated incident')}</div>
          <div className="truncate" style={{ fontFamily: geist, fontSize: 15, color: actColor }}>{act ? t(act.fr, act.en) : action}</div>
          <div className="truncate" style={{ fontSize: 11, color: 'var(--nx-text-muted)' }}>{originType} · {origin}</div>
        </div>
      </div>

      {/* Financier */}
      <div className="rounded-sm border p-4" style={{ background: 'rgba(255,180,171,0.06)', borderColor: 'rgba(255,180,171,0.35)' }}>
        <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Impact attendu (pondéré)', 'Expected impact (weighted)')}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span style={{ fontFamily: geist, fontSize: 30, lineHeight: 1, color: ERR }}>{fmtMoney(r.expectedImpact)}</span>
          <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{r.currency}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MiniKpi label={t('Pire cas', 'Worst case')} value={fmtMoney(r.worstCaseImpact)} sub={r.currency} />
          <MiniKpi label={t('Rétablissement', 'Recovery')} value={`${r.maxRecoveryHours}`} sub={t('h', 'h')} />
          <MiniKpi label={t('Probabilité', 'Probability')} value={`${Math.round(r.avgProbability * 100)}`} sub="%" />
        </div>
      </div>

      {/* Directs / indirects / épargnés */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label={t('DIRECTS', 'DIRECT')} value={modeled.direct} color={actColor} />
        <Metric label={t('INDIRECTS', 'INDIRECT')} value={modeled.indirect} color="var(--nx-text)" />
        <Metric label={t('ÉPARGNÉS', 'SPARED')} value={modeled.spared} color="#5a97a3" />
      </div>

      {/* Légende des liens de propagation */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--nx-text-muted)' }}>
        <span className="flex items-center gap-1.5"><span style={{ display: 'inline-block', width: 18, height: 3, borderRadius: 2, background: actColor }} /> {t('lien direct', 'direct link')}</span>
        <span className="flex items-center gap-1.5"><span style={{ display: 'inline-block', width: 18, height: 2, borderRadius: 2, background: 'var(--nx-outline)', opacity: 0.6 }} /> {t('lien indirect (cascade)', 'indirect link (cascade)')}</span>
      </div>

      {/* Analyse IA */}
      <div className="rounded-sm border p-3" style={{ borderColor: 'color-mix(in srgb, var(--nx-cyan) 30%, transparent)', background: 'color-mix(in srgb, var(--nx-cyan) 6%, transparent)' }}>
        <div className="mb-1 flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: CYAN_T }}>
          <Sparkles size={12} /> {t('Analyse IA', 'AI analysis')}{ai && !ai.usedAi && <span style={{ color: 'var(--nx-outline)' }}> · {t('repli', 'fallback')}</span>}
        </div>
        {explain.isPending ? (
          <p style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Analyse en cours…', 'Analyzing…')}</p>
        ) : ai ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--nx-text)', lineHeight: 1.5 }}>{ai.narrative}</p>
            {ai.risks.length > 0 && (
              <div className="mt-2">
                <div style={{ fontFamily: mono, fontSize: 9.5, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Risques', 'Risks')}</div>
                <ul className="mt-0.5 flex flex-col gap-0.5">
                  {ai.risks.map((x, i) => <li key={i} style={{ fontSize: 12, color: 'var(--nx-text)' }}>• {x}</li>)}
                </ul>
              </div>
            )}
            {ai.mitigations.length > 0 && (
              <div className="mt-2">
                <div style={{ fontFamily: mono, fontSize: 9.5, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Mitigations', 'Mitigations')}</div>
                <ol className="mt-0.5 flex flex-col gap-0.5">
                  {ai.mitigations.map((x, i) => <li key={i} style={{ fontSize: 12, color: 'var(--nx-text)' }}><span style={{ color: CYAN_T }}>{i + 1}.</span> {x}</li>)}
                </ol>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Cartes par élément */}
      <div className="flex flex-col gap-2">
        <h4 className="border-b pb-1" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>{t('Éléments impactés', 'Impacted elements')}</h4>
        {modeled.cards.length === 0 && <p style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Aucun élément logiquement impacté par ce type d’incident.', 'No element is logically impacted by this incident type.')}</p>}
        {modeled.cards.map((c, i) => <ImpactCardRow key={`${modeled.result.scenario}-${c.id}`} c={c} i={i} fmtMoney={fmtMoney} />)}
      </div>

      {modeled.spared > 0 && (
        <p style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>
          {t(`${modeled.spared} élément(s) dépendant(s) mais NON affecté(s) par ce type d’incident (impact logique, pas seulement topologique).`, `${modeled.spared} dependent element(s) but NOT affected by this incident type (logical impact, not just topological).`)}
        </p>
      )}
    </div>
  )
}

function ImpactCardRow({ c, i, fmtMoney }: { c: ImpactCard; i: number; fmtMoney: (n: number) => string }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const accent = c.depth === 0 ? '#ff3b30' : c.direct ? '#ff7a5c' : '#c69a4e'
  const tag = c.depth === 0 ? t('cible', 'target') : c.direct ? t('direct', 'direct') : t('indirect', 'indirect')
  const costPerH = c.rto > 0 ? Math.round(c.euro / c.rto) : c.euro
  const why = c.depth === 0
    ? t('Élément directement ciblé par l’incident — indisponibilité immédiate.', 'Element directly hit by the incident — immediate outage.')
    : c.direct
      ? t('Dépend directement de la cible : impact immédiat.', 'Depends directly on the target: immediate impact.')
      : t(`Touché par effet de cascade (profondeur ${c.depth}) : impact différé/atténué.`, `Hit by cascade effect (depth ${c.depth}): delayed/attenuated impact.`)

  return (
    <div className="overflow-hidden rounded-md border transition-colors" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-container)', borderLeft: `3px solid ${accent}`, animation: 'simCardIn 0.34s ease both', animationDelay: `${Math.min(i * 35, 700)}ms` }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 p-2.5 text-left hover:brightness-110">
        <span className="shrink-0 rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: '#04121a', background: critColorSim(c.criticality) }}>{c.criticality}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate" style={{ fontSize: 13, color: 'var(--nx-text)' }}>{c.name}</span>
            <span className="shrink-0 rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', color: accent, border: `1px solid ${accent}55` }}>{tag}</span>
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{entityTypeLabel(c.type, t)} · T+{c.depth}h · <span style={{ color: 'var(--nx-text)' }}>{fmtMoney(c.euro)} $</span></div>
        </div>
        <ChevronDown size={14} className="shrink-0 transition-transform" style={{ color: 'var(--nx-text-muted)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="border-t px-2.5 py-2" style={{ borderColor: 'var(--nx-border)' }}>
          <div className="grid grid-cols-3 gap-2">
            <Detail label={t('Coût / h', 'Cost / h')} value={`${fmtMoney(costPerH)} $`} />
            <Detail label={t('Rétablissement', 'Recovery')} value={`${c.rto} h`} />
            <Detail label={t('Probabilité', 'Probability')} value={`${Math.round(c.prob * 100)} %`} />
          </div>
          <div className="mt-2">
            <div className="mb-0.5 flex items-center justify-between" style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)' }}>
              <span>{t('Criticité', 'Criticality')}</span><span>{c.criticality}/100</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nx-border)' }}>
              <div className="h-full rounded-full" style={{ width: `${c.criticality}%`, background: critColorSim(c.criticality) }} />
            </div>
          </div>
          <p className="mt-2" style={{ fontSize: 12, color: 'var(--nx-text-muted)', lineHeight: 1.4 }}>{why}</p>
        </div>
      )}
    </div>
  )
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border p-1.5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
      <div style={{ fontFamily: mono, fontSize: 8.5, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 14, color: 'var(--nx-text)' }}>{value}</div>
    </div>
  )
}
function critColorSim(c: number): string {
  if (c >= 85) return '#d15b54'
  if (c >= 65) return '#e0a458'
  if (c >= 40) return '#4bb3c9'
  return '#8aa0ad'
}

/* ---------- primitives ---------- */
function ActionBtn({ onClick, busy, icon, label, color, active, showLabel }: { onClick: () => void; busy: boolean; icon: React.ReactNode; label: string; color: string; active?: boolean; showLabel?: boolean }) {
  return (
    <button
      onClick={onClick} disabled={busy} title={label} aria-label={label}
      className="flex h-9 items-center gap-1.5 rounded-md border px-2 transition-all hover:brightness-125 disabled:opacity-50"
      style={{
        borderColor: active ? color : `color-mix(in srgb, ${color} 45%, transparent)`,
        color, background: `color-mix(in srgb, ${color} ${active ? 22 : 10}%, transparent)`,
        boxShadow: active ? `0 0 10px color-mix(in srgb, ${color} 45%, transparent)` : 'none',
      }}
    >
      {icon}
      {showLabel && <span style={{ fontFamily: mono, fontSize: 11, whiteSpace: 'nowrap' }}>{label}</span>}
    </button>
  )
}

function Select({ label, value, onChange, options, danger }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; danger?: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <label style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full appearance-none rounded-sm border pl-3 pr-8 outline-none"
          style={{ background: danger ? '#2B1B1C' : 'var(--nx-surface-container)', border: `1px solid ${danger ? '#690005' : 'var(--nx-border)'}`, color: danger ? ERR : 'var(--nx-text)', fontFamily: mono, fontSize: 12 }}>
          {options.map((o) => <option key={o.value} value={o.value} style={{ background: 'var(--nx-surface)' }}>{o.label}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: danger ? ERR : 'var(--nx-text-muted)' }} />
      </div>
    </div>
  )
}

function MiniKpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-sm border p-2" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</div>
      <div className="flex items-baseline gap-0.5"><span style={{ fontFamily: geist, fontSize: 16, color: 'var(--nx-text)' }}>{value}</span><span style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)' }}>{sub}</span></div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 24, fontWeight: 600, color }}>{value}</div>
    </div>
  )
}
