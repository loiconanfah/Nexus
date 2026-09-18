import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertOctagon, AlertTriangle, ArrowRight, DownloadCloud, HelpCircle, History, Network,
  Package, PieChart, Radar,
} from 'lucide-react'
import { CompanyOverview3D } from '../components/CompanyOverview3D'
import { api } from '../lib/api'
import { getTenantId } from '../lib/tenant'
import { importDemoData } from '../lib/demo'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import type { GraphData, Overview, PriorityItem, RiskRow } from '../lib/types'
import { useOrganization } from '../lib/money'
import { SECTOR_LABELS } from './Setup'

function priorityText(it: PriorityItem, t: (fr: string, en: string) => string): string {
  const type = entityTypeLabel(it.entityType, t)
  switch (it.code) {
    case 'spof': return t(`${it.name} (${type}) est un point unique de défaillance — ${it.count} actif(s) en dépendent sans redondance.`, `${it.name} (${type}) is a single point of failure — ${it.count} asset(s) depend on it with no redundancy.`)
    case 'supplier': return t(`Le fournisseur « ${it.name} » soutient ${it.count} système(s) critique(s) — risque de concentration.`, `Supplier '${it.name}' supports ${it.count} critical system(s) — concentration risk.`)
    case 'human': return t(`${it.name} concentre un savoir critique sur ${it.systems.join(', ')}.`, `${it.name} holds critical knowledge concentration for ${it.systems.join(', ')}.`)
    case 'undocumented': return t(`${it.count} dépendance(s) cartographiée(s) ont un faible niveau de confiance selon les derniers scans.`, `${it.count} mapped dependency(ies) have low confidence scores based on recent scan data.`)
  }
}

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = 'var(--nx-danger)'
const HIGH = 'var(--nx-high)'

export function Dashboard() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { t } = useLang()
  const org = useOrganization()
  const { data, isLoading, error } = useQuery({ queryKey: ['overview'], queryFn: api.overview })
  const graph = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const risks = useQuery({ queryKey: ['riskEntities'], queryFn: api.riskEntities })

  const importDemo = useMutation({
    mutationFn: importDemoData,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overview'] }); qc.invalidateQueries({ queryKey: ['graph'] }) },
  })

  const empty = data && data.entityCount === 0

  if (isLoading) return <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('CHARGEMENT DE LA TÉLÉMÉTRIE…', 'LOADING TELEMETRY…')}</div>
  if (error) return <ErrorBox message={(error as Error).message} />
  if (!data) return null

  if (empty) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-sm border p-14 text-center" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <div className="rounded-sm p-4" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--nx-cyan) 30%, transparent)' }}>
          <Network size={26} style={{ color: CYAN }} />
        </div>
        <div style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>{t('Aucune télémétrie pour ce tenant', 'No telemetry for this tenant')}</div>
        <p style={{ fontSize: 14, color: 'var(--nx-text-muted)' }}>{t('Importez le jeu de démo pour révéler le graphe de dépendances, ses risques et ses points uniques de défaillance.', 'Import the demo dataset to reveal the dependency graph, its risks and single points of failure.')}</p>
        <button
          onClick={() => importDemo.mutate()} disabled={importDemo.isPending}
          className="flex items-center gap-2 rounded-sm px-4 py-2.5"
          style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          <DownloadCloud size={16} /> {importDemo.isPending ? t('Importation…', 'Importing…') : t('Charger le jeu de démo', 'Load demo dataset')}
        </button>
        {importDemo.error && <ErrorBox message={(importDemo.error as Error).message} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <section className="flex flex-col items-start justify-between gap-4 border-b pb-4 lg:flex-row lg:items-end" style={{ borderColor: 'color-mix(in srgb, var(--nx-border) 30%, transparent)' }}>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: CYAN }} />
            <span style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: CYAN_T }}>{t('Télémétrie en direct', 'Live Telemetry')}</span>
          </div>
          <h2 className="mb-1" style={{ fontFamily: geist, fontSize: 24, letterSpacing: '-0.01em', color: 'var(--nx-text)' }}>{greeting(t)}, {t('équipe Opérations', 'Operations Team')}</h2>
          <p style={{ fontSize: 14, color: 'var(--nx-text-muted)' }}>
            {t('Organisation', 'Organization')}: {companyName(org.data?.profile?.name)}
            {org.data?.profile && <><span className="mx-2 opacity-50">|</span> {t('Secteur', 'Industry')}: {t(...(SECTOR_LABELS[org.data.profile.sector] ?? [org.data.profile.sector, org.data.profile.sector]))}</>}
          </p>
        </div>
        <ResiliencePanel score={data.organizationHealthScore} />
      </section>

      {/* Métriques */}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Metric label={t('Risques critiques', 'Critical risks')} value={data.criticalRiskCount} color={ERR} accent={ERR} icon={<AlertOctagon size={14} />} />
        <Metric label={t('Risques élevés', 'High risks')} value={data.highRiskCount} color={HIGH} accent={HIGH} icon={<AlertTriangle size={14} />} />
        <Metric label={t('Actifs critiques', 'Critical assets')} value={data.criticalAssetCount} color="var(--nx-text)" accent="color-mix(in srgb, var(--nx-cyan) 50%, transparent)" icon={<Package size={14} />} />
        <Metric label={t('Dépendances non confirmées', 'Unconfirmed dependencies')} value={data.unknownDependencyCount} color="var(--nx-text)" accent="var(--nx-outline)" icon={<HelpCircle size={14} />} />
        <Metric label={t('Points uniques de défaillance', 'Single points of failure')} value={data.spofCount} color={ERR} accent={ERR} icon={<Network size={14} />} />
        <Metric label={t('Concentration fournisseurs', 'Supplier concentration')} value={`${data.supplierConcentrationPercent}%`} color={CYAN_T} accent={CYAN} icon={<PieChart size={14} />} />
      </section>

      {/* Grille principale */}
      <div className="grid min-h-[460px] grid-cols-1 gap-4 lg:grid-cols-4">
        <Topology graph={graph.data} risks={risks.data} company={companyName(org.data?.profile?.name)} health={data.organizationHealthScore} onNode={(id, name) => navigate(`/simulations?asset=${id}&name=${encodeURIComponent(name)}`)} />
        <PriorityIntelligence items={data.priorityIntelligence} onInvestigate={() => navigate('/risks')} />
      </div>

      {/* Telemetry log */}
      <Telemetry data={data} />
    </div>
  )
}

/* ---------- Sous-composants ---------- */

function ResiliencePanel({ score }: { score: number }) {
  const { t } = useLang()
  const color = score >= 75 ? 'var(--nx-success)' : score >= 50 ? 'var(--nx-warning)' : ERR
  return (
    <div className="flex items-center gap-4 rounded-sm border px-5 py-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div>
        <p className="mb-1" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Résilience opérationnelle', 'Operational Resilience')}</p>
        <div className="flex items-baseline gap-2">
          <span style={{ fontFamily: geist, fontSize: 32, lineHeight: 1, color }}>{score}</span>
          <span style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>/100</span>
        </div>
      </div>
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--nx-surface-high)" strokeWidth="3" />
        <circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 2 * Math.PI * 20} ${2 * Math.PI * 20}`} />
      </svg>
    </div>
  )
}

function Metric({ label, value, color, accent, icon }: { label: string; value: number | string; color: string; accent: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between rounded-sm border p-3" style={{ background: 'var(--nx-surface-high)', borderColor: 'var(--nx-border)', borderLeft: `2px solid ${accent}` }}>
      <span className="mb-4" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{label}</span>
      <div className="flex items-end justify-between">
        <span style={{ fontFamily: geist, fontSize: 24, color }}>{value}</span>
        <span style={{ color: accent }}>{icon}</span>
      </div>
    </div>
  )
}

function Topology({ graph, risks, company, health, onNode }: { graph?: GraphData; risks?: RiskRow[]; company: string; health: number; onNode: (id: string, name: string) => void }) {
  const { t } = useLang()
  return (
    <section className="relative flex flex-col overflow-hidden rounded-sm border lg:col-span-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="z-10 flex w-full items-center justify-between border-b p-3" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="flex items-center gap-2">
          <Network size={14} style={{ color: 'var(--nx-text-muted)' }} />
          <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{t('L’entreprise en un coup d’œil', 'The company at a glance')}</span>
          <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--nx-outline)' }}>
            {t('· vos activités, leur poids, leur santé', '· your activities, their weight, their health')}
          </span>
        </div>
        <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{graph?.nodes.length ?? 0} {t('actifs', 'assets')} · {graph?.edges.length ?? 0} {t('liens', 'links')}</span>
      </div>

      {/* Hauteur bornée : sans plafond, la section s'étirait sur la hauteur du
          panneau voisin (près de 900 px) et la scène débordait de l'écran. */}
      <div className="relative w-full flex-1" style={{ background: 'var(--nx-panel)', minHeight: 420, maxHeight: 620 }}>
        <CompanyOverview3D graph={graph} risks={risks} company={company} health={health} onPick={onNode} />
      </div>
    </section>
  )
}

function PriorityIntelligence({ items, onInvestigate }: { items: PriorityItem[]; onInvestigate: () => void }) {
  const { t } = useLang()
  return (
    <section className="flex flex-col rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="mb-4 flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--nx-border)' }}>
        <Radar size={14} style={{ color: ERR }} />
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Renseignement prioritaire', 'Priority Intelligence')}</h3>
      </div>
      <div className="space-y-3 overflow-y-auto pr-1">
        {items.length === 0 && <p style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Aucune alerte prioritaire active.', 'No active priority alerts.')}</p>}
        {items.map((it, i) => {
          const c = it.severity === 'SEV_CRIT' ? ERR : it.severity === 'SEV_HIGH' ? HIGH : 'var(--nx-outline)'
          return (
            <div key={i} className="relative overflow-hidden rounded-sm border p-3" style={{ background: 'var(--nx-panel)', borderColor: it.severity === 'SEV_CRIT' ? 'color-mix(in srgb, var(--nx-danger) 30%, transparent)' : 'var(--nx-border)' }}>
              <div className="absolute bottom-0 left-0 top-0 w-1" style={{ background: c }} />
              <div className="mb-2 flex items-start justify-between">
                <span className="rounded px-1.5" style={{ fontFamily: mono, fontSize: 10, background: `color-mix(in srgb, ${c} 20%, transparent)`, color: c }}>{it.severity === 'SEV_CRIT' ? t('CRITIQUE', 'CRITICAL') : it.severity === 'SEV_HIGH' ? t('ÉLEVÉ', 'HIGH') : t('MODÉRÉ', 'MODERATE')}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('confiance', 'confidence')} {it.confidence}%</span>
              </div>
              <p className="mb-3" style={{ fontSize: 13, color: 'var(--nx-text)' }}>{priorityText(it, t)}</p>
              <button onClick={onInvestigate} className="flex w-full items-center justify-center gap-1 rounded py-1" style={{ fontFamily: mono, fontSize: 12, color: CYAN_T, border: `1px solid ${it.severity === 'SEV_CRIT' ? 'color-mix(in srgb, var(--nx-cyan) 40%, transparent)' : 'var(--nx-border)'}` }}>
                {t('Investiguer', 'Investigate')} <ArrowRight size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Telemetry({ data }: { data: Overview }) {
  const { t } = useLang()
  const events = [
    { label: t('Santé calculée', 'Health computed'), kind: CYAN },
    { label: `${data.spofCount} ${t('SPOF détectés', 'SPOF detected')}`, kind: data.spofCount > 0 ? ERR : 'var(--nx-outline)' },
    { label: `${data.criticalAssetCount} ${t('actifs critiques', 'critical assets')}`, kind: 'var(--nx-outline)' },
    { label: `${data.entityCount} ${t('entités cartographiées', 'entities mapped')}`, kind: 'var(--nx-outline)' },
    { label: `${data.unknownDependencyCount} ${t('dép. non vérifiées', 'unverified deps')}`, kind: 'var(--nx-outline)' },
  ]
  return (
    <section className="rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="mb-4 flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--nx-border)' }}>
        <History size={14} style={{ color: 'var(--nx-text-muted)' }} />
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{t('Journal de télémétrie système', 'System Telemetry Log')}</h3>
      </div>
      <div className="relative flex h-16 items-center overflow-x-auto pb-2">
        <div className="absolute left-0 right-0 top-1/2 z-0 h-px -translate-y-1/2" style={{ background: 'var(--nx-border)' }} />
        <div className="z-10 flex w-max gap-12 px-4">
          {events.map((e, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="mb-1" style={{ fontFamily: mono, fontSize: 9, color: 'var(--nx-text-muted)' }}>{i === 0 ? t('DIRECT', 'LIVE') : '—'}</span>
              <div className="h-3 w-3 rounded-full" style={{ background: 'var(--nx-surface)', border: `2px solid ${e.kind}` }} />
              <span className="mt-1 whitespace-nowrap" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text)' }}>{e.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ErrorBox({ message }: { message: string }) {
  const { t } = useLang()
  return (
    <div className="flex items-start gap-2 rounded-sm border p-3" style={{ borderColor: ERR, color: ERR, background: 'color-mix(in srgb, var(--nx-danger) 10%, transparent)', fontSize: 14 }}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div><div className="font-medium">{t('Erreur API', 'API error')}</div><div style={{ color: 'var(--nx-text-muted)' }}>{message}</div></div>
    </div>
  )
}

/** Nom d'affichage du tenant. Les deux jeux de démonstration sont nommés ; à
 *  défaut, on reste neutre plutôt que d'inventer une raison sociale. */
function companyName(profileName?: string): string {
  if (profileName) return profileName
  const id = getTenantId()
  if (id.startsWith('be11')) return 'Bell Telecom'
  if (id.startsWith('c610')) return 'CGI Inc.'
  return 'Organisation'
}

function greeting(t: (fr: string, en: string) => string): string {
  const h = new Date().getHours()
  return h < 12 ? t('Bonjour', 'Good morning') : h < 18 ? t('Bon après-midi', 'Good afternoon') : t('Bonsoir', 'Good evening')
}
