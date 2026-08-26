import { useQuery } from '@tanstack/react-query'
import { Activity, Printer } from 'lucide-react'
import { api } from '../lib/api'
import type { ExecutiveReport, ReportRiskItem } from '../lib/types'
import { Spinner } from '../components/ui'

const BAND: Record<string, string> = {
  Critical: '#c0392b', High: '#d35400', Elevated: '#c8951a', Moderate: '#b7950b', Low: '#27865a',
}
const PRIORITY: Record<string, string> = { Élevée: '#c0392b', Moyenne: '#d35400', Faible: '#7a8496' }

const ink = '#1a1a1a'
const muted = '#6b7280'
const line = '#e5e7eb'

export function Reports() {
  const { data, isLoading, error } = useQuery({ queryKey: ['executiveReport'], queryFn: api.executiveReport })

  if (isLoading) return <Spinner label="Génération du rapport…" />
  if (error) return <div style={{ color: 'var(--color-critical)' }}>{(error as Error).message}</div>
  if (!data) return null

  const healthColor = data.organizationHealthScore >= 75 ? '#27865a' : data.organizationHealthScore >= 50 ? '#c8951a' : '#c0392b'

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex justify-end no-print">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium"
          style={{ background: 'var(--color-brand)', color: '#fff' }}
        >
          <Printer size={16} /> Imprimer / Exporter PDF
        </button>
      </div>

      {/* Document papier */}
      <div className="mx-auto rounded-lg p-10 shadow-lg" style={{ background: '#fff', color: ink, maxWidth: 820 }}>
        {/* En-tête */}
        <div className="flex items-start justify-between border-b pb-5" style={{ borderColor: line }}>
          <div>
            <div className="flex items-center gap-2">
              <Activity size={20} style={{ color: '#2b5fb3' }} />
              <span className="text-xl font-bold" style={{ color: ink }}>NEXUS</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold" style={{ color: ink }}>Rapport exécutif de résilience</h1>
            <p className="mt-1 text-sm" style={{ color: muted }}>
              Généré le {new Date(data.generatedAt).toLocaleString('fr-CA')}
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold tabular-nums" style={{ color: healthColor }}>{data.organizationHealthScore}</div>
            <div className="text-xs uppercase tracking-wide" style={{ color: muted }}>Health Score</div>
          </div>
        </div>

        {/* Synthèse */}
        <div className="mt-5 grid grid-cols-4 gap-4">
          <Kpi label="Entités" value={data.entityCount} />
          <Kpi label="Relations" value={data.relationCount} />
          <Kpi label="SPOF" value={data.spofCount} color={data.spofCount > 0 ? '#d35400' : ink} />
          <Kpi label="SPOF critiques" value={data.criticalSpofCount} color={data.criticalSpofCount > 0 ? '#c0392b' : ink} />
        </div>

        <Section title="Synthèse">
          <p className="text-sm leading-relaxed" style={{ color: ink }}>
            L'organisation compte <b>{data.entityCount} actifs</b> et <b>{data.relationCount} dépendances</b> modélisés.
            NEXUS a identifié <b>{data.spofCount} point(s) unique(s) de défaillance</b>
            {data.criticalSpofCount > 0 && <> dont <b style={{ color: '#c0392b' }}>{data.criticalSpofCount} critique(s)</b></>}.
            {data.recommendations.length > 0 && <> {data.recommendations.length} action(s) prioritaire(s) sont recommandées ci-dessous.</>}
          </p>
        </Section>

        {/* Recommandations en tête (ce que le dirigeant veut) */}
        {data.recommendations.length > 0 && (
          <Section title="Recommandations prioritaires">
            <div className="space-y-2">
              {data.recommendations.map((r, i) => (
                <div key={i} className="flex gap-3 rounded-md border p-3" style={{ borderColor: line }}>
                  <span className="mt-0.5 rounded px-2 py-0.5 text-xs font-semibold" style={{ background: `${PRIORITY[r.priority] ?? muted}22`, color: PRIORITY[r.priority] ?? muted }}>
                    {r.priority}
                  </span>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: ink }}>{r.title}</div>
                    <div className="text-sm" style={{ color: muted }}>{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Risques majeurs">
          <RiskTable rows={data.topRisks} showBand />
        </Section>

        <Section title="Single Points of Failure">
          {data.singlePointsOfFailure.length === 0 ? <Empty /> : <RiskTable rows={data.singlePointsOfFailure} />}
        </Section>

        {data.supplierConcentration.length > 0 && (
          <Section title="Concentration fournisseurs">
            <table className="w-full text-sm">
              <Thead cols={['Fournisseur', 'Systèmes dépendants', 'Détail']} />
              <tbody>
                {data.supplierConcentration.map((s) => (
                  <tr key={s.name} className="border-t" style={{ borderColor: line }}>
                    <Td bold>{s.name}</Td>
                    <Td right>{s.dependentSystems}</Td>
                    <Td muted>{s.dependents.join(', ')}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {data.humanDependencies.length > 0 && (
          <Section title="Dépendances humaines">
            <div className="space-y-1 text-sm">
              {data.humanDependencies.map((h) => (
                <div key={h.person}>
                  <b>{h.person}</b> détient une connaissance clé sur : <span style={{ color: muted }}>{h.knownSystems.join(', ')}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Dépendances non documentées">
          {data.undocumentedDependencies.length === 0 ? (
            <p className="text-sm" style={{ color: muted }}>Aucune : toutes les dépendances sont importées ou vérifiées.</p>
          ) : (
            <table className="w-full text-sm">
              <Thead cols={['Source', 'Cible', 'Type', 'Confiance', 'Statut']} />
              <tbody>
                {data.undocumentedDependencies.map((u, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: line }}>
                    <Td bold>{u.source}</Td><Td>{u.target}</Td><Td muted>{u.type}</Td>
                    <Td right>{Math.round(u.confidence * 100)}%</Td><Td muted>{u.status}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <div className="mt-8 border-t pt-4 text-center text-xs" style={{ borderColor: line, color: muted }}>
          NEXUS — Operational Dependency Intelligence · Confidentiel
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-md border p-3 text-center" style={{ borderColor: line }}>
      <div className="text-2xl font-bold tabular-nums" style={{ color: color ?? ink }}>{value}</div>
      <div className="text-xs uppercase tracking-wide" style={{ color: muted }}>{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6" style={{ breakInside: 'avoid' }}>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: '#2b5fb3' }}>{title}</h2>
      {children}
    </div>
  )
}

function RiskTable({ rows, showBand }: { rows: ReportRiskItem[]; showBand?: boolean }) {
  return (
    <table className="w-full text-sm">
      <Thead cols={['Actif', 'Type', ...(showBand ? ['Bande'] : []), 'Dépendants', 'Portée', 'Score']} />
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-t" style={{ borderColor: line }}>
            <Td bold>{r.name}{!r.hasRedundancy && r.dependents > 0 && <span style={{ color: '#d35400', fontSize: 10 }}> SPOF</span>}</Td>
            <Td muted>{r.entityType}</Td>
            {showBand && <Td><span style={{ color: BAND[r.band] ?? ink, fontWeight: 600 }}>{r.band}</span></Td>}
            <Td right>{r.dependents}</Td>
            <Td right>{r.blastRadius}</Td>
            <Td right><span style={{ color: BAND[r.band] ?? '#d35400', fontWeight: 700 }}>{r.score.toFixed(1)}</span></Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Thead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="text-left text-xs uppercase" style={{ color: muted }}>
        {cols.map((c, i) => <th key={c} className={`pb-1 font-medium ${i >= 3 ? 'text-right' : ''}`}>{c}</th>)}
      </tr>
    </thead>
  )
}

function Td({ children, bold, muted: m, right }: { children: React.ReactNode; bold?: boolean; muted?: boolean; right?: boolean }) {
  return <td className={`py-1.5 ${right ? 'text-right tabular-nums' : ''}`} style={{ color: m ? muted : ink, fontWeight: bold ? 600 : 400 }}>{children}</td>
}

function Empty() {
  return <p className="text-sm" style={{ color: muted }}>Aucun élément.</p>
}
