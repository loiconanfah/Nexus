import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, FileText, Info, Printer, ShieldAlert, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { entityTypeLabel, bandLabel } from '../lib/labels'
import type { ExecutiveReport, ReportRiskItem } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'
const ERR = '#ffb4ab'

const BAND_COLOR: Record<string, string> = { Critical: '#ffb4ab', High: '#fb923c', Elevated: '#facc15', Moderate: '#eab308', Low: '#00e5ff' }

const REPORT_TYPES = [
  { id: 'executive', fr: 'Risque exécutif', en: 'Executive Risk', icon: ShieldAlert },
  { id: 'continuity', fr: 'Continuité d’activité', en: 'Business Continuity', icon: CalendarClock },
  { id: 'supplier', fr: 'Risque fournisseur', en: 'Supplier Risk', icon: FileText },
  { id: 'infra', fr: 'Risque infrastructure', en: 'Infrastructure Risk', icon: AlertTriangle },
  { id: 'cyber', fr: 'Impact cyber', en: 'Cyber Impact', icon: Info },
]

export function Reports() {
  const { t, lang } = useLang()
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['executiveReport'], queryFn: api.executiveReport })
  const [type, setType] = useState('executive')
  const [threshold, setThreshold] = useState('MED')

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
      {/* ===== Config ===== */}
      <div className="no-print flex w-80 shrink-0 flex-col overflow-y-auto border-r" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
        <div className="p-5">
          <h2 style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>{t('Générer un rapport de renseignement', 'Generate Intelligence Report')}</h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Configurez les paramètres de l’analyse de résilience automatisée.', 'Configure parameters for automated resilience analysis.')}</p>
        </div>

        <div className="flex flex-col gap-6 px-5 pb-5">
          <div>
            <Label>{t('Type de rapport', 'Report Type')}</Label>
            <div className="mt-2 flex flex-col gap-2">
              {REPORT_TYPES.map((rt) => {
                const active = type === rt.id
                return (
                  <button key={rt.id} onClick={() => setType(rt.id)} className="flex items-center gap-3 rounded-sm border p-3 transition-colors"
                    style={{ background: active ? 'rgba(0,229,255,0.08)' : 'var(--nx-surface-container)', borderColor: active ? CYAN : 'var(--nx-border)' }}>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: active ? CYAN : 'var(--nx-outline)' }}>{active && <span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />}</span>
                    <rt.icon size={16} style={{ color: active ? CYAN_T : 'var(--nx-text-muted)' }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: active ? 'var(--nx-text)' : 'var(--nx-text-muted)' }}>{lang === 'fr' ? rt.fr : rt.en}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t pt-4" style={{ borderColor: 'var(--nx-border)' }}>
            <div>
              <Label>{t('Seuil de risque', 'Risk Threshold')}</Label>
              <div className="mt-1 flex overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
                {['LOW', 'MED', 'HIGH'].map((th) => (
                  <button key={th} onClick={() => setThreshold(th)} className="flex-1 py-1.5 transition-colors"
                    style={{ fontFamily: mono, fontSize: 11, background: threshold === th ? (th === 'HIGH' ? ERR : th === 'MED' ? '#fb923c' : CYAN) : 'var(--nx-surface-container)', color: threshold === th ? '#000' : 'var(--nx-text-muted)' }}>{th === 'LOW' ? t('BAS', 'LOW') : th === 'MED' ? t('MOY', 'MED') : t('HAUT', 'HIGH')}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          <button onClick={() => refetch()} disabled={isFetching} className="flex h-11 w-full items-center justify-center gap-2 rounded-sm disabled:opacity-50"
            style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <Sparkles size={16} /> {isFetching ? t('Génération…', 'Generating…') : t('Générer le rapport', 'Generate Report')}
          </button>
          <button onClick={() => window.print()} className="flex h-10 w-full items-center justify-center gap-2 rounded-sm border" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)', fontFamily: mono, fontSize: 12, textTransform: 'uppercase' }}>
            <Printer size={15} /> {t('Exporter PDF', 'Export PDF')}
          </button>
        </div>
      </div>

      {/* ===== Preview ===== */}
      <div className="flex flex-1 justify-center overflow-y-auto p-6" style={{ background: 'var(--nx-panel)' }}>
        {isLoading && <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('COMPILATION DU RAPPORT…', 'COMPILING REPORT…')}</div>}
        {error && <div style={{ color: ERR }}>{(error as Error).message}</div>}
        {data && <ReportPreview report={data} type={type} threshold={threshold} />}
      </div>
    </div>
  )
}

const INFRA_TYPES = new Set(['Server', 'Database', 'Network', 'CloudResource', 'Infrastructure', 'Device', 'DataStore'])

function ReportPreview({ report, type, threshold }: { report: ExecutiveReport; type: string; threshold: string }) {
  const { t, lang } = useLang()
  const systemic = 100 - report.organizationHealthScore
  const minScore = threshold === 'HIGH' ? 60 : threshold === 'MED' ? 40 : 0
  // Sections affichées selon le type de rapport (composition réelle des données).
  const show = (s: 'findings' | 'risks' | 'suppliers' | 'human' | 'map') => {
    if (type === 'supplier') return s === 'suppliers'
    if (type === 'infra') return s === 'risks' || s === 'map'
    if (type === 'cyber') return s === 'risks' || s === 'map' || s === 'findings'
    if (type === 'continuity') return s !== 'suppliers'
    return true // executive = tout
  }
  const topRisks = report.topRisks
    .filter((r) => r.score >= minScore)
    .filter((r) => type !== 'infra' || INFRA_TYPES.has(r.entityType))
  const recos = report.recommendations.filter((_, i) => threshold === 'LOW' || i < (threshold === 'HIGH' ? 2 : 4))
  return (
    <div className="relative w-full max-w-4xl overflow-hidden rounded-lg border shadow-2xl" style={{ background: '#1a1a1e', borderColor: 'var(--nx-border)' }}>
      {/* Header */}
      <header className="flex items-end justify-between border-b p-8" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
        <div>
          <p className="mb-2 uppercase" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.2em', color: CYAN_T }}>{t('Confidentiel interne', 'Internal Confidential')}</p>
          <h2 style={{ fontFamily: geist, fontSize: 28, fontWeight: 600, color: 'var(--nx-text)', lineHeight: 1.1 }}>{t('RAPPORT STRATÉGIQUE', 'NEXUS STRATEGIC')}<br />{t('DE RÉSILIENCE NEXUS', 'RESILIENCE REPORT')}</h2>
        </div>
        <div className="text-right">
          <p style={{ fontFamily: mono, fontSize: 14, color: 'var(--nx-text)' }}>{t('T3 2026', 'Q3 2026')}</p>
          <p className="mt-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{t('GÉN', 'GEN')}: {new Date(report.generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</p>
        </div>
      </header>

      <div className="space-y-10 p-8">
        {/* Executive summary */}
        <section>
          <SectionTitle>{t('Résumé exécutif', 'Executive Summary')}</SectionTitle>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <SummaryTile label={t('VULNÉRABILITÉS CRITIQUES', 'CRITICAL VULNERABILITIES')} value={report.spofCount} color={ERR} pct={Math.min(100, report.spofCount * 12)} />
            <SummaryTile label={t('SCORE DE RISQUE SYSTÉMIQUE', 'SYSTEMIC RISK SCORE')} value={`${systemic}`} suffix="/100" color={ERR} pct={systemic} />
            <SummaryTile label={t('ACTIFS ANALYSÉS', 'ASSETS ANALYZED')} value={report.entityCount} color={CYAN} pct={100} />
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--nx-text-muted)' }}>
            {lang === 'fr'
              ? <>L’analyse a identifié <b style={{ color: 'var(--nx-text)' }}>{report.spofCount} point(s) unique(s) de défaillance</b> parmi {report.entityCount} actifs modélisés, avec une concentration fournisseur de <b style={{ color: 'var(--nx-text)' }}>{report.supplierConcentrationPercent}%</b>.</>
              : <>Analysis identified <b style={{ color: 'var(--nx-text)' }}>{report.spofCount} single point(s) of failure</b> across {report.entityCount} modelled assets, with a supplier concentration of <b style={{ color: 'var(--nx-text)' }}>{report.supplierConcentrationPercent}%</b>.</>}
            {report.singlePointsOfFailure[0] && (lang === 'fr'
              ? <> La vulnérabilité structurelle principale est <b style={{ color: ERR }}>{report.singlePointsOfFailure[0].name}</b>, dont la défaillance se propage à {report.singlePointsOfFailure[0].blastRadius} actif(s) dépendant(s).</>
              : <> The primary structural vulnerability is <b style={{ color: ERR }}>{report.singlePointsOfFailure[0].name}</b>, whose failure propagates across {report.singlePointsOfFailure[0].blastRadius} dependent asset(s).</>)}
            {report.recommendations.length > 0 && (lang === 'fr'
              ? <> {report.recommendations.length} action(s) de remédiation priorisée(s) sont recommandées.</>
              : <> {report.recommendations.length} prioritized remediation action(s) are recommended.</>)}
          </p>
        </section>

        {/* Findings + map */}
        {(show('findings') || show('map')) && (
          <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {show('findings') && (
              <div>
                <SectionTitle>{t('Constats critiques', 'Critical Findings')}</SectionTitle>
                <ul className="space-y-4">
                  {recos.map((r, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: r.priority === 'Élevée' ? ERR : r.priority === 'Moyenne' ? '#fb923c' : '#facc15' }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-text)' }}>{r.title}</p>
                        <p className="mt-1" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{r.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {show('map') && (
              <div>
                <SectionTitle>{t('Carte des dépendances (chemin critique)', 'Dependency Map (Critical Path)')}</SectionTitle>
                <CriticalPath spofs={report.singlePointsOfFailure.slice(0, 5)} />
              </div>
            )}
          </section>
        )}

        {/* Top risks */}
        {show('risks') && topRisks.length > 0 && (
          <section>
            <SectionTitle>{t('Risques majeurs', 'Major Risks')}{type === 'infra' ? ' · ' + t('Infrastructure', 'Infrastructure') : ''}</SectionTitle>
            <RiskTable rows={topRisks} />
          </section>
        )}

        {/* Supplier + human */}
        {(show('suppliers') || show('human')) && (
          <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {show('suppliers') && report.supplierConcentration.length > 0 && (
              <div>
                <SectionTitle>{t('Concentration fournisseurs', 'Supplier Concentration')}</SectionTitle>
                {report.supplierConcentration.map((s) => (
                  <div key={s.name} className="mb-1 flex justify-between" style={{ fontSize: 13 }}><span style={{ color: 'var(--nx-text)' }}>{s.name}</span><span style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{s.dependentSystems} {t('systèmes', 'systems')}</span></div>
                ))}
              </div>
            )}
            {show('human') && report.humanDependencies.length > 0 && (
              <div>
                <SectionTitle>{t('Dépendances humaines', 'Human Dependencies')}</SectionTitle>
                {report.humanDependencies.map((h) => (
                  <p key={h.person} style={{ fontSize: 13, color: 'var(--nx-text)' }}><b>{h.person}</b> <span style={{ color: 'var(--nx-text-muted)' }}>— {h.knownSystems.join(', ')}</span></p>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="border-t pt-4 text-center" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>
          {t('NEXUS — Intelligence opérationnelle des dépendances · Confidentiel', 'NEXUS — Operational Dependency Intelligence · Confidential')}
        </div>
      </div>
    </div>
  )
}

function CriticalPath({ spofs }: { spofs: ReportRiskItem[] }) {
  const n = spofs.length || 1
  return (
    <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-sm border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
      <div className="nx-grid absolute inset-0" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 200">
        {spofs.map((s, i) => {
          const x = 60 + (i * 280) / Math.max(1, n - 1)
          const y = 100 + (i % 2 === 0 ? -35 : 35)
          return (
            <g key={s.name}>
              {i > 0 && <line x1={60 + ((i - 1) * 280) / Math.max(1, n - 1)} y1={100 + ((i - 1) % 2 === 0 ? -35 : 35)} x2={x} y2={y} stroke="#93000a" strokeWidth={1.5} strokeDasharray="4" />}
              <circle cx={x} cy={y} r={s.score >= 80 ? 6 : 4} fill={s.score >= 80 ? '#93000a' : s.score >= 50 ? '#ffb4ab' : '#00e5ff'} />
              <text x={x} y={y + 16} textAnchor="middle" fill="var(--nx-text-muted)" fontFamily="JetBrains Mono" fontSize="7">{s.name}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function RiskTable({ rows }: { rows: ReportRiskItem[] }) {
  const { t } = useLang()
  return (
    <table className="w-full text-left text-sm">
      <thead><tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>{[t('Actif', 'Asset'), t('Type', 'Type'), t('Bande', 'Band'), t('Dépendants', 'Dependents'), t('Portée', 'Blast'), t('Score', 'Score')].map((h, i) => <th key={h} className={`pb-2 ${i >= 3 ? 'text-right' : ''}`} style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => {
          const c = BAND_COLOR[r.band] ?? '#849396'
          return (
            <tr key={r.name} className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
              <td className="py-2" style={{ fontWeight: 600, color: 'var(--nx-text)' }}>{r.name}{!r.hasRedundancy && r.dependents > 0 && <span style={{ color: '#fb923c', fontSize: 10 }}> SPOF</span>}</td>
              <td className="py-2" style={{ color: 'var(--nx-text-muted)' }}>{entityTypeLabel(r.entityType, t)}</td>
              <td className="py-2"><span style={{ color: c, fontFamily: mono, fontSize: 11 }}>{bandLabel(r.band, t)}</span></td>
              <td className="py-2 text-right" style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{r.dependents}</td>
              <td className="py-2 text-right" style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{r.blastRadius}</td>
              <td className="py-2 text-right" style={{ fontFamily: mono, fontWeight: 700, color: c }}>{r.score.toFixed(0)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SummaryTile({ label, value, suffix, color, pct }: { label: string; value: number | string; suffix?: string; color: string; pct: number }) {
  return (
    <div className="rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', borderLeft: `2px solid ${color}` }}>
      <p className="mb-1" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</p>
      <p style={{ fontFamily: geist, fontSize: 24, color }}>{value}{suffix && <span style={{ fontSize: 14, color: 'var(--nx-text-muted)' }}>{suffix}</span>}</p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded" style={{ background: 'var(--nx-surface-highest)' }}><div className="h-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 border-b pb-2 uppercase" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.05em', color: 'var(--nx-text-muted)', borderColor: 'var(--nx-border)' }}>{children}</h3>
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{children}</label>
}
