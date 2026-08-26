import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Database, DownloadCloud, Network, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { importDemoData } from '../lib/demo'
import { healthColor, scoreColor } from '../lib/format'
import { Badge, Button, Card, ScoreRing, SectionTitle, Spinner, StatTile } from '../components/ui'

export function Dashboard() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({ queryKey: ['overview'], queryFn: api.overview })

  const importDemo = useMutation({
    mutationFn: importDemoData,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['overview'] }),
  })

  const empty = data && data.entityCount === 0

  return (
    <div className="mx-auto max-w-6xl">
      {isLoading && <Spinner label="Chargement de la synthèse…" />}
      {error && <ErrorBox message={(error as Error).message} />}

      {data && empty && (
        <Card className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full p-4" style={{ background: 'var(--color-surface-2)' }}>
            <Network size={28} style={{ color: 'var(--color-brand)' }} />
          </div>
          <div>
            <div className="text-lg font-semibold" style={{ color: 'var(--color-text-strong)' }}>
              Aucune donnée pour ce tenant
            </div>
            <p className="mt-1 max-w-md text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Importez le jeu de démonstration pour révéler un graphe de dépendances, ses risques et
              ses single points of failure.
            </p>
          </div>
          <Button onClick={() => importDemo.mutate()} disabled={importDemo.isPending}>
            <DownloadCloud size={16} />
            {importDemo.isPending ? 'Import en cours…' : 'Importer le jeu de démo'}
          </Button>
          {importDemo.error && <ErrorBox message={(importDemo.error as Error).message} />}
        </Card>
      )}

      {data && !empty && (
        <div className="space-y-6">
          {/* Ligne santé + tuiles */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <Card className="flex items-center gap-4 lg:col-span-1">
              <ScoreRing score={data.organizationHealthScore} color={healthColor(data.organizationHealthScore)} />
              <div>
                <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Organization<br />Health Score
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-4 lg:col-span-3">
              <StatTile label="Entités" value={data.entityCount} sub={`${data.relationCount} relations`} />
              <StatTile
                label="Single Points of Failure"
                value={data.spofCount}
                sub={`${data.criticalSpofCount} critiques`}
                color={data.spofCount > 0 ? 'var(--color-high)' : undefined}
              />
              <StatTile
                label="SPOF critiques"
                value={data.criticalSpofCount}
                color={data.criticalSpofCount > 0 ? 'var(--color-critical)' : 'var(--color-low)'}
              />
              <StatTile label="Types d'entités" value={Object.keys(data.entitiesByType).length} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Répartition par type */}
            <Card className="lg:col-span-1">
              <SectionTitle hint="par type">Composition</SectionTitle>
              <TypeBars byType={data.entitiesByType} total={data.entityCount} />
            </Card>

            {/* Top SPOF */}
            <Card className="lg:col-span-2">
              <SectionTitle hint="cliquer pour simuler">Single Points of Failure</SectionTitle>
              {data.topSpofs.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Aucun SPOF détecté.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: 'var(--color-text-muted)' }} className="text-left text-xs uppercase">
                        <th className="pb-2 font-medium">Actif</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 text-right font-medium">Dépendants</th>
                        <th className="pb-2 text-right font-medium">Portée</th>
                        <th className="pb-2 text-right font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topSpofs.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => navigate(`/simulations?asset=${s.id}&name=${encodeURIComponent(s.name)}`)}
                          className="cursor-pointer border-t transition-colors hover:brightness-125"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <td className="py-2 font-medium" style={{ color: 'var(--color-text-strong)' }}>{s.name}</td>
                          <td className="py-2"><Badge>{s.entityType}</Badge></td>
                          <td className="py-2 text-right tabular-nums">{s.directDependents}</td>
                          <td className="py-2 text-right tabular-nums">{s.blastRadius}</td>
                          <td className="py-2 text-right">
                            <span className="tabular-nums font-semibold" style={{ color: scoreColor(s.score) }}>
                              {s.score}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <ShieldAlert size={14} />
            Les SPOF sans redondance affectant des actifs critiques doivent être traités en priorité.
          </div>
        </div>
      )}
    </div>
  )
}

function TypeBars({ byType, total }: { byType: Record<string, number>; total: number }) {
  const rows = Object.entries(byType).sort((a, b) => b[1] - a[1])
  return (
    <div className="space-y-2">
      {rows.map(([type, n]) => (
        <div key={type} className="flex items-center gap-3">
          <div className="w-28 shrink-0 text-xs" style={{ color: 'var(--color-text-muted)' }}>{type}</div>
          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-2)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${total ? (n / total) * 100 : 0}%`, background: 'var(--color-brand)' }}
            />
          </div>
          <div className="w-8 text-right text-xs tabular-nums" style={{ color: 'var(--color-text)' }}>{n}</div>
        </div>
      ))}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border p-3 text-sm"
      style={{ borderColor: 'var(--color-critical)', color: 'var(--color-critical)', background: 'color-mix(in srgb, var(--color-critical) 10%, transparent)' }}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-medium">Erreur d'API</div>
        <div style={{ color: 'var(--color-text-muted)' }}>{message}</div>
        <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <Database size={12} /> L'API NEXUS doit tourner sur le port 5199.
        </div>
      </div>
    </div>
  )
}
