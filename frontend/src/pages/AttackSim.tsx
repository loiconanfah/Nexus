import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ShieldAlert, Bot, Cloud, UserX, Unplug, Sparkles, Crosshair, Sliders, ShieldCheck, RotateCcw } from 'lucide-react'
import { api } from '../lib/api'
import type { SimAction, SimCascade } from '../components/Graph3D'
const Graph3D = lazy(() => import('../components/Graph3D').then((m) => ({ default: m.Graph3D })))
import { useLang } from '../lib/i18n'
import { entityTypeLabel, relationTypeLabel } from '../lib/labels'
import type { GraphEdge, GraphEntityRecord, AttackExplainPayload } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const NEG = '#d15b54'

type Dir = 'fwd' | 'bwd' | 'both'
type Scenario = { key: string; fr: string; en: string; desc: [string, string]; icon: typeof ShieldAlert; palette: SimAction; entryTypes: string[]; reach: number; active: Record<string, Dir> }

const SCENARIOS: Scenario[] = [
  { key: 'credentials', fr: 'Identifiants d’un employé compromis', en: 'Employee credentials compromised', desc: ['Un employé se fait piéger (outil externe / hameçonnage). L’attaquant hérite de ses accès et pivote.', 'An employee is phished via an external tool; the attacker inherits their access and pivots.'], icon: UserX, palette: 'cyber', entryTypes: ['Person', 'Role', 'Team'], reach: 4, active: { AUTHENTICATES: 'fwd', USES: 'both', MAINTAINS: 'both', KNOWS: 'both', INVOKES: 'both', USES_MODEL: 'both', SENDS_DATA_TO: 'both', DEPENDS_ON: 'bwd' } },
  { key: 'cloud', fr: 'Partage cloud piraté → agents IA détournés', en: 'Cloud share breached → AI agents hijacked', desc: ['Un stockage/partage cloud est compromis ; les agents IA qui en lisent les données sont empoisonnés et se mettent à agir.', 'A cloud store is breached; AI agents reading its data are poisoned and start acting.'], icon: Cloud, palette: 'ai-provider', entryTypes: ['CloudResource', 'Dataset', 'DataStore', 'Database'], reach: 4, active: { SENDS_DATA_TO: 'both', INVOKES: 'both', USES_MODEL: 'both', ORCHESTRATES: 'both', SERVED_BY: 'bwd', RUNS_ON: 'bwd', DEPENDS_ON: 'bwd', USES: 'both' } },
  { key: 'agent', fr: 'Agent IA détourné (pivot interne)', en: 'Rogue AI agent (internal pivot)', desc: ['Un agent IA est manipulé et abuse de ses accès pour agir sur les systèmes et les données internes.', 'An AI agent is manipulated and abuses its access to act on internal systems and data.'], icon: Bot, palette: 'agent-rogue', entryTypes: ['AiAgent', 'AiWorkflow'], reach: 4, active: { INVOKES: 'both', USES_MODEL: 'both', SENDS_DATA_TO: 'both', ORCHESTRATES: 'both', DEPENDS_ON: 'bwd', USES: 'both' } },
  { key: 'provider', fr: 'Fournisseur IA compromis (supply-chain)', en: 'AI provider compromised (supply-chain)', desc: ['Un fournisseur IA externe est compromis ; la corruption descend vers les modèles, puis les applications qui les utilisent.', 'An external AI provider is compromised; corruption flows down to models, then to the apps that use them.'], icon: Unplug, palette: 'ai-provider', entryTypes: ['AiProvider', 'Supplier'], reach: 5, active: { SERVED_BY: 'bwd', USES_MODEL: 'bwd', INVOKES: 'bwd', SUPPLIED_BY: 'bwd', DEPENDS_ON: 'bwd' } },
  { key: 'custom', fr: 'Personnalisé (chaîne libre)', en: 'Custom (free chain)', desc: ['Composez votre propre attaque : choisissez les liens qui transmettent la compromission et leur sens.', 'Compose your own attack: choose which links carry the compromise, and their direction.'], icon: Sliders, palette: 'cyber', entryTypes: [], reach: 4, active: {} },
]

// Relations proposables dans le constructeur libre : libellé + description
// (ce que le lien transmet lors d'une attaque), bilingue.
type RelMeta = { rel: string; fr: string; en: string; dfr: string; den: string }
const REL_META: RelMeta[] = [
  { rel: 'AUTHENTICATES', fr: 'Accès authentifié', en: 'Authenticated access', dfr: 'Une identité s’authentifie sur un système : l’attaquant hérite de cet accès.', den: 'An identity authenticates to a system: the attacker inherits that access.' },
  { rel: 'USES', fr: 'Utilisation', en: 'Usage', dfr: 'Utilisation d’une ressource : voie de pivot possible.', den: 'Use of a resource: a possible pivot path.' },
  { rel: 'KNOWS', fr: 'Lien social', en: 'Social link', dfr: 'Relation entre personnes : hameçonnage / ingénierie sociale.', den: 'Person-to-person link: phishing / social engineering.' },
  { rel: 'MAINTAINS', fr: 'Maintenance / admin', en: 'Maintenance / admin', dfr: 'Accès d’administration à un système.', den: 'Administrative access to a system.' },
  { rel: 'DEPENDS_ON', fr: 'Dépendance', en: 'Dependency', dfr: 'Dépendance opérationnelle : la compromission remonte aux dépendants.', den: 'Operational dependency: compromise flows to dependents.' },
  { rel: 'RUNS_ON', fr: 'Exécution / hébergement', en: 'Runs on / hosting', dfr: 'S’exécute sur un hôte : l’hôte compromis compromet l’hébergé.', den: 'Runs on a host: a compromised host compromises what it hosts.' },
  { rel: 'SUPPLIED_BY', fr: 'Fourniture externe', en: 'External supply', dfr: 'Fourni par un tiers : attaque de chaîne d’approvisionnement.', den: 'Supplied by a third party: supply-chain attack.' },
  { rel: 'USES_MODEL', fr: 'Utilise un modèle IA', en: 'Uses an AI model', dfr: 'Une application utilise un modèle : sorties empoisonnées possibles.', den: 'An app uses a model: poisoned outputs possible.' },
  { rel: 'INVOKES', fr: 'Invocation (service / agent)', en: 'Invocation (service / agent)', dfr: 'Appelle un service ou un agent : abus d’appel dans les deux sens.', den: 'Calls a service or agent: call abuse in both directions.' },
  { rel: 'SERVED_BY', fr: 'Servi par un fournisseur IA', en: 'Served by an AI provider', dfr: 'Modèle servi par un fournisseur : compromission descendante.', den: 'Model served by a provider: downstream compromise.' },
  { rel: 'SENDS_DATA_TO', fr: 'Flux de données', en: 'Data flow', dfr: 'Envoi de données : exfiltration ou empoisonnement.', den: 'Data sent: exfiltration or poisoning.' },
  { rel: 'ORCHESTRATES', fr: 'Orchestration d’agents', en: 'Agent orchestration', dfr: 'Un flux orchestre des agents : détournement de la chaîne.', den: 'A workflow orchestrates agents: chain hijack.' },
  { rel: 'CAN_ACT_ON', fr: 'Permission d’agir', en: 'Action permission', dfr: 'Un agent peut agir sur un système : rayon d’action de l’agent.', den: 'An agent can act on a system: the agent’s action radius.' },
]

function costPerHour(c: number) { return c >= 90 ? 50000 : c >= 80 ? 25000 : c >= 70 ? 15000 : c >= 60 ? 10000 : c >= 40 ? 3000 : c >= 20 ? 800 : 200 }
function rtoHours(type: string, crit: number) {
  const b = ['Database', 'System', 'Infrastructure', 'DataStore'].includes(type) ? 8
    : ['Server', 'CloudResource', 'Network', 'Device'].includes(type) ? 6
    : ['Application', 'Service', 'AiModel', 'AiService', 'ModelEndpoint'].includes(type) ? 3
    : ['AiAgent', 'AiWorkflow'].includes(type) ? 5
    : ['BusinessProcess', 'BusinessService', 'Process'].includes(type) ? 4
    : type === 'Supplier' || type === 'AiProvider' ? 24 : type === 'Dataset' ? 12
    : ['Person', 'Role', 'Team'].includes(type) ? 48 : 6
  return Math.round(b * (0.75 + 0.5 * crit / 100) * 10) / 10
}
const failProb = (hop: number) => Math.round(Math.max(0.3, Math.pow(0.9, Math.max(0, hop - 1))) * 100) / 100

type Reach = { hop: number; from: string | null; via: string | null }
type Compromised = { node: GraphEntityRecord; hop: number; euro: number; prob: number; cut: number; cutEuro: number }

// Recommandation par élément selon son type/rôle dans l'attaque (bilingue).
function reco(type: string): [string, string] {
  if (['Person', 'Role', 'Team'].includes(type)) return ['Révoquer les accès et réinitialiser les identifiants (MFA).', 'Revoke access and reset credentials (enforce MFA).']
  if (['AiAgent', 'AiWorkflow'].includes(type)) return ['Suspendre l’agent et réduire ses permissions au strict minimum.', 'Suspend the agent and cut its permissions to the minimum.']
  if (['AiModel', 'ModelEndpoint', 'AiService'].includes(type)) return ['Basculer sur un modèle de secours et valider les sorties.', 'Fail over to a backup model and validate outputs.']
  if (['AiProvider', 'Supplier'].includes(type)) return ['Couper le fournisseur et activer une alternative.', 'Cut the provider and activate an alternative.']
  if (['Database', 'DataStore', 'Dataset'].includes(type)) return ['Isoler les données, vérifier l’intégrité et une exfiltration.', 'Isolate the data, check integrity and exfiltration.']
  if (['BusinessService', 'BusinessProcess', 'Process'].includes(type)) return ['Activer le plan de continuité de ce service.', 'Activate this service’s continuity plan.']
  if (['Network', 'CloudResource'].includes(type)) return ['Segmenter le réseau et révoquer les jetons/clés.', 'Segment the network and revoke tokens/keys.']
  return ['Isoler le système et surveiller le trafic latéral.', 'Isolate the system and monitor lateral traffic.']
}
type Result = {
  entry: GraphEntityRecord; items: Compromised[]; affectedMap: Record<string, number>
  byType: Record<string, number>; services: Compromised[]; data: Compromised[]
  expected: number; worst: number; chain: { name: string; type: string; via: string | null }[]
}

function spread(entryId: string, edges: GraphEdge[], active: Record<string, Dir>, maxHop: number, isolated: Set<string>): Map<string, Reach> {
  const adj = new Map<string, { to: string; type: string }[]>()
  const add = (a: string, b: string, type: string) => { const l = adj.get(a) ?? []; l.push({ to: b, type }); adj.set(a, l) }
  for (const e of edges) {
    const dir = active[e.type]
    if (!dir) continue
    if (dir === 'fwd' || dir === 'both') add(e.source, e.target, e.type)
    if (dir === 'bwd' || dir === 'both') add(e.target, e.source, e.type)
  }
  const reach = new Map<string, Reach>([[entryId, { hop: 0, from: null, via: null }]])
  let frontier = [entryId]
  for (let h = 1; h <= maxHop && frontier.length; h++) {
    const next: string[] = []
    for (const n of frontier) for (const { to, type } of adj.get(n) ?? []) {
      if (!reach.has(to) && !isolated.has(to)) { reach.set(to, { hop: h, from: n, via: type }); next.push(to) }
    }
    frontier = next
  }
  return reach
}

export function AttackSim() {
  const { t, lang } = useLang()
  const graph = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const nodes = graph.data?.nodes ?? []
  const edges = graph.data?.edges ?? []
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const [scenarioKey, setScenarioKey] = useState('cloud')
  const [entryId, setEntryId] = useState('')
  const [customActive, setCustomActive] = useState<Record<string, Dir>>({ AUTHENTICATES: 'fwd', USES: 'both', INVOKES: 'both', USES_MODEL: 'both', SENDS_DATA_TO: 'both', DEPENDS_ON: 'bwd' })
  const [customReach, setCustomReach] = useState(4)
  const [isolated, setIsolated] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<Result | null>(null)
  const [baseline, setBaseline] = useState<Result | null>(null)
  const [sim, setSim] = useState<SimCascade | null>(null)
  const nonce = useRef(0)

  const scenario = SCENARIOS.find((s) => s.key === scenarioKey)!
  const activeRel = scenarioKey === 'custom' ? customActive : scenario.active
  const reach = scenarioKey === 'custom' ? customReach : scenario.reach
  const candidates = useMemo(() => scenario.entryTypes.length ? nodes.filter((n) => scenario.entryTypes.includes(n.entityType)) : nodes, [nodes, scenario])

  // Défaut : l'entrée qui compromet le plus.
  useEffect(() => {
    if (!candidates.length) return
    let best = candidates[0], bestN = -1
    for (const c of candidates.slice(0, 120)) { const n = spread(c.id, edges, activeRel, reach, new Set()).size; if (n > bestN) { bestN = n; best = c } }
    setEntryId(best.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioKey, graph.data])

  const explain = useMutation({ mutationFn: (p: AttackExplainPayload) => api.explainAttack(p) })

  function compute(iso: Set<string>): Result | null {
    const entry = byId.get(entryId)
    if (!entry) return null
    const rmap = spread(entryId, edges, activeRel, reach, iso)
    // Arbre de compromission → sous-arbre de chaque nœud (ce que couperait son isolement).
    const children = new Map<string, string[]>()
    for (const [id, r] of rmap) if (r.from) { const l = children.get(r.from) ?? []; l.push(id); children.set(r.from, l) }
    const euroOf = (id: string) => { const n = byId.get(id)!; return Math.round(costPerHour(n.criticality) * rtoHours(n.entityType, n.criticality)) }
    const cCount = new Map<string, number>(), cEuro = new Map<string, number>()
    const sub = (id: string): [number, number] => {
      if (cCount.has(id)) return [cCount.get(id)!, cEuro.get(id)!]
      let cnt = 1, eu = euroOf(id) * failProb(rmap.get(id)!.hop)
      for (const ch of children.get(id) ?? []) { const [c2, e2] = sub(ch); cnt += c2; eu += e2 }
      cCount.set(id, cnt); cEuro.set(id, eu); return [cnt, eu]
    }
    for (const id of rmap.keys()) sub(id)
    const items: Compromised[] = [...rmap.entries()].filter(([id]) => id !== entryId)
      .map(([id, r]) => { const node = byId.get(id)!; return { node, hop: r.hop, euro: euroOf(id), prob: failProb(r.hop), cut: cCount.get(id) ?? 1, cutEuro: Math.round(cEuro.get(id) ?? 0) } })
      .filter((c) => c.node).sort((a, b) => a.hop - b.hop || b.node.criticality - a.node.criticality)
    const affectedMap: Record<string, number> = {}; for (const c of items) affectedMap[c.node.id] = c.hop
    const byType: Record<string, number> = {}; for (const c of items) byType[c.node.entityType] = (byType[c.node.entityType] ?? 0) + 1
    const isService = (ty: string) => ['BusinessService', 'BusinessProcess', 'Service'].includes(ty)
    const isData = (ty: string) => ['Database', 'DataStore', 'Dataset'].includes(ty)
    const services = items.filter((c) => isService(c.node.entityType)).sort((a, b) => b.node.criticality - a.node.criticality)
    const data = items.filter((c) => isData(c.node.entityType))
    const expected = Math.round(items.reduce((s, c) => s + c.euro * c.prob, 0))
    const worst = items.reduce((s, c) => s + c.euro, 0)
    const target = services[0] ?? items.filter((c) => c.node.entityType !== 'Person')[0]
    const chain: { name: string; type: string; via: string | null }[] = []
    if (target) { let cur: string | null = target.node.id; const guard = new Set<string>(); while (cur && !guard.has(cur)) { guard.add(cur); const rr: Reach = rmap.get(cur)!; const n = byId.get(cur)!; chain.unshift({ name: n.name, type: n.entityType, via: rr.via }); cur = rr.from } }
    return { entry, items, affectedMap, byType, services, data, expected, worst, chain }
  }

  function apply(res: Result | null, iso: Set<string>) {
    if (!res) return
    setResult(res)
    nonce.current += 1
    setSim({ originId: entryId, affected: res.affectedMap, action: scenario.palette, nonce: nonce.current })
    explain.mutate({
      entryName: res.entry.name, entryType: res.entry.entityType, scenario: t(scenario.fr, scenario.en),
      compromised: res.items.length, servicesExposed: res.services.length, dataExposed: res.data.length,
      worstCase: res.worst, expected: res.expected, currency: 'CAD', byType: res.byType,
      chain: res.chain.map((s) => ({ name: s.name, type: s.type, via: s.via })), lang,
    })
    if (iso.size === 0) setBaseline(res)
  }

  function run() { setIsolated(new Set()); apply(compute(new Set()), new Set()) }
  function toggleIsolate(id: string) {
    const iso = new Set(isolated); iso.has(id) ? iso.delete(id) : iso.add(id); setIsolated(iso); apply(compute(iso), iso)
  }
  function resetCountermeasures() { setIsolated(new Set()); apply(compute(new Set()), new Set()) }

  const fmt = (n: number) => new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 }).format(n)
  const avoided = baseline && result ? baseline.expected - result.expected : 0

  return (
    <div className="relative h-[calc(100vh-7rem)] overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <div className="nx-grid absolute inset-0" />
      {nodes.length > 0 ? (
        <Suspense fallback={null}>
          <Graph3D nodes={nodes} edges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, status: e.status, confidence: e.confidence }))} selectedId={entryId} onSelect={setEntryId} sim={sim} impactById={result ? Object.fromEntries(result.items.map((c) => [c.node.id, c.euro])) : undefined} />
        </Suspense>
      ) : <div className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>{graph.isLoading ? t('Chargement…', 'Loading…') : t('Aucun graphe', 'No graph')}</div>}

      {/* Panneau SCÉNARIO */}
      <div className="absolute left-3 top-3 z-30 flex w-80 flex-col rounded-lg border shadow-xl" style={{ maxHeight: 'calc(100% - 24px)', background: 'color-mix(in srgb, var(--nx-panel) 95%, transparent)', borderColor: 'var(--nx-border)', backdropFilter: 'blur(6px)' }}>
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <ShieldAlert size={18} style={{ color: NEG }} />
          <span style={{ fontFamily: geist, fontSize: 15, color: 'var(--nx-text)' }}>{t('Simulation d’attaque', 'Attack simulation')}</span>
        </div>
        <div className="overflow-y-auto p-3">
          <div className="mb-1" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Scénario', 'Scenario')}</div>
          <div className="flex flex-col gap-1.5">
            {SCENARIOS.map((s) => (
              <button key={s.key} onClick={() => setScenarioKey(s.key)} className="flex items-start gap-2 rounded-md border p-2 text-left" style={{ borderColor: scenarioKey === s.key ? NEG : 'var(--nx-border)', background: scenarioKey === s.key ? `color-mix(in srgb, ${NEG} 10%, transparent)` : 'transparent' }}>
                <s.icon size={16} style={{ color: NEG, marginTop: 1, flex: 'none' }} />
                <span><span style={{ fontSize: 13, color: 'var(--nx-text)' }}>{t(s.fr, s.en)}</span><span className="mt-0.5 block" style={{ fontSize: 11, color: 'var(--nx-text-muted)', lineHeight: 1.35 }}>{t(s.desc[0], s.desc[1])}</span></span>
              </button>
            ))}
          </div>

          {/* Constructeur libre */}
          {scenarioKey === 'custom' && (
            <div className="mt-3 rounded-md border p-2.5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-container)' }}>
              <div className="mb-2 flex items-center justify-between">
                <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Liens qui transmettent l’attaque', 'Links that carry the attack')}</span>
                <label className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('portée', 'reach')}
                  <select value={customReach} onChange={(e) => setCustomReach(Number(e.target.value))} className="rounded border bg-transparent px-1" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)' }}>{[2, 3, 4, 5, 6].map((r) => <option key={r} value={r}>{r}</option>)}</select>
                </label>
              </div>
              {/* Légende des directions */}
              <div className="mb-2 flex flex-wrap gap-x-2.5 gap-y-0.5" style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--nx-text-muted)' }}>
                <span><b>—</b> {t('inactif', 'off')}</span>
                <span><b>→</b> {t('source → cible', 'source → target')}</span>
                <span><b>←</b> {t('cible → source', 'target → source')}</span>
                <span><b>↔</b> {t('les deux', 'both')}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {REL_META.map(({ rel, fr, en, dfr, den }) => (
                  <div key={rel} className="flex items-center justify-between gap-2" title={t(dfr, den)}>
                    <span className="min-w-0">
                      <span className="block truncate" style={{ fontSize: 12, color: customActive[rel] ? 'var(--nx-text)' : 'var(--nx-text-muted)' }}>{t(fr, en)}</span>
                      <span className="block" style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-outline)' }}>{rel}</span>
                    </span>
                    <div className="flex flex-none gap-0.5">
                      {(['off', 'fwd', 'bwd', 'both'] as const).map((d) => {
                        const on = (customActive[rel] ?? 'off') === d || (d === 'off' && !customActive[rel])
                        const sym = d === 'off' ? '—' : d === 'fwd' ? '→' : d === 'bwd' ? '←' : '↔'
                        const tip = d === 'off' ? t('inactif', 'off') : d === 'fwd' ? t('source → cible', 'source → target') : d === 'bwd' ? t('cible → source', 'target → source') : t('les deux', 'both')
                        return <button key={d} title={tip} aria-label={tip} onClick={() => setCustomActive((m) => { const n = { ...m }; if (d === 'off') delete n[rel]; else n[rel] = d; return n })} className="h-5 w-6 rounded" style={{ fontFamily: mono, fontSize: 11, background: on ? NEG : 'var(--nx-surface)', color: on ? '#0a0a0a' : 'var(--nx-text-muted)', border: '1px solid var(--nx-border)' }}>{sym}</button>
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3">
            <div className="mb-1" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Point d’entrée', 'Entry point')}</div>
            <select value={entryId} onChange={(e) => setEntryId(e.target.value)} className="h-9 w-full rounded-sm border px-2 outline-none" style={{ background: 'var(--nx-bg)', borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 12 }}>
              {candidates.map((n) => <option key={n.id} value={n.id}>{n.name} · {entityTypeLabel(n.entityType, t)}</option>)}
            </select>
            <p className="mt-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>{t('Ou cliquez un nœud dans l’hologramme.', 'Or click a node in the hologram.')}</p>
          </div>

          <button onClick={run} disabled={!entryId} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-sm" style={{ background: NEG, color: '#0a0a0a', fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: entryId ? 1 : 0.5 }}>
            <Crosshair size={16} /> {t('Lancer l’attaque', 'Launch attack')}
          </button>
        </div>
      </div>

      {/* Panneau RÉSULTAT */}
      {result && (
        <div className="absolute right-3 top-3 z-30 flex w-96 flex-col rounded-lg border shadow-xl" style={{ maxHeight: 'calc(100% - 24px)', background: 'color-mix(in srgb, var(--nx-panel) 96%, transparent)', borderColor: 'var(--nx-border)', backdropFilter: 'blur(6px)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
            <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Compromission', 'Compromise')}</div>
            <div style={{ fontFamily: geist, fontSize: 15, color: NEG }}>{t(scenario.fr, scenario.en)}</div>
            <div style={{ fontSize: 11, color: 'var(--nx-text-muted)' }}>{t('Entrée', 'Entry')} : {result.entry.name}</div>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            <div className="grid grid-cols-3 gap-2">
              <Kpi label={t('Compromis', 'Compromised')} value={String(result.items.length)} color={NEG} />
              <Kpi label={t('Services exposés', 'Services hit')} value={String(result.services.length)} color="#e0a458" />
              <Kpi label={t('Données exposées', 'Data exposed')} value={String(result.data.length)} color={CYAN} />
            </div>
            <div className="rounded-sm border p-3" style={{ background: 'rgba(209,91,84,0.06)', borderColor: 'rgba(209,91,84,0.35)' }}>
              <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Impact attendu', 'Expected impact')}</div>
              <div className="flex items-baseline gap-1"><span style={{ fontFamily: geist, fontSize: 26, color: NEG }}>{fmt(result.expected)}</span><span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>CAD · {t('pire cas', 'worst')} {fmt(result.worst)}</span></div>
            </div>

            {/* Contre-mesures */}
            {isolated.size > 0 && (
              <div className="rounded-sm border p-3" style={{ borderColor: '#3fb27f66', background: 'color-mix(in srgb, #3fb27f 8%, transparent)' }}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: '#3fb27f' }}><ShieldCheck size={12} /> {t('Contre-mesures', 'Countermeasures')}</span>
                  <button onClick={resetCountermeasures} className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}><RotateCcw size={11} /> {t('réinit.', 'reset')}</button>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>{t(`${isolated.size} élément(s) isolé(s) → ${fmt(avoided)} CAD évités, impact ramené à ${fmt(result.expected)} CAD.`, `${isolated.size} element(s) isolated → ${fmt(avoided)} CAD avoided, impact down to ${fmt(result.expected)} CAD.`)}</p>
              </div>
            )}

            {/* Chaîne d'attaque */}
            <div>
              <h4 className="mb-2 border-b pb-1" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: NEG, borderColor: 'var(--nx-border)' }}>{t('Chaîne d’attaque', 'Attack chain')}</h4>
              <div className="flex flex-col gap-2">
                {result.chain.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full" style={{ background: i === 0 ? NEG : 'var(--nx-surface-container)', color: i === 0 ? '#0a0a0a' : 'var(--nx-text-muted)', fontFamily: mono, fontSize: 10 }}>{i + 1}</span>
                    <div style={{ fontSize: 12.5 }}>
                      {s.via && <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>{relationTypeLabel(s.via, t)} → </span>}
                      <span style={{ color: 'var(--nx-text)' }}>{s.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--nx-outline)' }}> · {entityTypeLabel(s.type, t)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Analyse IA + contre-mesures suggérées */}
            <div className="rounded-sm border p-3" style={{ borderColor: 'color-mix(in srgb, var(--nx-cyan) 30%, transparent)', background: 'color-mix(in srgb, var(--nx-cyan) 6%, transparent)' }}>
              <div className="mb-1 flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-cyan-text)' }}><Sparkles size={12} /> {t('Analyse IA', 'AI analysis')}</div>
              {explain.isPending ? <p style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Analyse…', 'Analyzing…')}</p> : explain.data ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--nx-text)', lineHeight: 1.5 }}>{explain.data.narrative}</p>
                  {explain.data.countermeasures.length > 0 && (
                    <div className="mt-2">
                      <div style={{ fontFamily: mono, fontSize: 9.5, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Contre-mesures', 'Countermeasures')}</div>
                      <ol className="mt-0.5 flex flex-col gap-0.5">{explain.data.countermeasures.map((m, i) => <li key={i} style={{ fontSize: 12, color: 'var(--nx-text)' }}><span style={{ color: '#3fb27f' }}>{i + 1}.</span> {m}</li>)}</ol>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Éléments compromis — cliquez « isoler » pour tester une contre-mesure */}
            <div>
              <h4 className="mb-2 border-b pb-1" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>{t('Éléments compromis · isoler pour simuler', 'Compromised · isolate to simulate')}</h4>
              <div className="flex flex-col gap-1.5">
                {result.items.slice(0, 24).map((c) => {
                  const iso = isolated.has(c.node.id)
                  const pivot = c.cut > 2
                  return (
                    <div key={c.node.id} className="rounded-sm border p-2" style={{ borderColor: iso ? '#3fb27f' : pivot ? `color-mix(in srgb, ${NEG} 45%, var(--nx-border))` : 'var(--nx-border)', background: 'var(--nx-surface-container)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate" style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>{c.node.name} <span style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--nx-outline)' }}>· {entityTypeLabel(c.node.entityType, t)} · S{c.hop} · {Math.round(c.prob * 100)}%</span></span>
                        <span className="flex-none" style={{ fontFamily: mono, fontSize: 11, color: NEG }}>{fmt(c.euro)} $</span>
                      </div>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <span style={{ fontSize: 11, color: 'var(--nx-text-muted)', lineHeight: 1.35 }}>
                          {pivot && <span style={{ color: NEG, fontFamily: mono, fontSize: 10 }}>{t('Point de bascule', 'Choke point')} · {t('couperait', 'would cut')} {c.cut} (~{fmt(c.cutEuro)} $) · </span>}
                          {t(reco(c.node.entityType)[0], reco(c.node.entityType)[1])}
                        </span>
                        <button onClick={() => toggleIsolate(c.node.id)} className="flex-none rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10, border: `1px solid ${iso ? '#3fb27f' : 'var(--nx-border)'}`, color: iso ? '#3fb27f' : 'var(--nx-text-muted)' }}>{iso ? t('isolé', 'isolated') : t('isoler', 'isolate')}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-sm border p-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-container)' }}>
      <div style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 22, color }}>{value}</div>
    </div>
  )
}
