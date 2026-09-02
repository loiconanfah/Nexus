import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  AlertOctagon, Bolt, ChevronDown, Plus, Wrench, X, Trash2, Bug, ShieldAlert,
  Power, WifiOff, Database, Truck, CloudOff, UserMinus, Maximize2, Minimize2,
} from 'lucide-react'
import { api } from '../lib/api'

// Chargé à la demande : Three.js ne pèse que sur cette page.
const Graph3D = lazy(() => import('../components/Graph3D').then((m) => ({ default: m.Graph3D })))
import type { SimAction, SimCascade } from '../components/Graph3D'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import type { BlastNode, PropagationResult, ScenarioType } from '../lib/types'

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

/** Recalcule le scénario en excluant des nœuds (what-if : « et si on protégeait X ? »). */
function recompute(result: PropagationResult, removed: Set<string>): PropagationResult {
  if (removed.size === 0) return result
  const affected = result.affected.filter((a) => !removed.has(a.entity.id))
  return aggregate({ assetId: result.assetId, scenario: result.scenario, currency: result.currency }, affected)
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

function depthColor(depth: number, max: number): string {
  if (depth <= 1) return ERR
  if (depth <= Math.ceil(max / 2)) return ORANGE
  return '#849396'
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
  // Nœuds retirés par l'utilisateur (what-if interactif) → impact recalculé.
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const shownResult = useMemo(() => (result ? recompute(result, removed) : null), [result, removed])
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
      setResult(r); setRemoved(new Set())
      const affected: Record<string, number> = {}
      for (const n of r.nodeDetails) affected[n.id] = n.depth
      nonceRef.current += 1
      setSim({ originId: assetId, affected, action: actionRef.current, nonce: nonceRef.current })
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

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
      {/* Context header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-6" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-container)' }}>
        <div className="flex items-baseline gap-4">
          <h1 style={{ fontFamily: geist, fontSize: 22, color: 'var(--nx-text)' }}>{t('ET SI ?', 'WHAT IF?')}</h1>
          <span className="hidden md:inline" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Simulez une perturbation opérationnelle avant qu’elle ne survienne.', 'Simulate operational disruption before it happens.')}</span>
        </div>
        <span className="flex items-center gap-1 rounded-sm border px-2 py-1" style={{ fontFamily: mono, fontSize: 12, borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: CYAN }} /> {t('MOTEUR PRÊT', 'ENGINE READY')}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ===== Config ===== */}
        <div className={`${focus ? 'hidden' : 'flex'} w-80 shrink-0 flex-col overflow-y-auto border-r`} style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
          <div className="border-b p-4" style={{ borderColor: 'var(--nx-border)' }}>
            <h3 className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN_T }}>
              <Bolt size={14} /> {t('Configuration du scénario', 'Scenario Configuration')}
            </h3>
          </div>
          <div className="flex flex-col gap-6 p-4">
            <div className="flex flex-col gap-4">
              <Select label={t('Nœud d’origine cible', 'Target Origin Node')} value={assetId} onChange={setAssetId} options={nodes.map((n) => ({ value: n.id, label: `${n.name} · ${n.entityType}` }))} />
              <Select label={t('Type de perturbation', 'Disruption Type')} value={scenario} onChange={(v) => setScenario(v as ScenarioType)} options={scenarioOptions} />
              <Select label={t('Profondeur d’analyse (fenêtre)', 'Analysis depth (window)')} value={String(depth)} onChange={(v) => setDepth(Number(v))} options={[{ value: '3', label: t('Court terme (3 sauts)', 'Short term (3 hops)') }, { value: '6', label: t('Moyen terme (6 sauts)', 'Mid term (6 hops)') }, { value: '10', label: t('Long terme (10 sauts)', 'Long term (10 hops)') }]} />
            </div>
            <div className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: 'var(--nx-border)' }}>
              <div className="flex items-center justify-between">
                <label style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Modificateurs en cascade', 'Cascading Modifiers')}</label>
                <span className="rounded border px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)', borderColor: 'var(--nx-border)' }}>{secondary ? t('1 actif', '1 Active') : t('0 actif', '0 Active')}</span>
              </div>
              {secondary && (
                <div className="flex flex-col gap-3 rounded-sm border p-3" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-container)' }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: ORANGE }}>{t('Événement secondaire', 'Secondary event')}</span>
                    <button onClick={() => setSecondary(null)} style={{ color: 'var(--nx-text-muted)' }}><X size={14} /></button>
                  </div>
                  <Select label={t('Nœud d’origine', 'Origin node')} value={secondary.assetId} onChange={(v) => setSecondary({ ...secondary, assetId: v })} options={nodes.map((n) => ({ value: n.id, label: `${n.name} · ${n.entityType}` }))} />
                  <Select label={t('Type de perturbation', 'Disruption type')} value={secondary.scenario} onChange={(v) => setSecondary({ ...secondary, scenario: v as ScenarioType })} options={scenarioOptions} />
                </div>
              )}
              {!secondary && (
                <button onClick={() => setSecondary({ assetId: nodes.find((n) => n.id !== assetId)?.id ?? assetId, scenario: 'ApplicationFailure' })} className="flex h-8 items-center justify-center gap-2 rounded-sm border border-dashed transition-colors" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}>
                  <Plus size={14} /> {t('Ajouter un événement', 'Add Secondary Event')}
                </button>
              )}
            </div>
          </div>
          <div className="mt-auto border-t p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
            <button
              onClick={() => launch('fail')} disabled={!validTarget || run.isPending}
              className="nx-pulse flex h-12 w-full items-center justify-center gap-2 rounded-sm transition-all disabled:opacity-50"
              style={{ background: 'transparent', border: `2px solid ${CYAN}`, color: CYAN_T, fontFamily: mono, fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              <Bolt size={18} /> {run.isPending ? t('En cours…', 'Running…') : t('Lancer la simulation', 'Run Simulation')}
            </button>
            <p className="mt-2" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>
              {t('Astuce : cliquez un nœud dans l’hologramme, puis agissez directement dessus.', 'Tip: click a node in the hologram, then act on it directly.')}
            </p>
          </div>
        </div>

        {/* ===== Hologramme interactif (cliquer un nœud → agir → cascade animée) ===== */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden" style={{ background: 'var(--nx-panel)' }}>
          <div className="nx-grid absolute inset-0" />

          {/* Agrandir : masque les panneaux latéraux */}
          <button
            onClick={() => setFocus((f) => !f)}
            title={focus ? t('Réduire', 'Shrink') : t('Agrandir l’hologramme', 'Enlarge hologram')}
            className="absolute left-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-sm border transition-colors hover:brightness-125"
            style={{ background: 'color-mix(in srgb, var(--nx-panel) 92%, transparent)', borderColor: 'var(--nx-border)', color: 'var(--nx-cyan-text)' }}
          >
            {focus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          {nodes.length > 0 ? (
            <Suspense fallback={<div className="z-10" style={{ fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Chargement de l’hologramme…', 'Loading hologram…')}</div>}>
              <Graph3D
                nodes={nodes}
                edges={(graph.data?.edges ?? []).map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, status: e.status, confidence: e.confidence }))}
                selectedId={assetId}
                onSelect={(id) => { setAssetId(id); setResult(null); setSim(null) }}
                sim={sim}
              />
            </Suspense>
          ) : (
            <div className="z-10 text-center" style={{ fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>
              {graph.isLoading ? t('CHARGEMENT DU GRAPHE…', 'LOADING GRAPH…') : t('Aucun graphe — importez des données', 'No graph — import data first')}
            </div>
          )}

          {/* Barre d'actions flottante : 10 perturbations à appliquer sur le nœud ciblé */}
          {origin && (
            <div className="absolute bottom-4 left-1/2 z-20 flex max-w-[92%] -translate-x-1/2 flex-col items-center gap-1.5 rounded-lg border px-3 py-2 backdrop-blur"
              style={{ background: 'color-mix(in srgb, var(--nx-panel) 90%, transparent)', borderColor: 'var(--nx-border)' }}>
              <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-text-muted)' }}>
                {t('Cible', 'Target')} : <span style={{ color: 'var(--nx-text)' }}>{origin.name}</span>
                {run.isPending && <span style={{ color: CYAN }}> · {t('propagation…', 'propagating…')}</span>}
              </span>
              <div className="flex max-w-[620px] flex-wrap justify-center gap-1.5">
                {ACTIONS.map((a) => (
                  <ActionBtn key={a.key} onClick={() => launch(a.key)} busy={run.isPending}
                    icon={<a.icon size={15} />} label={t(a.fr, a.en)} color={a.color} active={actionRef.current === a.key && !!result} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===== Résultats ===== */}
        <div className={`${focus ? 'hidden' : 'flex'} w-80 shrink-0 flex-col overflow-y-auto border-l`} style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
          <div className="border-b p-4" style={{ borderColor: 'var(--nx-border)' }}>
            <h3 style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Résultat de la simulation', 'Simulation Result')}</h3>
          </div>
          {shownResult ? <ResultPanel origin={origin?.name ?? 'origin'} result={shownResult} redundant={false} /> : (
            <div className="p-4" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Lancez une simulation pour voir l’analyse d’impact.', 'Run a simulation to see the impact analysis.')}</div>
          )}
          {run.error && <div className="p-4" style={{ color: ERR, fontSize: 13 }}>{(run.error as Error).message}</div>}
        </div>
      </div>
    </div>
  )
}


function ResultPanel({ origin, result, redundant }: { origin: string; result: PropagationResult; redundant: boolean }) {
  const { t, lang } = useLang()
  const byType = result.affectedByType
  const apps = (byType['Application'] ?? 0) + (byType['Service'] ?? 0) + (byType['System'] ?? 0)
  const procs = (byType['BusinessProcess'] ?? 0) + (byType['BusinessService'] ?? 0)
  const suppliers = byType['Supplier'] ?? 0

  const timeline = useMemo(() => {
    const evts: { d: number; label: string; sub?: string; c: string }[] = [{ d: 0, label: lang === 'fr' ? `Défaillance initiale : ${origin} hors service` : `Initial failure: ${origin} offline`, c: ERR }]
    ;[...result.nodeDetails].sort((a, b) => a.depth - b.depth).slice(0, 7).forEach((n) => {
      evts.push({
        d: n.depth,
        label: lang === 'fr' ? `${n.name} (${entityTypeLabel(n.type, t)}) impacté` : `${n.name} (${n.type}) impacted`,
        sub: lang === 'fr' ? `RTO ~${n.rtoHours} h · probabilité ${Math.round(n.probability * 100)} %` : `RTO ~${n.rtoHours}h · probability ${Math.round(n.probability * 100)}%`,
        c: depthColor(n.depth, result.maxDepth),
      })
    })
    return evts
  }, [result, origin, lang, t])

  const fmtMoney = (n: number) => new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 }).format(n)

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Impact financier réaliste (P1/P2 : RTO + probabilité) */}
      <div className="rounded-sm border p-4" style={{ background: 'rgba(255,180,171,0.06)', borderColor: 'rgba(255,180,171,0.35)' }}>
        <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Impact attendu (pondéré par la probabilité)', 'Expected impact (probability-weighted)')}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span style={{ fontFamily: geist, fontSize: 30, lineHeight: 1, color: ERR }}>{fmtMoney(result.expectedImpact)}</span>
          <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{result.currency}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MiniKpi label={t('Pire cas', 'Worst case')} value={`${fmtMoney(result.worstCaseImpact)}`} sub={result.currency} />
          <MiniKpi label={t('Rétablissement', 'Recovery')} value={`${result.maxRecoveryHours}`} sub={t('h', 'h')} />
          <MiniKpi label={t('Probabilité', 'Probability')} value={`${Math.round(result.avgProbability * 100)}`} sub="%" />
        </div>
        <div className="mt-2" style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-outline)' }}>{t('Modèle estimé : coût horaire × RTO par actif, pondéré par la probabilité de propagation', 'Estimate: hourly cost × per-asset RTO, weighted by propagation probability')}</div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Metric label={t('ACTIFS AFFECTÉS', 'AFFECTED ASSETS')} value={result.affectedTotal} color={ERR} />
        <Metric label={t('APPLICATIONS', 'APPLICATIONS')} value={apps} color="var(--nx-text)" />
        <Metric label={t('PROCESSUS CRIT.', 'CRIT PROCESS')} value={procs} color={ORANGE} />
        <Metric label={t('FOURNISSEURS', 'SUPPLIERS IMP.')} value={suppliers} color={CYAN_T} />
      </div>

      {/* Findings */}
      <Finding icon={<AlertOctagon size={14} />} color={ERR} title={t('Constat critique', 'Critical Finding')}
        text={redundant ? t(`La cascade atteint la profondeur ${result.maxDepth} ; la redondance présente limite l’exposition.`, `Cascade reaches depth ${result.maxDepth}; redundancy present limits exposure.`) : t(`Aucun chemin de bascule vérifié pour ${result.affectedTotal} service(s) dépendant(s). La cascade atteint la profondeur ${result.maxDepth}.`, `No verified failover path for ${result.affectedTotal} dependent service(s). Cascade reaches depth ${result.maxDepth}.`)} />
      <Finding icon={<Wrench size={14} />} color={ORANGE} title={t('Goulot de reprise', 'Recovery Bottleneck')}
        text={t(`Reprise manuelle requise pour ${origin}. Impact opérationnel estimé ${result.estimatedOperationalImpact} (somme des criticités).`, `Manual recovery required for ${origin}. Estimated operational impact ${result.estimatedOperationalImpact} (sum of criticalities).`)} />

      {/* Timeline */}
      <div>
        <h4 className="mb-3 border-b pb-1" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>{t('Chronologie de propagation', 'Propagation Timeline')}</h4>
        <div className="relative flex flex-col gap-3 pl-4">
          <div className="absolute bottom-1 left-[5px] top-1 w-px" style={{ background: 'var(--nx-border)' }} />
          {timeline.map((e, i) => (
            <div key={i} className="relative">
              <span className="absolute -left-4 top-1 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--nx-panel)', border: `2px solid ${e.c}` }} />
              <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>T+{e.d}h</div>
              <div style={{ fontSize: 13, color: 'var(--nx-text)' }}>{e.label}</div>
              {e.sub && <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>{e.sub}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- primitives ---------- */
function ActionBtn({ onClick, busy, icon, label, color, active }: { onClick: () => void; busy: boolean; icon: React.ReactNode; label: string; color: string; active?: boolean }) {
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

function Finding({ icon, color, title, text }: { icon: React.ReactNode; color: string; title: string; text: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: `color-mix(in srgb, ${color} 8%, transparent)`, borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }}>
      <div className="mb-1 flex items-center gap-1.5" style={{ color, fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{icon} {title}</div>
      <p style={{ fontSize: 13, color: 'var(--nx-text)' }}>{text}</p>
    </div>
  )
}
