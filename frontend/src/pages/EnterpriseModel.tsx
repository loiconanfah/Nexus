import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Building2, TrendingUp, TrendingDown, Users, MapPin, Contact, Truck, FolderKanban, ArrowRight,
  Pencil, History, X, RotateCcw, Save,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { EnterpriseModel as EM, ModelVersion } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const POS = '#3fb27f'
const NEG = '#d15b54'

const KPI_LABEL: Record<string, [string, string]> = {
  revenue: ['Revenu annuel', 'Annual revenue'],
  ebitdaMargin: ['Marge EBITDA', 'EBITDA margin'],
  netMargin: ['Marge nette', 'Net margin'],
  headcount: ['Effectif', 'Headcount'],
  revenuePerEmployee: ['Revenu / employé', 'Revenue / employee'],
  customers: ['Clients', 'Customers'],
  cashOnHand: ['Trésorerie', 'Cash on hand'],
  churn: ['Attrition', 'Churn'],
}
const COST_LABEL: Record<string, [string, string]> = {
  delivery: ['Livraison (coût des services)', 'Delivery (cost of services)'],
  sgaSalaries: ['Salaires SG&A', 'SG&A salaries'],
  ga: ['Frais généraux', 'General & admin'],
  rnd: ['R&D', 'R&D'],
  marketing: ['Marketing', 'Marketing'],
  depreciation: ['Amortissements', 'Depreciation'],
}
type Ratio = { fr: string; en: string; value: string; pct?: number; tone?: 'good' | 'warn' | 'bad' }
/** Ratios de rentabilité, d'efficacité et de solidité, dérivés du modèle. */
function ratios(d: EM, currency: string, money: (v: number, c: string) => string): Ratio[] {
  const rev = d.pnl.revenue || 1
  const monthlyBurn = (d.pnl.cogs + d.pnl.opex.total) / 12
  const runway = monthlyBurn > 0 ? d.cash.cashOnHand / monthlyBurn : 0
  const revPerEmp = d.pnl.revenue / Math.max(1, d.company.employees)
  return [
    { fr: 'Marge brute', en: 'Gross margin', value: `${(d.pnl.grossMargin * 100).toFixed(1)}%`, pct: d.pnl.grossMargin * 100, tone: d.pnl.grossMargin >= 0.5 ? 'good' : d.pnl.grossMargin >= 0.3 ? 'warn' : 'bad' },
    { fr: 'Marge EBITDA', en: 'EBITDA margin', value: `${(d.pnl.ebitdaMargin * 100).toFixed(1)}%`, pct: d.pnl.ebitdaMargin * 100, tone: d.pnl.ebitdaMargin >= 0.2 ? 'good' : d.pnl.ebitdaMargin >= 0.1 ? 'warn' : 'bad' },
    { fr: 'Marge nette', en: 'Net margin', value: `${(d.pnl.netMargin * 100).toFixed(1)}%`, pct: d.pnl.netMargin * 100, tone: d.pnl.netMargin >= 0.1 ? 'good' : d.pnl.netMargin >= 0 ? 'warn' : 'bad' },
    { fr: 'Marketing / revenu', en: 'Marketing / revenue', value: `${(d.pnl.opex.marketing / rev * 100).toFixed(1)}%`, pct: d.pnl.opex.marketing / rev * 100 },
    { fr: 'R&D / revenu', en: 'R&D / revenue', value: `${(d.pnl.opex.rnD / rev * 100).toFixed(1)}%`, pct: d.pnl.opex.rnD / rev * 100 },
    { fr: 'Autonomie trésorerie', en: 'Cash runway', value: `${runway.toFixed(1)} ${'mois'}`, tone: runway >= 12 ? 'good' : runway >= 6 ? 'warn' : 'bad' },
    { fr: 'Revenu / employé', en: 'Revenue / employee', value: money(revPerEmp, currency) },
    { fr: 'Attrition', en: 'Churn', value: `${(d.drivers.churnRate * 100).toFixed(1)}%`, tone: d.drivers.churnRate <= 0.05 ? 'good' : d.drivers.churnRate <= 0.12 ? 'warn' : 'bad' },
  ]
}

// Leviers éditables : `key` = clé envoyée à l'API (le backend lie sans casse) ;
// `src` = champ correspondant dans le modèle résolu (drivers.rnD, etc.).
// `pct` = valeur stockée en fraction (0–1) mais saisie en pourcentage.
type DriverField = { key: string; src: keyof EM['drivers']; fr: string; en: string; pct?: boolean }
const DRIVER_FIELDS: DriverField[] = [
  { key: 'units', src: 'units', fr: 'Clients / abonnés (par an)', en: 'Customers / subscribers (per year)' },
  { key: 'avgPrice', src: 'avgPrice', fr: 'Prix moyen unitaire', en: 'Average unit price' },
  { key: 'cogsPercent', src: 'cogsPercent', fr: 'Coût des ventes (% du revenu)', en: 'Cost of sales (% of revenue)', pct: true },
  { key: 'churnRate', src: 'churnRate', fr: 'Attrition annuelle (%)', en: 'Annual churn (%)', pct: true },
  { key: 'headcount', src: 'headcount', fr: 'Effectif (= employés)', en: 'Headcount (= employees)' },
  { key: 'avgSalary', src: 'avgSalary', fr: 'Salaire moyen chargé', en: 'Average loaded salary' },
  { key: 'billableRatio', src: 'billableRatio', fr: 'Taux facturable (%)', en: 'Billable ratio (%)', pct: true },
  { key: 'marketing', src: 'marketing', fr: 'Marketing', en: 'Marketing' },
  { key: 'rnd', src: 'rnD', fr: 'R&D', en: 'R&D' },
  { key: 'ga', src: 'ga', fr: 'Frais généraux & admin', en: 'General & admin' },
  { key: 'depreciation', src: 'depreciation', fr: 'Amortissements', en: 'Depreciation' },
  { key: 'interest', src: 'interest', fr: 'Charges d’intérêts', en: 'Interest expense' },
  { key: 'taxRate', src: 'taxRate', fr: 'Taux d’imposition (%)', en: 'Tax rate (%)', pct: true },
  { key: 'cashOnHand', src: 'cashOnHand', fr: 'Trésorerie disponible', en: 'Cash on hand' },
]

// Compteurs structurels (en-tête) : alimentés par company.* et renvoyés dans les
// leviers. `key` = clé API ; `src` = champ du profil courant pour le pré-remplissage.
type StructField = { key: string; src: keyof EM['company']; fr: string; en: string }
const STRUCT_FIELDS: StructField[] = [
  { key: 'divisions', src: 'divisions', fr: 'Divisions', en: 'Divisions' },
  { key: 'locations', src: 'locations', fr: 'Sites / implantations', en: 'Locations' },
  { key: 'suppliers', src: 'suppliers', fr: 'Fournisseurs', en: 'Suppliers' },
  { key: 'projects', src: 'projects', fr: 'Projets actifs', en: 'Active projects' },
]

export function EnterpriseModel() {
  const { t, lang } = useLang()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [panel, setPanel] = useState<'none' | 'edit' | 'history'>('none')
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['enterprise-model'], queryFn: api.enterpriseModel })

  const nf = new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA')
  function money(v: number, cur: string): string {
    const abs = Math.abs(v)
    if (abs >= 1e6) return `${(v / 1e6).toFixed(abs >= 1e8 ? 0 : 1)} M${cur === 'CAD' ? '$' : ''}`
    if (abs >= 1e3) return `${(v / 1e3).toFixed(0)} k${cur === 'CAD' ? '$' : ''}`
    return nf.format(Math.round(v))
  }

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('CHARGEMENT DU MODÈLE D’ENTREPRISE…', 'LOADING ENTERPRISE MODEL…')}</div>
  if (error) return <div style={{ color: NEG }}>{(error as Error).message}</div>
  if (!data) return null

  if (!data.configured) {
    return <ModelWizard onDone={() => refetch()} />
  }

  const { company, pnl, cash, currency } = data
  const trendData = data.trend.map((p) => ({ name: p.month, revenue: p.revenue / 1e6, ebitda: p.ebitda / 1e6, net: p.netProfit / 1e6 }))

  return (
    <div className="flex flex-col gap-5">
      {/* Bannière de but : jumeau descriptif */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: CYAN }}>{t('Jumeau descriptif', 'Descriptive twin')}</span>
          <span style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>· {t('L’état actuel et la structure de l’entreprise.', 'The current state and structure of the company.')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPanel('edit')} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5" style={{ borderColor: 'var(--nx-border)', fontSize: 12, color: 'var(--nx-text)' }}>
            <Pencil size={13} /> {t('Modifier les données', 'Edit data')}
          </button>
          <button onClick={() => setPanel('history')} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5" style={{ borderColor: 'var(--nx-border)', fontSize: 12, color: 'var(--nx-text)' }}>
            <History size={13} /> {t('Historique', 'History')}
          </button>
          <a href="/decision" onClick={(e) => { e.preventDefault(); nav('/decision') }} className="flex items-center gap-1" style={{ fontSize: 12, color: 'var(--nx-cyan-text)' }}>
            {t('Simuler une décision', 'Simulate a decision')} <ArrowRight size={12} />
          </a>
        </div>
      </div>

      {panel === 'edit' && (
        <EditModal
          model={data}
          onClose={() => setPanel('none')}
          onSaved={() => { setPanel('none'); refetch(); qc.invalidateQueries({ queryKey: ['enterprise-history'] }) }}
        />
      )}
      {panel === 'history' && (
        <HistoryModal
          onClose={() => setPanel('none')}
          onRestored={() => { setPanel('none'); refetch(); qc.invalidateQueries({ queryKey: ['enterprise-history'] }) }}
        />
      )}

      {/* En-tête entreprise */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded" style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)' }}>
            <Building2 size={24} style={{ color: CYAN }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 style={{ fontFamily: geist, fontSize: 22, color: 'var(--nx-text)' }}>{company.name}</h2>
              {data.isDemo && (
                <span className="rounded-sm px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.1em', color: '#e0b23c', border: '1px solid rgba(224,178,60,0.4)', background: 'rgba(224,178,60,0.08)' }}>DEMO DATA</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{company.industry}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Stat icon={Users} label={t('Employés', 'Employees')} value={nf.format(company.employees)} />
          <Stat icon={Building2} label={t('Divisions', 'Divisions')} value={String(company.divisions)} />
          <Stat icon={MapPin} label={t('Sites', 'Locations')} value={String(company.locations)} />
          <Stat icon={Contact} label={t('Clients', 'Customers')} value={nf.format(company.customers)} />
          <Stat icon={Truck} label={t('Fournisseurs', 'Suppliers')} value={nf.format(company.suppliers)} />
          <Stat icon={FolderKanban} label={t('Projets', 'Projects')} value={String(company.projects)} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.kpis.map((k) => {
          const isPct = k.unit === '%'
          const val = isPct ? `${k.value.toFixed(1)}%` : k.unit === currency ? money(k.value, currency) : nf.format(Math.round(k.value))
          const good = k.key === 'churn' ? k.deltaPercent < 0 : k.deltaPercent >= 0
          return (
            <div key={k.key} className="rounded-lg border p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t(KPI_LABEL[k.key]?.[0] ?? k.key, KPI_LABEL[k.key]?.[1] ?? k.key)}</div>
              <div className="mt-1" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>{val}</div>
              <div className="mt-0.5 flex items-center gap-1" style={{ fontFamily: mono, fontSize: 11, color: good ? POS : NEG }}>
                {good ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {k.deltaPercent > 0 ? '+' : ''}{k.deltaPercent}%
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* P&L */}
        <div className="rounded-lg border p-5 lg:col-span-1" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <h3 className="mb-3" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>{t('Compte de résultat (annualisé)', 'Income statement (annualized)')}</h3>
          <PnlRow label={t('Revenu', 'Revenue')} value={money(pnl.revenue, currency)} strong />
          <PnlRow label={t('− Coût des services', '− Cost of services')} value={money(-pnl.cogs, currency)} />
          <PnlRow label={t('Marge brute', 'Gross profit')} value={money(pnl.grossProfit, currency)} sub={`${(pnl.grossMargin * 100).toFixed(1)}%`} strong />
          <PnlRow label={t('− Charges d’exploitation', '− Operating expenses')} value={money(-pnl.opex.total, currency)} />
          <PnlRow label="EBITDA" value={money(pnl.ebitda, currency)} sub={`${(pnl.ebitdaMargin * 100).toFixed(1)}%`} strong accent />
          <PnlRow label={t('− Amortissements', '− Depreciation')} value={money(-pnl.depreciation, currency)} />
          <PnlRow label="EBIT" value={money(pnl.ebit, currency)} />
          <PnlRow label={t('− Intérêts & impôts', '− Interest & tax')} value={money(-(pnl.interest + pnl.tax), currency)} />
          <PnlRow label={t('Résultat net', 'Net profit')} value={money(pnl.netProfit, currency)} sub={`${(pnl.netMargin * 100).toFixed(2)}%`} strong accent />
          <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--nx-border)' }}>
            <PnlRow label={t('Flux de trésorerie d’exploitation', 'Operating cash flow')} value={money(cash.operatingCashFlow, currency)} />
            <PnlRow label={t('Flux de trésorerie libre', 'Free cash flow')} value={money(cash.freeCashFlow, currency)} />
          </div>
        </div>

        {/* Tendance 12 mois */}
        <div className="rounded-lg border p-5 lg:col-span-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <h3 className="mb-3" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>{t('Tendance 12 mois (M$)', '12-month trend (M$)')}</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="gr-rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00e5ff" stopOpacity={0.35} /><stop offset="100%" stopColor="#00e5ff" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gr-eb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3fb27f" stopOpacity={0.3} /><stop offset="100%" stopColor="#3fb27f" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke="var(--nx-border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--nx-text-muted)', fontSize: 11, fontFamily: mono }} axisLine={{ stroke: 'var(--nx-border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--nx-text-muted)', fontSize: 11, fontFamily: mono }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ background: 'var(--nx-surface)', border: '1px solid var(--nx-border)', borderRadius: 6, fontFamily: mono, fontSize: 12 }} labelStyle={{ color: 'var(--nx-text)' }} formatter={(value, name) => { const n = String(name); return [`${Number(value).toFixed(1)} M$`, n === 'revenue' ? t('Revenu', 'Revenue') : n === 'ebitda' ? 'EBITDA' : t('Net', 'Net')] }} />
                <Area type="monotone" dataKey="revenue" stroke="#00e5ff" strokeWidth={2} fill="url(#gr-rev)" />
                <Area type="monotone" dataKey="ebitda" stroke="#3fb27f" strokeWidth={2} fill="url(#gr-eb)" />
                <Area type="monotone" dataKey="net" stroke="#c69a4e" strokeWidth={1.5} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Divisions */}
        <Panel title={t('Performance par division', 'Performance by division')}>
          <div className="flex flex-col gap-2.5">
            {data.divisions.map((d) => {
              const max = Math.max(...data.divisions.map((x) => x.revenue))
              return (
                <div key={d.name}>
                  <div className="flex items-baseline justify-between" style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--nx-text)' }}>{d.name}</span>
                    <span style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{money(d.revenue, currency)} · {(d.margin * 100).toFixed(0)}% · {nf.format(d.employees)} {t('empl.', 'staff')}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-high)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(d.revenue / max) * 100}%`, background: CYAN }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* Segments clients */}
        <Panel title={t('Revenu par segment client', 'Revenue by customer segment')}>
          <div className="flex flex-col gap-2.5">
            {data.segments.map((s) => (
              <div key={s.name}>
                <div className="flex items-baseline justify-between" style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--nx-text)' }}>{s.name}</span>
                  <span style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{money(s.revenue, currency)} · {(s.share * 100).toFixed(0)}% · {nf.format(s.customers)} {t('clients', 'clients')}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-high)' }}>
                  <div className="h-full rounded-full" style={{ width: `${s.share * 100}%`, background: '#8b7fc0' }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Où va chaque dollar de revenu */}
        <Panel title={t('Où va chaque dollar de revenu', 'Where each revenue dollar goes')}>
          <div className="flex flex-col gap-2.5">
            {data.costStructure.map((c) => (
              <div key={c.key}>
                <div className="flex items-baseline justify-between" style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--nx-text)' }}>{t(COST_LABEL[c.key]?.[0] ?? c.key, COST_LABEL[c.key]?.[1] ?? c.key)}</span>
                  <span style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{money(c.amount, currency)} · {(c.percent * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-high)' }}>
                  <div className="h-full rounded-full" style={{ width: `${c.percent * 100}%`, background: '#c69a4e' }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Ratios & santé financière */}
        <Panel title={t('Ratios & santé financière', 'Ratios & financial health')}>
          <div className="flex flex-col gap-2.5">
            {ratios(data, currency, money).map((r, i) => {
              const col = r.tone === 'good' ? POS : r.tone === 'warn' ? '#c69a4e' : r.tone === 'bad' ? NEG : 'var(--nx-text-muted)'
              return (
                <div key={i}>
                  <div className="flex items-baseline justify-between" style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--nx-text)' }}>{t(r.fr, r.en)}</span>
                    <span style={{ fontFamily: mono, color: col }}>{r.value}</span>
                  </div>
                  {r.pct !== undefined && (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-high)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, r.pct))}%`, background: r.tone ? col : '#4bb3c9' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ── Fenêtre : éditer librement les données du modèle + note de version ──
function EditModal({ model, onClose, onSaved }: { model: EM; onClose: () => void; onSaved: () => void }) {
  const { t } = useLang()
  const initial: Record<string, string> = { company: model.company.name, industry: model.company.industry, note: '' }
  for (const f of DRIVER_FIELDS) {
    const raw = model.drivers[f.src]
    initial[f.key] = String(f.pct ? +(raw * 100).toFixed(4) : raw)
  }
  for (const f of STRUCT_FIELDS) initial[f.key] = String(model.company[f.src] ?? 0)
  const [form, setForm] = useState<Record<string, string>>(initial)
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const num = (k: string) => Number.parseFloat(form[k] || '') || 0
  const revenueOk = num('units') > 0 && num('avgPrice') > 0 && form.company.trim().length > 0

  const save = useMutation({ mutationFn: api.saveEnterpriseModel, onSuccess: () => onSaved() })

  function submit() {
    const drivers: Record<string, number> = {}
    for (const f of DRIVER_FIELDS) drivers[f.key] = f.pct ? num(f.key) / 100 : num(f.key)
    for (const f of STRUCT_FIELDS) drivers[f.key] = Math.max(0, Math.round(num(f.key)))
    save.mutate({ companyName: form.company.trim(), industry: form.industry.trim(), drivers, note: form.note.trim() || undefined })
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="flex items-center gap-2">
          <Pencil size={16} style={{ color: CYAN }} />
          <h3 style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{t('Modifier le modèle d’entreprise', 'Edit the enterprise model')}</h3>
        </div>
        <button onClick={onClose} style={{ color: 'var(--nx-text-muted)' }}><X size={18} /></button>
      </div>
      <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: '62vh' }}>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <WInput label={t('Nom de l’entreprise', 'Company name')} value={form.company} onChange={(v) => set('company', v)} />
          <WInput label={t('Secteur d’activité', 'Industry')} value={form.industry} onChange={(v) => set('industry', v)} />
        </div>
        <SectionLabel>{t('Leviers financiers & opérationnels', 'Financial & operating drivers')}</SectionLabel>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {DRIVER_FIELDS.map((f) => (
            <WInput key={f.key} numeric suffix={f.pct ? '%' : undefined} label={t(f.fr, f.en)} value={form[f.key]} onChange={(v) => set(f.key, v)} />
          ))}
        </div>
        <SectionLabel>{t('Structure de l’organisation', 'Organization structure')}</SectionLabel>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {STRUCT_FIELDS.map((f) => (
            <WInput key={f.key} numeric label={t(f.fr, f.en)} value={form[f.key]} onChange={(v) => set(f.key, v)} />
          ))}
        </div>
        <div className="mt-2 border-t pt-3" style={{ borderColor: 'var(--nx-border)' }}>
          <WInput label={t('Note de version (optionnelle)', 'Version note (optional)')} value={form.note} onChange={(v) => set('note', v)} placeholder={t('ex. Ajustement du prix moyen', 'e.g. Adjusted average price')} />
        </div>
        {!revenueOk && <p style={{ fontSize: 12, color: 'var(--nx-outline)' }}>{t('Nom, unités et prix moyen sont requis (> 0).', 'Name, units and average price are required (> 0).')}</p>}
        {save.isError && <p style={{ fontSize: 12, color: NEG }}>{(save.error as Error).message}</p>}
      </div>
      <div className="flex items-center justify-end gap-2 border-t px-5 py-4" style={{ borderColor: 'var(--nx-border)' }}>
        <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>{t('Annuler', 'Cancel')}</button>
        <button onClick={submit} disabled={save.isPending || !revenueOk} className="flex items-center gap-1.5 rounded-md px-5 py-2 text-sm font-medium" style={{ background: CYAN, color: '#04121a', opacity: save.isPending || !revenueOk ? 0.6 : 1 }}>
          <Save size={15} /> {save.isPending ? t('Sauvegarde…', 'Saving…') : t('Sauvegarder', 'Save')}
        </button>
      </div>
    </Overlay>
  )
}

// ── Fenêtre : historique des versions + restauration ──
function HistoryModal({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
  const { t, lang } = useLang()
  const { data: versions, isLoading } = useQuery({ queryKey: ['enterprise-history'], queryFn: api.modelHistory })
  const restore = useMutation({ mutationFn: (v: ModelVersion) => api.restoreModelVersion(v.id), onSuccess: () => onRestored() })
  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="flex items-center gap-2">
          <History size={16} style={{ color: CYAN }} />
          <h3 style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{t('Historique des versions', 'Version history')}</h3>
        </div>
        <button onClick={onClose} style={{ color: 'var(--nx-text-muted)' }}><X size={18} /></button>
      </div>
      <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: '62vh' }}>
        {isLoading ? (
          <p style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('CHARGEMENT…', 'LOADING…')}</p>
        ) : !versions || versions.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Aucune version enregistrée pour le moment. Chaque sauvegarde en crée une.', 'No versions saved yet. Each save creates one.')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border px-4 py-3" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: CYAN, border: '1px solid rgba(0,229,255,0.3)' }}>v{v.version}</span>
                    <span style={{ fontSize: 13, color: 'var(--nx-text)' }}>{v.companyName}</span>
                    <span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>· {v.industry}</span>
                  </div>
                  <div className="mt-0.5 truncate" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
                    {fmt(v.createdAt)}{v.note ? ` — ${v.note}` : ''}
                  </div>
                </div>
                <button onClick={() => restore.mutate(v)} disabled={restore.isPending} className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5" style={{ borderColor: 'var(--nx-border)', fontSize: 12, color: 'var(--nx-text)', opacity: restore.isPending ? 0.6 : 1 }}>
                  <RotateCcw size={13} /> {t('Restaurer', 'Restore')}
                </button>
              </div>
            ))}
          </div>
        )}
        {restore.isError && <p className="mt-2" style={{ fontSize: 12, color: NEG }}>{(restore.error as Error).message}</p>}
      </div>
    </Overlay>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-1" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>{children}</div>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,8,12,0.66)' }} onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-bg)' }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} style={{ color: 'var(--nx-outline)' }} />
      <div>
        <div style={{ fontFamily: geist, fontSize: 16, color: 'var(--nx-text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</div>
      </div>
    </div>
  )
}

function PnlRow({ label, value, sub, strong, accent }: { label: string; value: string; sub?: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1" style={{ fontSize: 13 }}>
      <span style={{ color: strong ? 'var(--nx-text)' : 'var(--nx-text-muted)', fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span className="flex items-baseline gap-1.5" style={{ fontFamily: mono }}>
        {sub && <span style={{ fontSize: 10, color: 'var(--nx-outline)' }}>{sub}</span>}
        <span style={{ color: accent ? CYAN : strong ? 'var(--nx-text)' : 'var(--nx-text-muted)', fontWeight: strong ? 600 : 400 }}>{value}</span>
      </span>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <h3 className="mb-3" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>{title}</h3>
      {children}
    </div>
  )
}

// ── Formulaire multi-étapes : créer un modèle d'entreprise quand il n'existe pas ──
type WField = { key: string; fr: string; en: string; pct?: boolean }
const WIZARD_STEPS: { title: [string, string]; hint: [string, string]; fields: WField[] }[] = [
  {
    title: ['Revenus', 'Revenue'],
    hint: ['Combien vend l’entreprise, et à quel prix.', 'How much the company sells, and at what price.'],
    fields: [
      { key: 'units', fr: 'Unités / abonnés (par an)', en: 'Units / subscribers (per year)' },
      { key: 'avgPrice', fr: 'Prix moyen unitaire', en: 'Average unit price' },
      { key: 'cogsPercent', fr: 'Coût des ventes (% du revenu)', en: 'Cost of sales (% of revenue)', pct: true },
      { key: 'churnRate', fr: 'Attrition annuelle (%)', en: 'Annual churn (%)', pct: true },
    ],
  },
  {
    title: ['Effectif', 'Workforce'],
    hint: ['La masse salariale et sa part facturable.', 'Payroll and its billable share.'],
    fields: [
      { key: 'headcount', fr: 'Effectif total', en: 'Total headcount' },
      { key: 'avgSalary', fr: 'Salaire moyen chargé', en: 'Average loaded salary' },
      { key: 'billableRatio', fr: 'Taux facturable (%)', en: 'Billable ratio (%)', pct: true },
    ],
  },
  {
    title: ['Dépenses (OPEX)', 'Operating expenses'],
    hint: ['Dépenses annuelles hors salaires.', 'Annual expenses excluding salaries.'],
    fields: [
      { key: 'marketing', fr: 'Marketing', en: 'Marketing' },
      { key: 'rnd', fr: 'R&D', en: 'R&D' },
      { key: 'ga', fr: 'Frais généraux & admin', en: 'General & admin' },
    ],
  },
  {
    title: ['Capital & impôts', 'Capital & taxes'],
    hint: ['Amortissements, dette, fiscalité, trésorerie.', 'Depreciation, debt, taxes, cash.'],
    fields: [
      { key: 'depreciation', fr: 'Amortissements', en: 'Depreciation' },
      { key: 'interest', fr: 'Charges d’intérêts', en: 'Interest expense' },
      { key: 'taxRate', fr: 'Taux d’imposition (%)', en: 'Tax rate (%)', pct: true },
      { key: 'cashOnHand', fr: 'Trésorerie disponible', en: 'Cash on hand' },
    ],
  },
  {
    title: ['Structure de l’organisation', 'Organization structure'],
    hint: ['Compteurs de l’en-tête (n’affectent pas les finances).', 'Header counts (do not affect financials).'],
    fields: [
      { key: 'divisions', fr: 'Divisions', en: 'Divisions' },
      { key: 'locations', fr: 'Sites / implantations', en: 'Locations' },
      { key: 'suppliers', fr: 'Fournisseurs', en: 'Suppliers' },
      { key: 'projects', fr: 'Projets actifs', en: 'Active projects' },
    ],
  },
]

function ModelWizard({ onDone }: { onDone: () => void }) {
  const { t } = useLang()
  const [step, setStep] = useState(0) // 0 = identité, 1..4 = leviers
  const [form, setForm] = useState<Record<string, string>>({ company: '', industry: '' })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: api.saveEnterpriseModel,
    onSuccess: () => onDone(),
  })

  const TOTAL = WIZARD_STEPS.length + 1 // +1 pour l'étape identité
  const num = (k: string) => Number.parseFloat(form[k] || '') || 0
  const identityOk = form.company.trim().length > 0
  const revenueOk = num('units') > 0 && num('avgPrice') > 0
  const canNext = step === 0 ? identityOk : step === 1 ? revenueOk : true

  function submit() {
    const pct = (k: string) => num(k) / 100
    const drivers = {
      units: num('units'), avgPrice: num('avgPrice'), cogsPercent: pct('cogsPercent'),
      headcount: num('headcount'), avgSalary: num('avgSalary'), billableRatio: pct('billableRatio'),
      marketing: num('marketing'), rnd: num('rnd'), ga: num('ga'),
      depreciation: num('depreciation'), taxRate: pct('taxRate'), interest: num('interest'),
      cashOnHand: num('cashOnHand'), churnRate: pct('churnRate'),
      divisions: Math.round(num('divisions')), locations: Math.round(num('locations')),
      suppliers: Math.round(num('suppliers')), projects: Math.round(num('projects')),
    }
    save.mutate({ companyName: form.company.trim(), industry: form.industry.trim(), drivers })
  }

  const wz = step >= 1 ? WIZARD_STEPS[step - 1] : null

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Building2 size={22} style={{ color: CYAN }} />
          <h2 style={{ fontFamily: geist, fontSize: 22, color: 'var(--nx-text)' }}>
            {t('Créer le modèle d’entreprise', 'Create the enterprise model')}
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
          {t(
            'Renseignez les leviers de votre organisation. Le jumeau décisionnel (P&L, trésorerie, KPIs) est ensuite calculé automatiquement.',
            'Enter your organization’s drivers. The decision twin (P&L, cash, KPIs) is then computed automatically.',
          )}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? CYAN : 'var(--nx-border)' }} />
        ))}
      </div>

      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
        <div className="mb-1" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN }}>
          {t('Étape', 'Step')} {step + 1} / {TOTAL}
        </div>
        {step === 0 ? (
          <>
            <h3 className="mb-4" style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{t('Identité', 'Identity')}</h3>
            <WInput label={t('Nom de l’entreprise', 'Company name')} value={form.company} onChange={(v) => set('company', v)} placeholder={t('Mon organisation', 'My organization')} />
            <WInput label={t('Secteur d’activité', 'Industry')} value={form.industry} onChange={(v) => set('industry', v)} placeholder={t('ex. Télécommunications', 'e.g. Telecommunications')} />
          </>
        ) : wz ? (
          <>
            <h3 style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{t(wz.title[0], wz.title[1])}</h3>
            <p className="mb-4" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t(wz.hint[0], wz.hint[1])}</p>
            {wz.fields.map((f) => (
              <WInput
                key={f.key} numeric suffix={f.pct ? '%' : undefined}
                label={t(f.fr, f.en)} value={form[f.key] || ''} onChange={(v) => set(f.key, v)}
                placeholder={f.pct ? '0–100' : '0'}
              />
            ))}
          </>
        ) : null}

        {step === 1 && !revenueOk && (
          <p style={{ fontSize: 12, color: 'var(--nx-outline)' }}>
            {t('Unités et prix moyen sont requis (> 0).', 'Units and average price are required (> 0).')}
          </p>
        )}
        {save.isError && (
          <p style={{ fontSize: 12, color: NEG }}>{(save.error as Error).message}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-md border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', opacity: step === 0 ? 0.4 : 1 }}
        >
          {t('Précédent', 'Back')}
        </button>
        {step < TOTAL - 1 ? (
          <button
            onClick={() => canNext && setStep((s) => s + 1)}
            disabled={!canNext}
            className="flex items-center gap-1.5 rounded-md px-5 py-2 text-sm font-medium"
            style={{ background: canNext ? CYAN : 'var(--nx-border)', color: canNext ? '#04121a' : 'var(--nx-text-muted)' }}
          >
            {t('Suivant', 'Next')} <ArrowRight size={15} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={save.isPending || !revenueOk}
            className="rounded-md px-5 py-2 text-sm font-medium"
            style={{ background: CYAN, color: '#04121a', opacity: save.isPending || !revenueOk ? 0.6 : 1 }}
          >
            {save.isPending ? t('Création…', 'Creating…') : t('Créer le modèle', 'Create model')}
          </button>
        )}
      </div>
    </div>
  )
}

function WInput({ label, value, onChange, placeholder, numeric, suffix }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; numeric?: boolean; suffix?: string
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{label}</span>
      <div className="flex items-center rounded-md border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-bg)' }}>
        <input
          type={numeric ? 'number' : 'text'}
          inputMode={numeric ? 'decimal' : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-3 py-2 outline-none"
          style={{ fontFamily: numeric ? mono : 'inherit', fontSize: 14, color: 'var(--nx-text)' }}
        />
        {suffix && <span className="px-3" style={{ fontFamily: mono, fontSize: 13, color: 'var(--nx-outline)' }}>{suffix}</span>}
      </div>
    </label>
  )
}
