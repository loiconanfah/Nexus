import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Building2, TrendingUp, TrendingDown, Users, MapPin, Contact, Truck, FolderKanban, ArrowRight,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { EnterpriseModel as EM } from '../lib/types'

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
const QUALITY_LABEL: [keyof EM['dataQuality'], string, string][] = [
  ['finance', 'Finance', 'Finance'],
  ['sales', 'Ventes', 'Sales'],
  ['hr', 'RH', 'HR'],
  ['operations', 'Opérations', 'Operations'],
  ['customers', 'Clients', 'Customers'],
]

export function EnterpriseModel() {
  const { t, lang } = useLang()
  const nav = useNavigate()
  const { data, isLoading, error } = useQuery({ queryKey: ['enterprise-model'], queryFn: api.enterpriseModel })

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
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border p-16 text-center" style={{ borderColor: 'var(--nx-border)' }}>
        <Building2 size={40} style={{ color: 'var(--nx-outline)' }} />
        <h2 style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>{t('Modèle d’entreprise non configuré', 'Enterprise model not configured')}</h2>
        <p style={{ fontSize: 14, color: 'var(--nx-text-muted)', maxWidth: 460 }}>
          {t('Importez vos données financières et opérationnelles pour construire le jumeau décisionnel de votre entreprise.', 'Import your financial and operational data to build your decision twin.')}
        </p>
      </div>
    )
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
        <a href="/decision" onClick={(e) => { e.preventDefault(); nav('/decision') }} className="flex items-center gap-1" style={{ fontSize: 12, color: 'var(--nx-cyan-text)' }}>
          {t('Simuler une décision', 'Simulate a decision')} <ArrowRight size={12} />
        </a>
      </div>

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

        {/* Structure de coûts */}
        <Panel title={t('Structure de coûts (% du revenu)', 'Cost structure (% of revenue)')}>
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

        {/* Qualité des données */}
        <Panel title={t('Qualité des données', 'Data quality')}>
          <div className="flex flex-col gap-2.5">
            {QUALITY_LABEL.map(([key, fr, en]) => {
              const v = data.dataQuality[key]
              const col = v >= 90 ? POS : v >= 75 ? '#c69a4e' : NEG
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between" style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--nx-text)' }}>{t(fr, en)}</span>
                    <span style={{ fontFamily: mono, color: col }}>{v}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-high)' }}>
                    <div className="h-full rounded-full" style={{ width: `${v}%`, background: col }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>
            <ArrowRight size={11} /> {t('Données de démonstration — cohérentes mais fictives.', 'Demonstration data — coherent but fictional.')}
          </p>
        </Panel>
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
