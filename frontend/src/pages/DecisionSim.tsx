import { lazy, Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Sparkles, RotateCcw, TrendingUp, TrendingDown, Minus, Gauge, ArrowRight, SlidersHorizontal, Box, Trash2,
  Loader2, Plus, Share2, Maximize2, Minimize2, X, Check, Pencil, Save, Lightbulb, AlertTriangle, CircleCheck,
  Scale, Trophy,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { EnterpriseModel, DecisionAnalysis } from '../lib/types'

const Enterprise3D = lazy(() => import('../components/Enterprise3D').then((m) => ({ default: m.Enterprise3D })))

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const POS = '#3fb27f'
const NEG = '#d15b54'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type Drivers = EnterpriseModel['drivers']
interface Levers { pricePct: number; volumePct: number; headcountDelta: number; salaryPct: number; marketingPct: number; cogsPts: number }
const ZERO: Levers = { pricePct: 0, volumePct: 0, headcountDelta: 0, salaryPct: 0, marketingPct: 0, cogsPts: 0 }
interface ElementItem { id: string; name: string; type: string; revenue: number; cost: number; headcount: number }
interface Relation { id: string; from: string; to: string }
const ELEMENT_TYPES = ['Service', 'Produit', 'Département', 'Équipe', 'Client', 'Fournisseur', 'Projet', 'Site']

interface Metrics { revenue: number; grossProfit: number; grossMargin: number; ebitda: number; ebitdaMargin: number; ebit: number; netProfit: number; netMargin: number; headcount: number; ocf: number; totalCost: number }

function computeFull(d: Drivers, l: Levers, elements: ElementItem[]): Metrics {
  const avgPrice = d.avgPrice * (1 + l.pricePct / 100)
  const units = d.units * (1 + l.volumePct / 100)
  const headcount = Math.max(0, d.headcount + l.headcountDelta)
  const avgSalary = d.avgSalary * (1 + l.salaryPct / 100)
  const marketing = d.marketing * (1 + l.marketingPct / 100)
  const cogsPercent = clamp(d.cogsPercent + l.cogsPts / 100, 0.1, 0.95)
  const eRev = elements.reduce((s, x) => s + x.revenue, 0)
  const eCost = elements.reduce((s, x) => s + x.cost, 0)
  const eHc = elements.reduce((s, x) => s + x.headcount, 0)

  const revenue = units * avgPrice + eRev
  const cogs = units * avgPrice * cogsPercent + eCost * 0.65
  const grossProfit = revenue - cogs
  const sgaSalaries = headcount * avgSalary * (1 - d.billableRatio)
  const totalOpex = sgaSalaries + marketing + d.rnD + d.ga + eCost * 0.35
  const ebitda = grossProfit - totalOpex
  const ebit = ebitda - d.depreciation
  const taxable = Math.max(0, ebit - d.interest)
  const netProfit = ebit - d.interest - taxable * d.taxRate
  const ocf = netProfit + d.depreciation - revenue * 0.015
  return { revenue, grossProfit, grossMargin: grossProfit / revenue, ebitda, ebitdaMargin: ebitda / revenue, ebit, netProfit, netMargin: netProfit / revenue, headcount: headcount + eHc, ocf, totalCost: cogs + totalOpex }
}

interface Scores { overall: number; financial: number; roi: number; growth: number; risk: number; cash: number; feasibility: number }
function scoreDecision(l: Levers, base: Metrics, sim: Metrics): Scores {
  const profitDelta = sim.netProfit - base.netProfit
  const revPct = (sim.revenue - base.revenue) / base.revenue
  const investment = Math.max(0, sim.totalCost - base.totalCost)
  const roi = investment > 1000 ? profitDelta / investment : profitDelta > 0 ? 2 : 0
  const hcPct = (sim.headcount - base.headcount) / base.headcount
  const financial = clamp(50 + (profitDelta / Math.abs(base.netProfit)) * 45, 0, 100)
  const roiScore = clamp(50 + roi * 35, 0, 100)
  const growth = clamp(50 + revPct * 280, 0, 100)
  const cash = clamp(50 + ((sim.ocf - base.ocf) / Math.max(1, Math.abs(base.ocf))) * 40, 0, 100)
  const swing = Math.abs(revPct) + Math.abs(hcPct) + Math.abs(l.pricePct / 100)
  const risk = clamp(100 - swing * 110 - (sim.ocf < 0 ? 30 : 0), 0, 100)
  const feasibility = clamp(100 - Math.abs(hcPct) * 140 - Math.abs(l.pricePct) * 2.5, 0, 100)
  const overall = Math.round(financial * 0.28 + roiScore * 0.18 + growth * 0.16 + risk * 0.18 + cash * 0.12 + feasibility * 0.08)
  return { overall, financial: Math.round(financial), roi: Math.round(roiScore), growth: Math.round(growth), risk: Math.round(risk), cash: Math.round(cash), feasibility: Math.round(feasibility) }
}

const PRESETS: { fr: string; en: string; levers: Partial<Levers> }[] = [
  { fr: 'Augmenter les prix de 8 %', en: 'Raise prices by 8%', levers: { pricePct: 8 } },
  { fr: 'Embaucher 100 employés', en: 'Hire 100 employees', levers: { headcountDelta: 100 } },
  { fr: 'Ventes −15 %', en: 'Sales −15%', levers: { volumePct: -15 } },
  { fr: 'Réduire les coûts de 5 pts', en: 'Cut costs by 5 pts', levers: { cogsPts: -5 } },
]

export function DecisionSim() {
  const { t, lang } = useLang()
  const { data, isLoading } = useQuery({ queryKey: ['enterprise-model'], queryFn: api.enterpriseModel })
  const [tab, setTab] = useState<'levers' | 'holo' | 'compare'>('levers')
  const [levers, setLevers] = useState<Levers>(ZERO)
  const [elements, setElements] = useState<ElementItem[]>([])
  const [relations, setRelations] = useState<Relation[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [analysis, setAnalysis] = useState<DecisionAnalysis | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // éditeur diagramme
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [relMode, setRelMode] = useState(false)
  const [relFrom, setRelFrom] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [addForm, setAddForm] = useState<{ type: string; name: string; revenue: number; cost: number; headcount: number } | null>(null)
  const [scenName, setScenName] = useState('')
  const scenariosQ = useQuery({ queryKey: ['scenarios'], queryFn: api.listScenarios })

  async function saveScenario() {
    if (!scenName.trim()) return
    await api.saveScenario(scenName.trim(), JSON.stringify({ levers, elements, relations }))
    setScenName(''); scenariosQ.refetch()
  }
  function loadScenario(payload: string) {
    try {
      const s = JSON.parse(payload) as { levers?: Partial<Levers>; elements?: ElementItem[]; relations?: Relation[] }
      setLevers({ ...ZERO, ...(s.levers ?? {}) })
      setElements(s.elements ?? [])
      setRelations(s.relations ?? [])
      setSelectedId(null)
    } catch { /* ignore */ }
  }
  async function delScenario(id: string) { await api.deleteScenario(id); scenariosQ.refetch() }

  const nf = new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA')
  const money = (v: number) => {
    const a = Math.abs(v)
    if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e8 ? 0 : 1)} M$`
    if (a >= 1e3) return `${(v / 1e3).toFixed(0)} k$`
    return nf.format(Math.round(v))
  }

  const model = useMemo(() => {
    if (!data?.configured) return null
    const d = data.drivers
    const base = computeFull(d, ZERO, [])
    const sim = computeFull(d, levers, elements)
    return { d, base, sim, scores: scoreDecision(levers, base, sim) }
  }, [data, levers, elements])

  const dirty = JSON.stringify(levers) !== JSON.stringify(ZERO) || elements.length > 0 || relations.length > 0

  // Comparaison multi-scénarios : scénario actuel + scénarios sauvegardés.
  const comparables = useMemo(() => {
    if (!data?.configured) return []
    const d = data.drivers
    const base = computeFull(d, ZERO, [])
    const raw: { id: string; name: string; lev: Levers; els: ElementItem[] }[] = [
      { id: 'current', name: lang === 'fr' ? 'Scénario actuel' : 'Current', lev: levers, els: elements },
    ]
    for (const sc of scenariosQ.data ?? []) {
      try {
        const p = JSON.parse(sc.payload) as { levers?: Partial<Levers>; elements?: ElementItem[] }
        raw.push({ id: sc.id, name: sc.name, lev: { ...ZERO, ...(p.levers ?? {}) }, els: p.elements ?? [] })
      } catch { /* ignore */ }
    }
    return raw.slice(0, 5).map((c) => {
      const m = computeFull(d, c.lev, c.els)
      return { id: c.id, name: c.name, m, base, score: scoreDecision(c.lev, base, m).overall }
    })
  }, [data, levers, elements, scenariosQ.data, lang])

  function nodeName(id: string): string {
    if (id === 'company') return data?.company.name ?? 'Company'
    if (id.startsWith('div:')) return data?.divisions[+id.slice(4)]?.name ?? id
    if (id.startsWith('seg:')) return data?.segments[+id.slice(4)]?.name ?? id
    if (id.startsWith('el:')) return elements.find((e) => `el:${e.id}` === id)?.name ?? id
    return id
  }

  function onSelectNode(id: string) {
    if (relMode) {
      if (!relFrom) { setRelFrom(id); return }
      if (relFrom !== id) setRelations((r) => [...r, { id: crypto.randomUUID(), from: relFrom, to: id }])
      setRelMode(false); setRelFrom(null)
      return
    }
    setSelectedId((cur) => (cur === id ? null : id))
  }

  async function analyze() {
    if (!q.trim() || busy) return
    setBusy(true); setErr(null)
    try {
      const res = await api.decideEnterprise(q.trim(), lang)
      const e = res.effect
      setAnalysis(res.analysis)
      // Chaque décision analysée REMPLACE les leviers (scénario propre, pas d'empilement).
      setLevers({
        pricePct: e.pricePct, volumePct: e.volumePct, headcountDelta: e.headcountDelta,
        salaryPct: e.salaryPct, marketingPct: e.marketingPct, cogsPts: e.cogsPts,
      })
      if (e.newService?.name) {
        setElements((prev) => [...prev, { id: crypto.randomUUID(), name: e.newService!.name, type: e.newService!.division || 'Service', revenue: e.newService!.annualRevenue, cost: e.newService!.annualCost, headcount: e.newService!.headcount }])
      }
    } catch {
      setErr(t('Analyse impossible. Réessayez.', 'Analysis failed. Please retry.'))
    } finally {
      setBusy(false)
    }
  }

  function reset() { setLevers(ZERO); setElements([]); setRelations([]); setAnalysis(null); setQ(''); setSelectedId(null) }
  function updateElement(id: string, patch: Partial<ElementItem>) { setElements((els) => els.map((e) => (e.id === id ? { ...e, ...patch } : e))) }
  function removeElement(id: string) { setElements((els) => els.filter((e) => e.id !== id)); setRelations((r) => r.filter((x) => x.from !== `el:${id}` && x.to !== `el:${id}`)); if (selectedId === `el:${id}`) setSelectedId(null) }
  function addElement() {
    if (!addForm || !addForm.name.trim()) return
    setElements((els) => [...els, { id: crypto.randomUUID(), name: addForm.name.trim(), type: addForm.type, revenue: addForm.revenue, cost: addForm.cost, headcount: addForm.headcount }])
    setAddForm(null)
  }

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('CHARGEMENT…', 'LOADING…')}</div>
  if (!data?.configured || !model) {
    return <div className="rounded-lg border p-10 text-center" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>{t('Modèle d’entreprise requis (voir « Modèle d’entreprise »).', 'Enterprise model required (see “Enterprise Model”).')}</div>
  }
  const { base, sim, scores } = model
  const scoreColor = scores.overall >= 70 ? POS : scores.overall >= 45 ? '#c69a4e' : NEG
  const selectedElement = selectedId?.startsWith('el:') ? elements.find((e) => `el:${e.id}` === selectedId) ?? null : null

  const hologram = (
    <div className={fullscreen ? 'fixed inset-0 z-[60] flex flex-col gap-3 p-3' : 'flex flex-col gap-3'} style={fullscreen ? { background: 'var(--nx-bg)' } : undefined}>
      {/* Barre d'outils diagramme */}
      <div className="flex flex-wrap items-center gap-2">
        <ToolBtn onClick={() => { setAddForm(addForm ? null : { type: 'Service', name: '', revenue: 5_000_000, cost: 3_000_000, headcount: 20 }); setRelMode(false) }} active={!!addForm} icon={Plus}>{t('Ajouter un élément', 'Add element')}</ToolBtn>
        <ToolBtn onClick={() => { setRelMode((m) => !m); setRelFrom(null); setAddForm(null) }} active={relMode} icon={Share2}>{t('Ajouter une relation', 'Add relation')}</ToolBtn>
        {dirty && <ToolBtn onClick={reset} icon={RotateCcw}>{t('Réinitialiser', 'Reset')}</ToolBtn>}
        <div className="flex-1" />
        <ToolBtn onClick={() => setFullscreen((f) => !f)} icon={fullscreen ? Minimize2 : Maximize2}>{fullscreen ? t('Quitter le plein écran', 'Exit fullscreen') : t('Plein écran', 'Fullscreen')}</ToolBtn>
      </div>
      {relMode && <div className="rounded-sm border px-3 py-1.5" style={{ borderColor: 'rgba(0,229,255,0.4)', background: 'rgba(0,229,255,0.06)', fontFamily: mono, fontSize: 11, color: 'var(--nx-cyan-text)' }}>{relFrom ? t(`Reliant « ${nodeName(relFrom)} » — cliquez le nœud cible.`, `Linking “${nodeName(relFrom)}” — click the target node.`) : t('Cliquez le premier nœud à relier.', 'Click the first node to link.')}</div>}

      <div className={fullscreen ? 'flex min-h-0 flex-1 gap-3' : 'grid gap-3 lg:grid-cols-[1fr_340px]'}>
        {/* Scène 3D */}
        <div className={`relative overflow-hidden rounded-lg border ${fullscreen ? 'flex-1' : ''}`} style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)', minHeight: fullscreen ? undefined : 520, height: fullscreen ? '100%' : undefined }}>
          <div className="nx-grid absolute inset-0" />
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Chargement de l’hologramme…', 'Loading hologram…')}</div>}>
            <Enterprise3D companyName={data.company.name} companyRevenue={base.revenue}
              divisions={data.divisions.map((x) => ({ name: x.name, revenue: x.revenue, margin: x.margin, employees: x.employees }))}
              segments={data.segments.map((x) => ({ name: x.name, revenue: x.revenue, share: x.share, customers: x.customers }))}
              elements={elements} relations={relations} selectedId={selectedId} relFrom={relFrom} onSelect={onSelectNode} />
          </Suspense>
        </div>

        {/* Panneau latéral */}
        <div className={fullscreen ? 'flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto' : 'flex flex-col gap-3'}>
          {addForm && (
            <Card title={t('Nouvel élément', 'New element')}>
              <div className="flex flex-col gap-2">
                <Row label={t('Type', 'Type')}><select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })} className="w-full rounded-sm border px-2 py-1" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 12 }}>{ELEMENT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Row>
                <Row label={t('Nom', 'Name')}><input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder={t('Ex. : Service cyber', 'e.g. Cyber service')} className="w-full rounded-sm border px-2 py-1 outline-none" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }} /></Row>
                <NumRow label={t('Revenu annuel', 'Annual revenue')} value={addForm.revenue} onChange={(v) => setAddForm({ ...addForm, revenue: v })} />
                <NumRow label={t('Coût annuel', 'Annual cost')} value={addForm.cost} onChange={(v) => setAddForm({ ...addForm, cost: v })} />
                <NumRow label={t('Effectif', 'Headcount')} value={addForm.headcount} onChange={(v) => setAddForm({ ...addForm, headcount: v })} step={1} />
                <div className="flex gap-2">
                  <button onClick={addElement} className="flex flex-1 items-center justify-center gap-1 rounded-sm py-1.5" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12 }}><Check size={13} /> {t('Ajouter', 'Add')}</button>
                  <button onClick={() => setAddForm(null)} className="rounded-sm border px-3" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}><X size={14} /></button>
                </div>
              </div>
            </Card>
          )}

          {selectedElement ? (
            <Card title={<span className="flex items-center gap-1.5"><Pencil size={13} /> {t('Éditer l’élément', 'Edit element')}</span>}>
              <div className="flex flex-col gap-2">
                <Row label={t('Nom', 'Name')}><input value={selectedElement.name} onChange={(e) => updateElement(selectedElement.id, { name: e.target.value })} className="w-full rounded-sm border px-2 py-1 outline-none" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }} /></Row>
                <NumRow label={t('Revenu annuel', 'Annual revenue')} value={selectedElement.revenue} onChange={(v) => updateElement(selectedElement.id, { revenue: v })} />
                <NumRow label={t('Coût annuel', 'Annual cost')} value={selectedElement.cost} onChange={(v) => updateElement(selectedElement.id, { cost: v })} />
                <NumRow label={t('Effectif', 'Headcount')} value={selectedElement.headcount} onChange={(v) => updateElement(selectedElement.id, { headcount: v })} step={1} />
                <button onClick={() => removeElement(selectedElement.id)} className="mt-1 flex items-center justify-center gap-1 rounded-sm border py-1.5" style={{ borderColor: NEG, color: NEG, fontFamily: mono, fontSize: 12 }}><Trash2 size={13} /> {t('Supprimer', 'Delete')}</button>
              </div>
            </Card>
          ) : selectedId ? (
            <Card title={t('Élément sélectionné', 'Selected element')}>
              <div style={{ fontSize: 14, color: 'var(--nx-text)' }}>{nodeName(selectedId)}</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{t('Élément du modèle (lecture seule).', 'Model element (read-only).')}</div>
            </Card>
          ) : null}

          <ComparePanel base={base} sim={sim} money={money} nf={nf} t={t} compact />

          {(elements.length > 0 || relations.length > 0) && (
            <Card title={t('Diagramme', 'Diagram')}>
              {elements.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-sm border p-2" style={{ borderColor: selectedId === `el:${e.id}` ? CYAN : 'rgba(0,229,255,0.3)', background: 'rgba(0,229,255,0.05)', marginBottom: 6, cursor: 'pointer' }} onClick={() => setSelectedId(`el:${e.id}`)}>
                  <div><div style={{ fontSize: 13, color: 'var(--nx-text)' }}>{e.name}</div><div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{e.type} · {money(e.revenue)} · {e.headcount} {t('empl.', 'staff')}</div></div>
                  <button onClick={(ev) => { ev.stopPropagation(); removeElement(e.id) }} style={{ color: 'var(--nx-text-muted)' }}><Trash2 size={13} /></button>
                </div>
              ))}
              {relations.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-1" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
                  <span>{nodeName(r.from)} → {nodeName(r.to)}</span>
                  <button onClick={() => setRelations((x) => x.filter((y) => y.id !== r.id))} style={{ color: 'var(--nx-text-muted)' }}><X size={12} /></button>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
            <Sparkles size={22} style={{ color: CYAN }} /> {t('Décision & simulation', 'Decision & simulation')}
          </h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Construisez la décision, ajustez les leviers, mesurez l’impact.', 'Build the decision, tune the levers, measure the impact.')}</p>
        </div>
        <div className="flex rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
          <TabBtn active={tab === 'levers'} onClick={() => setTab('levers')} icon={SlidersHorizontal}>{t('Leviers', 'Levers')}</TabBtn>
          <TabBtn active={tab === 'holo'} onClick={() => setTab('holo')} icon={Box}>{t('Hologramme', 'Hologram')}</TabBtn>
          <TabBtn active={tab === 'compare'} onClick={() => setTab('compare')} icon={Scale}>{t('Comparer', 'Compare')}</TabBtn>
        </div>
      </div>

      {/* Console de décision (langage naturel + IA) */}
      <div className="rounded-lg border p-3" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="nx-input flex flex-1 items-center rounded" style={{ background: 'var(--nx-surface-high)', border: '1px solid var(--nx-border)' }}>
            <Sparkles size={16} className="ml-3" style={{ color: 'var(--nx-outline)' }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && analyze()}
              placeholder={t('Ex. : « réduire le marketing de 20 % et lancer un service cyber »', 'e.g. “cut marketing 20% and launch a cyber service”')}
              className="w-full bg-transparent p-2 outline-none" style={{ color: 'var(--nx-text)', fontSize: 14 }} />
          </div>
          <button onClick={analyze} disabled={busy} className="flex items-center justify-center gap-2 rounded px-4 py-2 transition-colors disabled:opacity-60" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} {t('Analyser', 'Analyze')}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.en} onClick={() => { setLevers({ ...ZERO, ...p.levers }); setQ(lang === 'fr' ? p.fr : p.en); setAnalysis(null) }} className="rounded-full border px-2.5 py-1 transition-colors hover:brightness-125" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontSize: 12 }}>
              {lang === 'fr' ? p.fr : p.en}
            </button>
          ))}
          {dirty && <button onClick={reset} className="flex items-center gap-1 rounded-full border px-2.5 py-1" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontSize: 12 }}><RotateCcw size={12} /> {t('Réinitialiser', 'Reset')}</button>}
        </div>
        {err && <div className="mt-2" style={{ fontFamily: mono, fontSize: 11, color: NEG }}>{err}</div>}
        {/* Scénarios sauvegardés */}
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2" style={{ borderColor: 'var(--nx-border)' }}>
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--nx-outline)' }}>{t('Scénarios', 'Scenarios')}</span>
          <input value={scenName} onChange={(e) => setScenName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveScenario()} placeholder={t('Nom…', 'Name…')} className="rounded-sm border px-2 py-1 outline-none" style={{ background: 'var(--nx-surface-high)', borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 12, width: 140 }} />
          <button onClick={saveScenario} disabled={!scenName.trim() || !dirty} className="flex items-center gap-1 rounded-sm border px-2 py-1 disabled:opacity-50" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-cyan-text)', fontFamily: mono, fontSize: 11 }}><Save size={12} /> {t('Enregistrer', 'Save')}</button>
          {scenariosQ.data?.map((s) => (
            <span key={s.id} className="flex items-center gap-1 rounded-full border px-2 py-1" style={{ borderColor: 'var(--nx-border)', fontSize: 12 }}>
              <button onClick={() => loadScenario(s.payload)} style={{ color: 'var(--nx-text-muted)' }}>{s.name}</button>
              <button onClick={() => delScenario(s.id)} style={{ color: 'var(--nx-outline)' }}><X size={11} /></button>
            </span>
          ))}
        </div>
      </div>

      {/* Score + analyse IA */}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <Ring value={scores.overall} color={scoreColor} />
          <div className="text-center">
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Score de décision', 'Decision score')}</div>
            <div style={{ fontFamily: geist, fontSize: 15, color: scoreColor }}>{dirty ? t(scoreColor === POS ? 'Favorable' : scoreColor === NEG ? 'À risque' : 'Mitigé', scoreColor === POS ? 'Favorable' : scoreColor === NEG ? 'Risky' : 'Mixed') : t('Aucun changement', 'No change')}</div>
          </div>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb size={15} style={{ color: CYAN }} />
            <h3 style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>{t('Analyste IA', 'AI Analyst')}</h3>
            {analysis && <span className="rounded-sm px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 9, color: analysis.aiUsed ? CYAN : 'var(--nx-outline)', border: `1px solid ${analysis.aiUsed ? 'rgba(0,229,255,0.4)' : 'var(--nx-border)'}` }}>{analysis.aiUsed ? t('IA', 'AI') : t('RÈGLES', 'RULES')}</span>}
            {busy && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--nx-outline)' }} />}
          </div>
          {analysis ? (
            <div className="flex flex-col gap-2.5">
              <div style={{ fontFamily: geist, fontSize: 15, color: 'var(--nx-text)' }}>{analysis.headline}</div>
              <p style={{ fontSize: 13.5, color: 'var(--nx-text)', lineHeight: 1.55 }}>{analysis.narrative}</p>
              <div className="grid gap-3 md:grid-cols-3">
                {analysis.consequences.length > 0 && <IconList icon={CircleCheck} color={POS} title={t('Conséquences', 'Consequences')} items={analysis.consequences} />}
                {analysis.risks.length > 0 && <IconList icon={AlertTriangle} color="#c69a4e" title={t('Risques', 'Risks')} items={analysis.risks} />}
                <IconList icon={ArrowRight} color={CYAN} title={t('Recommandation', 'Recommendation')} items={[analysis.recommendation]} />
              </div>
            </div>
          ) : <p style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Décrivez une décision concrète (ex. « prendre 20 stagiaires ») pour une analyse.', 'Describe a concrete decision (e.g. “hire 20 interns”) for an analysis.')}</p>}
        </div>
      </div>

      {tab === 'levers' ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-4 rounded-lg border p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
            <h3 style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>{t('Leviers de décision', 'Decision levers')}</h3>
            <Lever label={t('Prix', 'Price')} unit="%" min={-20} max={20} step={1} value={levers.pricePct} onChange={(v) => setLevers({ ...levers, pricePct: v })} />
            <Lever label={t('Volume des ventes', 'Sales volume')} unit="%" min={-30} max={30} step={1} value={levers.volumePct} onChange={(v) => setLevers({ ...levers, volumePct: v })} />
            <Lever label={t('Effectif', 'Headcount')} unit={t('empl.', 'staff')} min={-400} max={600} step={10} value={levers.headcountDelta} onChange={(v) => setLevers({ ...levers, headcountDelta: v })} />
            <Lever label={t('Salaire moyen', 'Avg. salary')} unit="%" min={-10} max={15} step={1} value={levers.salaryPct} onChange={(v) => setLevers({ ...levers, salaryPct: v })} />
            <Lever label={t('Marketing', 'Marketing')} unit="%" min={-50} max={150} step={5} value={levers.marketingPct} onChange={(v) => setLevers({ ...levers, marketingPct: v })} />
            <Lever label={t('Coût des services', 'Cost of services')} unit={t('pts', 'pts')} min={-10} max={10} step={1} value={levers.cogsPts} onChange={(v) => setLevers({ ...levers, cogsPts: v })} />
          </div>
          <ComparePanel base={base} sim={sim} money={money} nf={nf} t={t} />
        </div>
      ) : tab === 'holo' ? hologram : (
        <CompareScenarios comparables={comparables} money={money} nf={nf} t={t} />
      )}
    </div>
  )
}

function ComparePanel({ base, sim, money, nf, t, compact }: { base: Metrics; sim: Metrics; money: (v: number) => string; nf: Intl.NumberFormat; t: (fr: string, en: string) => string; compact?: boolean }) {
  const chart = [
    { name: t('Revenu', 'Revenue'), actuel: base.revenue / 1e6, simule: sim.revenue / 1e6 },
    { name: 'EBITDA', actuel: base.ebitda / 1e6, simule: sim.ebitda / 1e6 },
    { name: t('Net', 'Net'), actuel: base.netProfit / 1e6, simule: sim.netProfit / 1e6 },
    { name: t('Tréso.', 'Cash'), actuel: base.ocf / 1e6, simule: sim.ocf / 1e6 },
  ]
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <h3 className="mb-3" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>{t('Actuel vs Simulé', 'Current vs Simulated')}</h3>
      <div style={{ height: 160 }} className="mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="2 6" stroke="var(--nx-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--nx-text-muted)', fontSize: 11, fontFamily: mono }} axisLine={{ stroke: 'var(--nx-border)' }} tickLine={false} />
            <YAxis tick={{ fill: 'var(--nx-text-muted)', fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} width={40} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', borderRadius: 6, fontFamily: mono, fontSize: 12 }} labelStyle={{ color: 'var(--nx-text)' }} formatter={(v, n) => [`${Number(v).toFixed(1)} M$`, String(n) === 'actuel' ? t('Actuel', 'Current') : t('Simulé', 'Simulated')]} />
            <Bar dataKey="actuel" fill="#5f7079" radius={[2, 2, 0, 0]} />
            <Bar dataKey="simule" radius={[2, 2, 0, 0]}>
              {chart.map((c, i) => <Cell key={i} fill={c.simule >= c.actuel ? '#3fb27f' : '#d15b54'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={compact ? 'grid gap-x-6 gap-y-1' : 'grid gap-x-6 gap-y-1 md:grid-cols-2'}>
        <Compare label={t('Revenu', 'Revenue')} a={base.revenue} b={sim.revenue} fmt={money} />
        <Compare label={t('Marge brute', 'Gross profit')} a={base.grossProfit} b={sim.grossProfit} fmt={money} />
        <Compare label="EBITDA" a={base.ebitda} b={sim.ebitda} fmt={money} />
        <Compare label={t('Résultat net', 'Net profit')} a={base.netProfit} b={sim.netProfit} fmt={money} />
        <Compare label={t('Marge EBITDA', 'EBITDA margin')} a={base.ebitdaMargin * 100} b={sim.ebitdaMargin * 100} fmt={(v) => `${v.toFixed(1)}%`} />
        <Compare label={t('Marge nette', 'Net margin')} a={base.netMargin * 100} b={sim.netMargin * 100} fmt={(v) => `${v.toFixed(1)}%`} />
        <Compare label={t('Flux de trésorerie', 'Cash flow')} a={base.ocf} b={sim.ocf} fmt={money} />
        <Compare label={t('Effectif', 'Headcount')} a={base.headcount} b={sim.headcount} fmt={(v) => nf.format(Math.round(v))} />
      </div>
    </div>
  )
}

interface Comparable { id: string; name: string; m: Metrics; base: Metrics; score: number }
function CompareScenarios({ comparables, money, nf, t }: { comparables: Comparable[]; money: (v: number) => string; nf: Intl.NumberFormat; t: (fr: string, en: string) => string }) {
  if (comparables.length <= 1) {
    return (
      <div className="rounded-lg border p-10 text-center" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontSize: 14 }}>
        {t('Sauvegardez au moins un scénario (console ci-dessus) pour le comparer au scénario actuel.', 'Save at least one scenario (console above) to compare it with the current one.')}
      </div>
    )
  }
  const rows: { label: string; get: (c: Comparable) => number; fmt: (v: number) => string; best: boolean }[] = [
    { label: t('Revenu', 'Revenue'), get: (c) => c.m.revenue, fmt: money, best: true },
    { label: 'EBITDA', get: (c) => c.m.ebitda, fmt: money, best: true },
    { label: t('Résultat net', 'Net profit'), get: (c) => c.m.netProfit, fmt: money, best: true },
    { label: t('Trésorerie', 'Cash flow'), get: (c) => c.m.ocf, fmt: money, best: true },
    { label: t('Marge nette', 'Net margin'), get: (c) => c.m.netMargin * 100, fmt: (v) => `${v.toFixed(1)}%`, best: true },
    { label: t('Effectif', 'Headcount'), get: (c) => c.m.headcount, fmt: (v) => nf.format(Math.round(v)), best: false },
  ]
  const winnerId = comparables.reduce((a, b) => (b.score > a.score ? b : a)).id
  const chart = comparables.map((c) => ({ name: c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name, net: c.m.netProfit / 1e6, score: c.score }))

  return (
    <div className="flex flex-col gap-4">
      {/* Graphique : résultat net par scénario */}
      <div className="rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
        <h3 className="mb-3 flex items-center gap-2" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}><Scale size={14} /> {t('Résultat net par scénario (M$)', 'Net profit by scenario (M$)')}</h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 6" stroke="var(--nx-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--nx-text-muted)', fontSize: 11, fontFamily: mono }} axisLine={{ stroke: 'var(--nx-border)' }} tickLine={false} />
              <YAxis tick={{ fill: 'var(--nx-text-muted)', fontSize: 11, fontFamily: mono }} axisLine={false} tickLine={false} width={40} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', borderRadius: 6, fontFamily: mono, fontSize: 12 }} formatter={(v) => [`${Number(v).toFixed(1)} M$`, t('Résultat net', 'Net profit')]} />
              <Bar dataKey="net" radius={[3, 3, 0, 0]}>
                {chart.map((_, i) => <Cell key={i} fill={comparables[i].id === winnerId ? '#3fb27f' : '#5f7079'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tableau comparatif */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--nx-border)' }}>
              <th className="p-3 text-left" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Métrique', 'Metric')}</th>
              {comparables.map((c) => (
                <th key={c.id} className="p-3 text-right" style={{ fontFamily: geist, fontSize: 13, color: c.id === winnerId ? POS : 'var(--nx-text)', whiteSpace: 'nowrap' }}>
                  <span className="inline-flex items-center gap-1">{c.id === winnerId && <Trophy size={13} />}{c.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const vals = comparables.map(r.get)
              const bestVal = r.best ? Math.max(...vals) : NaN
              return (
                <tr key={r.label} style={{ borderBottom: '1px solid rgba(59,73,76,0.2)' }}>
                  <td className="p-3" style={{ color: 'var(--nx-text-muted)' }}>{r.label}</td>
                  {comparables.map((c, i) => {
                    const isBest = r.best && vals[i] === bestVal && comparables.length > 1
                    return <td key={c.id} className="p-3 text-right" style={{ fontFamily: mono, color: isBest ? POS : 'var(--nx-text)', fontWeight: isBest ? 700 : 400 }}>{r.fmt(vals[i])}</td>
                  })}
                </tr>
              )
            })}
            {/* Ligne score */}
            <tr style={{ background: 'rgba(0,229,255,0.04)' }}>
              <td className="p-3" style={{ color: CYAN, fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Score de décision', 'Decision score')}</td>
              {comparables.map((c) => (
                <td key={c.id} className="p-3 text-right" style={{ fontFamily: geist, fontSize: 16, color: c.id === winnerId ? POS : 'var(--nx-text)', fontWeight: c.id === winnerId ? 700 : 400 }}>{c.score}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>
        <Trophy size={11} style={{ color: POS }} /> {t('Meilleur scénario surligné · valeurs recalculées par le moteur.', 'Best scenario highlighted · values recomputed by the engine.')}
      </p>
    </div>
  )
}

function IconList({ icon: Icon, color, title, items }: { icon: typeof Lightbulb; color: string; title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase', color }}><Icon size={12} /> {title}</div>
      <ul className="flex flex-col gap-1">{items.map((x, i) => <li key={i} className="flex gap-1.5" style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.4 }}><span style={{ color }}>•</span><span>{x}</span></li>)}</ul>
    </div>
  )
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <h3 className="mb-2" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>{title}</h3>
      {children}
    </div>
  )
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{label}</label>{children}</div>
}
function NumRow({ label, value, onChange, step = 100000 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return <Row label={label}><input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-sm border px-2 py-1 outline-none" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 12 }} /></Row>
}
function ToolBtn({ onClick, active, icon: Icon, children }: { onClick: () => void; active?: boolean; icon: typeof Plus; children: React.ReactNode }) {
  return <button onClick={onClick} className="flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 transition-colors" style={{ borderColor: active ? CYAN : 'var(--nx-border)', background: active ? 'rgba(0,229,255,0.1)' : 'var(--nx-panel)', color: active ? 'var(--nx-cyan-text)' : 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}><Icon size={14} /> {children}</button>
}
function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Box; children: React.ReactNode }) {
  return <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 transition-colors" style={{ background: active ? 'rgba(0,229,255,0.1)' : 'transparent', color: active ? 'var(--nx-cyan-text)' : 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12 }}><Icon size={14} /> {children}</button>
}
function Lever({ label, unit, min, max, step, value, onChange }: { label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  const active = value !== 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label style={{ fontSize: 13, color: 'var(--nx-text)' }}>{label}</label>
        <span style={{ fontFamily: mono, fontSize: 12, color: active ? CYAN : 'var(--nx-text-muted)' }}>{value > 0 ? '+' : ''}{value} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" style={{ accentColor: '#00e5ff' }} />
    </div>
  )
}
function Compare({ label, a, b, fmt }: { label: string; a: number; b: number; fmt: (v: number) => string }) {
  const delta = b - a
  const pct = a !== 0 ? (delta / Math.abs(a)) * 100 : 0
  const col = Math.abs(delta) < 1e-6 ? 'var(--nx-text-muted)' : delta > 0 ? POS : NEG
  const Icon = Math.abs(delta) < 1e-6 ? Minus : delta > 0 ? TrendingUp : TrendingDown
  return (
    <div className="flex items-center justify-between border-b py-1.5" style={{ borderColor: 'rgba(59,73,76,0.25)' }}>
      <span style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{label}</span>
      <div className="flex items-baseline gap-2" style={{ fontFamily: mono, fontSize: 12 }}>
        <span style={{ color: 'var(--nx-text-muted)' }}>{fmt(a)}</span>
        <ArrowRight size={11} style={{ color: 'var(--nx-outline)' }} />
        <span style={{ color: 'var(--nx-text)', fontWeight: 600 }}>{fmt(b)}</span>
        <span className="flex w-14 items-center justify-end gap-0.5" style={{ color: col }}><Icon size={11} />{Math.abs(pct) >= 0.05 ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}</span>
      </div>
    </div>
  )
}
function Ring({ value, color }: { value: number; color: string }) {
  const r = 30, C = 2 * Math.PI * r
  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--nx-surface-high)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - value / 100)} style={{ transition: 'stroke-dashoffset 300ms' }} />
      </svg>
      <div className="absolute flex items-center gap-0.5" style={{ fontFamily: geist, fontSize: 22, color: 'var(--nx-text)' }}><Gauge size={13} style={{ color }} />{value}</div>
    </div>
  )
}
