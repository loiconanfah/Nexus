import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Activity, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { BAND_COLOR, scoreColor } from '../lib/format'
import type { PropagationResult, ScenarioType } from '../lib/types'
import { Badge, Button, Card, SectionTitle, Spinner, StatTile } from '../components/ui'

const SCENARIOS: ScenarioType[] = [
  'ServerFailure', 'DatabaseFailure', 'ApplicationFailure', 'NetworkFailure',
  'SupplierFailure', 'EmployeeLoss', 'LocationFailure', 'CloudRegionFailure',
  'CyberIncident', 'DataLoss', 'PowerOutage', 'CommunicationFailure',
]

const TYPES = ['Server', 'Application', 'Database', 'BusinessProcess', 'CloudResource', 'Service', 'Supplier', 'Person', 'Network']

export function Simulation() {
  const [params] = useSearchParams()
  const [name, setName] = useState(params.get('name') ?? '')
  const [type, setType] = useState('Server')
  const [scenario, setScenario] = useState<ScenarioType>('ServerFailure')
  const [assetId, setAssetId] = useState<string | null>(params.get('asset'))
  const [result, setResult] = useState<PropagationResult | null>(null)
  const [notFound, setNotFound] = useState(false)

  const risk = useQuery({
    queryKey: ['risk', assetId],
    queryFn: () => api.entityRisk(assetId!),
    enabled: !!assetId,
  })

  const run = useMutation({
    mutationFn: async () => {
      setNotFound(false)
      let id = assetId
      if (!id) {
        const res = await api.searchEntity(name.trim(), type)
        if (!res.match) {
          setNotFound(true)
          return null
        }
        id = res.match.id
        setAssetId(id)
      }
      return api.simulate(id, scenario)
    },
    onSuccess: (r) => r && setResult(r),
  })

  // Auto-run si un actif est passé en paramètre (clic depuis le dashboard).
  useEffect(() => {
    if (params.get('asset')) run.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const byDepth = useMemo(() => {
    if (!result) return []
    const groups = new Map<number, PropagationResult['affected']>()
    for (const a of result.affected) {
      const arr = groups.get(a.depth) ?? []
      arr.push(a)
      groups.set(a.depth, arr)
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0])
  }, [result])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Panneau de contrôle « WHAT IF? » */}
      <Card>
        <SectionTitle>What if?</SectionTitle>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            setAssetId(null)
            setResult(null)
            run.mutate()
          }}
        >
          <Field label="Actif">
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setAssetId(null) }}
              placeholder="ex : SQL01"
              className="w-44 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text-strong)' }}
            />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={setType} options={TYPES} />
          </Field>
          <Field label="Scénario">
            <Select value={scenario} onChange={(v) => setScenario(v as ScenarioType)} options={SCENARIOS} />
          </Field>
          <Button type="submit" disabled={run.isPending || (!name && !assetId)}>
            <Zap size={16} />
            {run.isPending ? 'Simulation…' : 'Simuler'}
          </Button>
        </form>
        {notFound && (
          <p className="mt-2 text-sm" style={{ color: 'var(--color-elevated)' }}>
            Actif introuvable pour ce nom et ce type.
          </p>
        )}
        {run.error && <p className="mt-2 text-sm" style={{ color: 'var(--color-critical)' }}>{(run.error as Error).message}</p>}
      </Card>

      {run.isPending && <Spinner label="Calcul de la propagation…" />}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Entités affectées" value={result.affectedTotal} color="var(--color-high)" />
            <StatTile label="Profondeur max" value={result.maxDepth} />
            <StatTile label="Impact opérationnel" value={result.estimatedOperationalImpact} sub="Σ criticités" />
            <StatTile label="Scénario" value={<span className="text-lg">{result.scenario}</span>} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Cascade par profondeur */}
            <Card className="lg:col-span-2">
              <SectionTitle hint={`${result.affectedTotal} affectés`}>Cascade de propagation</SectionTitle>
              {result.affectedTotal === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Aucun dépendant : la panne de cet actif n'affecte rien d'autre.
                </p>
              ) : (
                <div className="space-y-4">
                  {byDepth.map(([depth, nodes]) => (
                    <div key={depth} className="flex gap-3">
                      <div className="flex w-16 shrink-0 flex-col items-center">
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>niveau</span>
                        <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--color-elevated)' }}>{depth}</span>
                      </div>
                      <div className="flex flex-1 flex-wrap gap-2">
                        {nodes.map((n) => (
                          <div
                            key={n.entity.id}
                            className="rounded-lg border px-3 py-2"
                            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}
                          >
                            <div className="text-sm font-medium" style={{ color: 'var(--color-text-strong)' }}>{n.entity.name}</div>
                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              <Badge>{n.entity.entityType}</Badge>
                              <span>crit {n.entity.criticality}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Impact par type + risque de l'actif */}
            <div className="space-y-6">
              <Card>
                <SectionTitle>Impact par type</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.affectedByType).map(([t, n]) => (
                    <Badge key={t} color="var(--color-high)">{t} · {n}</Badge>
                  ))}
                </div>
              </Card>

              {risk.data && (
                <Card>
                  <SectionTitle hint={risk.data.assessment.band}>Risque de l'actif</SectionTitle>
                  <div className="mb-3 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tabular-nums" style={{ color: BAND_COLOR[risk.data.assessment.band] }}>
                      {risk.data.assessment.score}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/ 100</span>
                  </div>
                  <div className="space-y-1.5">
                    {risk.data.assessment.breakdown.filter((b) => b.points > 0).map((b) => (
                      <div key={b.factor} className="flex items-center gap-2 text-xs">
                        <div className="w-36 shrink-0" style={{ color: 'var(--color-text-muted)' }}>{b.factor}</div>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-2)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(b.points / risk.data!.assessment.score) * 100}%`, background: scoreColor(risk.data!.assessment.score) }} />
                        </div>
                        <div className="w-10 text-right tabular-nums" style={{ color: 'var(--color-text)' }}>{b.points}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <Activity size={12} /> {risk.data.hasRedundancy ? 'Redondance présente' : 'Aucune redondance'} · {risk.data.directDependents} dépendants directs
                  </p>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border px-3 py-2 text-sm outline-none"
      style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text-strong)' }}
    >
      {options.map((o) => (
        <option key={o} value={o} style={{ background: 'var(--color-surface)' }}>{o}</option>
      ))}
    </select>
  )
}
