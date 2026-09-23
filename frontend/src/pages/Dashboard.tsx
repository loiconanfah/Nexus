import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertOctagon, AlertTriangle, ArrowRight, Blocks, ChevronDown, ChevronUp, DownloadCloud, HelpCircle,
  History, Network, Package, PieChart, Radar, ScanText, Upload,
} from 'lucide-react'
import { CompanyOverview3D } from '../components/CompanyOverview3D'
import { api } from '../lib/api'
import { getTenantId } from '../lib/tenant'
import { importDemoData } from '../lib/demo'
import { useLang } from '../lib/i18n'
import { entityTypeLabel } from '../lib/labels'
import type { GraphData, Overview, PriorityItem, RiskRow } from '../lib/types'
import { useOrganization } from '../lib/money'
import { SECTOR_LABELS } from '../lib/orgLists'

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
    // Un espace d'entreprise (profil renseigné) n'a rien à faire d'un jeu de
    // démonstration : on lui montre par où entrer SES données. Le jeu de démo
    // reste proposé aux espaces de découverte, qui n'ont pas de profil.
    const real = Boolean(org.data?.profile?.name)
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-sm border p-12 text-center" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <div className="rounded-sm p-4" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--nx-cyan) 30%, transparent)' }}>
          <Network size={26} style={{ color: CYAN }} />
        </div>
        <div style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>
          {real ? t('Votre graphe est encore vide', 'Your graph is still empty') : t('Aucune donnée dans cet espace', 'No data in this workspace')}
        </div>
        <p style={{ fontSize: 14, color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
          {real
            ? t('Ajoutez vos systèmes, vos activités et ce dont elles dépendent. Trois portes d’entrée, au choix : un fichier, un document, ou une connexion directe à vos outils.',
              'Add your systems, your activities and what they depend on. Three ways in: a file, a document, or a direct connection to your tools.')
            : t('Importez le jeu de démonstration pour découvrir le graphe de dépendances, ses risques et ses points uniques de défaillance.',
              'Import the demo dataset to explore the dependency graph, its risks and single points of failure.')}
        </p>
        {real ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => navigate('/onboarding')} className="flex items-center gap-2 rounded-sm px-4 py-2.5"
              style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}>
              <Upload size={16} /> {t('Importer un fichier (CSV, Excel)', 'Import a file (CSV, Excel)')}
            </button>
            <button onClick={() => navigate('/documents')} className="flex items-center gap-2 rounded-sm border px-4 py-2.5"
              style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }}>
              <ScanText size={16} /> {t('Analyser un document', 'Analyze a document')}
            </button>
            <button onClick={() => navigate('/integrations')} className="flex items-center gap-2 rounded-sm border px-4 py-2.5"
              style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }}>
              <Blocks size={16} /> {t('Connecter un outil', 'Connect a tool')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => importDemo.mutate()} disabled={importDemo.isPending}
            className="flex items-center gap-2 rounded-sm px-4 py-2.5"
            style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            <DownloadCloud size={16} /> {importDemo.isPending ? t('Importation…', 'Importing…') : t('Charger le jeu de démo', 'Load demo dataset')}
          </button>
        )}
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
            <span style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nx-label)' }}>{t('Télémétrie en direct', 'Live Telemetry')}</span>
          </div>
          <h2 className="mb-1" style={{ fontFamily: geist, fontSize: 24, letterSpacing: '-0.01em', color: 'var(--nx-text)' }}>{greeting(t)}, {t('équipe Opérations', 'Operations Team')}</h2>
          <p style={{ fontSize: 14, color: 'var(--nx-text-muted)' }}>
            {t('Organisation', 'Organization')}: {companyName(org.data?.profile?.name)}
            {org.data?.profile && <><span className="mx-2 opacity-50">|</span> {t('Secteur', 'Industry')}: {t(...(SECTOR_LABELS[org.data.profile.sector] ?? [org.data.profile.sector, org.data.profile.sector]))}</>}
          </p>
        </div>
        <ResiliencePanel fallback={data.organizationHealthScore} />
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

/**
 * L'indice de résilience, ses quatre parts et l'écart depuis le dernier relevé.
 *
 * Un nombre seul ne dit rien. Un nombre qui MONTE quand on a validé des
 * dépendances, et qui nomme la part la plus faible avec le lien vers l'écran où
 * la corriger, donne une raison de revenir la semaine suivante.
 */
function ResiliencePanel({ fallback }: { fallback: number }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  // Les parts sont visibles d'emblee : cachees derriere un chevron, et l'ecart
  // ne pouvant pas exister avant un second jour de relevé, le travail ne se
  // voyait pas du tout le jour où on l'installait.
  const [open, setOpen] = useState(true)
  const { data } = useQuery({ queryKey: ['resilience', lang], queryFn: () => api.resilience(lang) })

  const score = data?.total ?? fallback
  const color = score >= 75 ? 'var(--nx-success)' : score >= 50 ? 'var(--nx-warning)' : ERR
  const delta = data?.delta ?? null

  return (
    <div className="flex flex-col gap-2 rounded-sm border px-5 py-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center gap-4">
        <div>
          <p className="mb-1" style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>{t('Résilience opérationnelle', 'Operational Resilience')}</p>
          <div className="flex items-baseline gap-2">
            <span style={{ fontFamily: geist, fontSize: 32, lineHeight: 1, color }}>{score}</span>
            <span style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>/100</span>
            {data && delta === null && (
              <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--nx-outline)' }}>
                {t('premier relevé, l’écart apparaîtra demain', 'first reading, the change will show tomorrow')}
              </span>
            )}
            {delta !== null && delta !== 0 && (
              <span style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 600, color: delta > 0 ? 'var(--nx-success)' : ERR }}>
                {delta > 0 ? '+' : ''}{delta} {t('depuis le', 'since')} {data?.previous ? new Date(data.previous.day).toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'short' }) : ''}
              </span>
            )}
          </div>
        </div>
        <svg width="48" height="48" className="-rotate-90">
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--nx-surface-high)" strokeWidth="3" />
          <circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 2 * Math.PI * 20} ${2 * Math.PI * 20}`} />
        </svg>
        {data && data.parts.length > 0 && (
          <button onClick={() => setOpen((v: boolean) => !v)} className="self-start rounded-sm p-1" style={{ color: 'var(--nx-text-muted)' }}
            title={t('Détail de l’indice', 'Index breakdown')} aria-label={t('Détail de l’indice', 'Index breakdown')}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {open && data && (
        <div className="flex flex-col gap-2 border-t pt-2" style={{ borderColor: 'var(--nx-border)', minWidth: 360 }}>
          <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{data.summary}</p>
          {data.parts.map((p) => (
            <button key={p.key} onClick={() => navigate(p.route)} className="flex flex-col gap-1 text-left">
              <span className="flex items-center justify-between" style={{ fontSize: 12.5, color: 'var(--nx-text)' }}>
                <span>{p.label} <span style={{ color: 'var(--nx-outline)', fontFamily: mono, fontSize: 11 }}>{p.weight} %</span></span>
                <span style={{ fontFamily: mono, fontWeight: 600, color: p.score >= 75 ? 'var(--nx-success)' : p.score >= 50 ? 'var(--nx-warning)' : ERR }}>{p.score}</span>
              </span>
              <span className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-high)' }}>
                <span className="block h-full rounded-full transition-all" style={{ width: `${p.score}%`, background: p.score >= 75 ? 'var(--nx-success)' : p.score >= 50 ? 'var(--nx-warning)' : ERR }} />
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--nx-text-muted)' }}>{p.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, color, accent, icon }: { label: string; value: number | string; color: string; accent: string; icon: React.ReactNode }) {
  // Zéro n'est pas une alerte : un compteur à 0 reste neutre, la couleur d'état
  // est réservée à ce qui demande vraiment l'attention.
  const quiet = value === 0 || value === '0' || value === '0%'
  const tone = quiet ? 'var(--nx-text-muted)' : color
  const edge = quiet ? 'var(--nx-border)' : accent
  return (
    <div className="flex flex-col justify-between rounded-md border p-3" style={{ background: 'var(--nx-surface-high)', borderColor: 'var(--nx-border)', borderLeft: `2px solid ${edge}` }}>
      <span className="mb-4" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{label}</span>
      <div className="flex items-end justify-between">
        <span style={{ fontFamily: geist, fontSize: 24, color: tone }}>{value}</span>
        <span style={{ color: quiet ? 'var(--nx-outline)' : accent }}>{icon}</span>
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
