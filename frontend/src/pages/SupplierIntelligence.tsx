import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Play, Truck } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import type { Supplier, SupplierIntel } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = '#ffb4ab'

function bandColor(v: number): string {
  if (v >= 80) return ERR
  if (v >= 60) return '#fb923c'
  if (v >= 40) return '#facc15'
  return '#849396'
}

export function SupplierIntelligence() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { data, isLoading, error } = useQuery({ queryKey: ['suppliers'], queryFn: api.suppliers })
  const [selId, setSelId] = useState<string | null>(null)

  const suppliers = data?.suppliers ?? []
  const selected = suppliers.find((s) => s.id === selId) ?? suppliers[0]

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('ANALYSE DE LA CHAÎNE D’APPROVISIONNEMENT…', 'ANALYZING SUPPLY CHAIN…')}</div>
  if (error) return <div style={{ color: ERR }}>{(error as Error).message}</div>
  if (!data) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Header + tiles */}
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>{t('Intelligence fournisseurs', 'Supplier Intelligence')}</h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Comprenez comment les organisations externes influencent votre résilience opérationnelle.', 'Understand how external organizations influence your operational resilience.')}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-4 lg:w-auto">
          <Tile label={t('FOURNISSEURS CRITIQUES', 'CRITICAL SUPPLIERS')} value={data.summary.criticalSuppliers} color={ERR} />
          <Tile label={t('DÉPENDANCES UNIQUES', 'SINGLE DEPENDENCIES')} value={data.summary.singleDependencies} color="#fb923c" />
          <Tile label={t('CONCENTRATION', 'SUPPLIER CONCENTRATION')} value={`${data.summary.concentrationPercent}%`} color={CYAN_T} />
          <Tile label={t('CONTRATS EXPIRANT', 'CONTRACTS EXPIRING')} value={data.summary.contractsExpiring} color="var(--nx-text)" />
        </div>
      </div>

      {/* Map + detail */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-h-[340px] flex-1 rounded-sm border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          {selected && <NetworkMap data={data} selected={selected} onSupplier={setSelId} />}
        </div>
        {selected && <SupplierDetail supplier={selected} onSimulate={() => navigate(`/simulations?asset=${selected.id}&name=${encodeURIComponent(selected.name)}`)} />}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--nx-border)' }}>
          <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nx-text)' }}>{t('Profils de risque fournisseur', 'Supplier Risk Profiles')}</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
              {[t('Fournisseur', 'Supplier'), t('Services critiques', 'Critical Services'), t('Dépendances', 'Dependencies'), t('Concentration', 'Concentration'), t('Risque', 'Risk'), t('Alternatives', 'Alternatives')].map((h, i) => (
                <th key={h} className={`px-4 py-2 ${i >= 1 ? 'text-right' : ''}`} style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => {
              const c = bandColor(s.riskScore)
              const sel = selected?.id === s.id
              return (
                <tr key={s.id} onClick={() => setSelId(s.id)} className="cursor-pointer border-b transition-colors" style={{ borderBottomColor: 'var(--nx-border)', background: sel ? 'var(--nx-surface-high)' : 'transparent', borderLeft: `2px solid ${sel ? CYAN : 'transparent'}` }}>
                  <td className="px-4 py-3" style={{ fontSize: 13, fontWeight: 500, color: CYAN_T }}>{s.name}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: s.criticalServices > 0 ? ERR : 'var(--nx-text-muted)' }}>{s.criticalServices}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{s.dependencies}</td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{s.concentrationPercent}%</td>
                  <td className="px-4 py-3 text-right"><span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: c }}>{s.riskScore.toFixed(0)}</span></td>
                  <td className="px-4 py-3 text-right" style={{ fontFamily: mono, fontSize: 12, color: s.alternatives === 0 ? ERR : 'var(--nx-text-muted)' }}>{s.alternatives === 0 ? t('Aucune', 'None') : s.alternatives}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NetworkMap({ data, selected, onSupplier }: { data: SupplierIntel; selected: Supplier; onSupplier: (id: string) => void }) {
  const { t } = useLang()
  const assets = selected.dependents.slice(0, 8)
  const pos = useMemo(() => {
    const n = assets.length || 1
    return assets.map((name, i) => { const a = (i / n) * 2 * Math.PI - Math.PI / 2; return { name, x: 50 + Math.cos(a) * 34, y: 50 + Math.sin(a) * 32 } })
  }, [assets])
  const critical = new Set(data.edges.filter((e) => e.supplier === selected.name && e.assetCritical).map((e) => e.asset))

  return (
    <div className="relative h-full min-h-[340px] w-full">
      <div className="nx-grid absolute inset-0" />
      <div className="absolute left-3 top-3" style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Carte du réseau de dépendances', 'Dependency Network Map')}</div>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {pos.map((p) => <line key={`l${p.name}`} x1={50} y1={50} x2={p.x} y2={p.y} stroke={critical.has(p.name) ? ERR : CYAN} strokeWidth={0.4} opacity={0.5} />)}
        {pos.map((p) => (
          <g key={p.name}>
            <rect x={p.x - 9} y={p.y - 3} width={18} height={6} rx={1} fill="var(--nx-surface)" stroke={critical.has(p.name) ? ERR : 'var(--nx-border)'} strokeWidth={0.3} />
            <text x={p.x} y={p.y + 1.2} textAnchor="middle" fill="var(--nx-text)" fontFamily="JetBrains Mono" fontSize="2.6">{p.name}</text>
          </g>
        ))}
        <rect x={42} y={45} width={16} height={10} rx={1} fill="rgba(0,229,255,0.12)" stroke={CYAN} strokeWidth={0.6} />
        <text x={50} y={51.5} textAnchor="middle" fill={CYAN_T} fontFamily="JetBrains Mono" fontSize="3" fontWeight="700">{selected.name}</text>
      </svg>
      {/* Autres fournisseurs cliquables */}
      <div className="absolute bottom-3 left-3 flex gap-2">
        {data.suppliers.map((s) => (
          <button key={s.id} onClick={() => onSupplier(s.id)} className="rounded border px-2 py-1" style={{ fontFamily: mono, fontSize: 10, borderColor: s.id === selected.id ? CYAN : 'var(--nx-border)', color: s.id === selected.id ? CYAN_T : 'var(--nx-text-muted)', background: s.id === selected.id ? 'rgba(0,229,255,0.08)' : 'var(--nx-surface)' }}>{s.name}</button>
        ))}
      </div>
    </div>
  )
}

function SupplierDetail({ supplier, onSimulate }: { supplier: Supplier; onSimulate: () => void }) {
  const { t } = useLang()
  const c = bandColor(supplier.riskScore)
  const critPct = supplier.dependencies === 0 ? 0 : Math.round(100 * supplier.criticalServices / supplier.dependencies)
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 rounded-sm border p-5 lg:w-[320px]" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-start justify-between">
        <div>
          <h3 style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>{supplier.name}</h3>
          <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>ID · {supplier.id.slice(0, 8).toUpperCase()}</div>
        </div>
        {supplier.criticalServices > 0 && <span className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: ERR, background: 'rgba(255,180,171,0.15)', border: '1px solid rgba(255,180,171,0.3)' }}>{t('CRITIQUE', 'CRITICAL')}</span>}
      </div>

      <div className="rounded-sm border p-4 text-center" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
        <div style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Score de risque calculé', 'Calculated Risk Score')}</div>
        <div className="mt-1 flex items-baseline justify-center gap-1"><span style={{ fontFamily: geist, fontSize: 48, lineHeight: 1, color: c }}>{supplier.riskScore.toFixed(0)}</span><span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>/100</span></div>
      </div>

      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--nx-border)' }}>
        <Row label={t('Soutient services critiques', 'Supports Critical Svcs')} value={`${critPct}%`} />
        <Row label={t('Actifs connectés', 'Connected Assets')} value={String(supplier.connectedAssets)} />
        <Row label={t('Fournisseurs alternatifs', 'Alternative Suppliers')} value={supplier.alternatives === 0 ? t('Aucun', 'None') : String(supplier.alternatives)} danger={supplier.alternatives === 0} />
        <Row label={t('Concentration', 'Concentration')} value={`${supplier.concentrationPercent}%`} />
      </div>

      <button onClick={onSimulate} className="mt-auto flex w-full items-center justify-center gap-2 rounded-sm py-2.5" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600, boxShadow: '0 0 10px rgba(0,229,255,0.2)' }}><Play size={16} /> {t('Simuler la défaillance', 'Simulate Supplier Failure')}</button>
    </aside>
  )
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderColor: 'var(--nx-border)' }}>
      <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: danger ? ERR : 'var(--nx-text)' }}>{value}</span>
    </div>
  )
}

function Tile({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}><Truck size={10} /> {label}</div>
      <div style={{ fontFamily: geist, fontSize: 22, fontWeight: 500, color }}>{value}</div>
    </div>
  )
}
