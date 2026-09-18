import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Play, Truck } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { HubSpoke, PickerList, type Spoke } from '../components/HubSpoke'
import type { Supplier, SupplierIntel } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = 'var(--nx-danger)'

function bandColor(v: number): string {
  if (v >= 80) return ERR
  if (v >= 60) return 'var(--nx-orange)'
  if (v >= 40) return 'var(--nx-warning)'
  return 'var(--nx-text-muted)'
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
          <Tile label={t('DÉPENDANCES UNIQUES', 'SINGLE DEPENDENCIES')} value={data.summary.singleDependencies} color="var(--nx-orange)" />
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

  // Un service est dit critique quand la relation qui le lie au fournisseur
  // porte ce drapeau : c'est là que la perte du fournisseur fait vraiment mal.
  const critical = useMemo(
    () => new Set(data.edges.filter((e) => e.supplier === selected.name && e.assetCritical).map((e) => e.asset)),
    [data.edges, selected.name],
  )
  const spokes: Spoke[] = useMemo(
    () => selected.dependents.map((name) => ({ name, critical: critical.has(name) })),
    [selected.dependents, critical],
  )

  return (
    <div className="flex h-full min-h-[340px] w-full flex-col lg:flex-row">
      <PickerList
        title={t('Fournisseurs', 'Suppliers')}
        items={data.suppliers}
        selectedId={selected.id}
        onPick={onSupplier}
        meta={(s) => ({ text: s.riskScore.toFixed(0), color: bandColor(s.riskScore) })}
      />
      <div className="relative min-w-0 flex-1">
        <div className="nx-grid absolute inset-0" />
        <div className="relative flex items-baseline gap-2 px-4 pt-3">
          <span style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--nx-text-muted)' }}>
            {t('Ce qui dépend de ce fournisseur', 'What depends on this supplier')}
          </span>
          <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>
            {selected.dependents.length}
          </span>
        </div>
        <div className="relative px-2 pb-3 pt-1">
          <HubSpoke
            hub={selected.name}
            hubNote={selected.alternatives === 0 ? t('aucune alternative', 'no alternative') : t(`${selected.alternatives} alternative(s)`, `${selected.alternatives} alternative(s)`)}
            spokes={spokes}
            emptyLabel={t('Aucun service ne dépend de ce fournisseur dans la cartographie actuelle.',
                          'No service depends on this supplier in the current map.')}
          />
        </div>
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
        {supplier.criticalServices > 0 && <span className="rounded px-2 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: ERR, background: 'color-mix(in srgb, var(--nx-danger) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--nx-danger) 30%, transparent)' }}>{t('CRITIQUE', 'CRITICAL')}</span>}
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

      <button onClick={onSimulate} className="mt-auto flex w-full items-center justify-center gap-2 rounded-sm py-2.5" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600, boxShadow: '0 0 10px color-mix(in srgb, var(--nx-cyan) 20%, transparent)' }}><Play size={16} /> {t('Simuler la défaillance', 'Simulate Supplier Failure')}</button>
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
