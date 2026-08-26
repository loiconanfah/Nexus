import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { BAND_COLOR } from '../lib/format'
import type { RiskBand, RiskRow } from '../lib/types'
import { Badge, Card, SectionTitle, Spinner } from '../components/ui'

const BANDS: RiskBand[] = ['Critical', 'High', 'Elevated', 'Moderate', 'Low']
type SortKey = 'score' | 'effectiveCriticality' | 'blastRadius' | 'directDependents'

export function RiskCenter() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({ queryKey: ['riskEntities'], queryFn: api.riskEntities })
  const [bandFilter, setBandFilter] = useState<RiskBand | ''>('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('score')

  const types = useMemo(() => [...new Set(data?.map((r) => r.entityType) ?? [])].sort(), [data])

  const rows = useMemo(() => {
    let r = data ?? []
    if (bandFilter) r = r.filter((x) => x.band === bandFilter)
    if (typeFilter) r = r.filter((x) => x.entityType === typeFilter)
    return [...r].sort((a, b) => b[sortKey] - a[sortKey])
  }, [data, bandFilter, typeFilter, sortKey])

  if (isLoading) return <Spinner label="Évaluation des risques…" />
  if (error) return <div style={{ color: 'var(--color-critical)' }}>{(error as Error).message}</div>

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Répartition par bande */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {BANDS.map((band) => {
          const count = (data ?? []).filter((r) => r.band === band).length
          return (
            <button
              key={band}
              onClick={() => setBandFilter(bandFilter === band ? '' : band)}
              className="rounded-xl border p-3 text-left transition-transform hover:scale-[1.02]"
              style={{
                background: 'var(--color-surface)',
                borderColor: bandFilter === band ? BAND_COLOR[band] : 'var(--color-border)',
              }}
            >
              <div className="text-2xl font-semibold tabular-nums" style={{ color: BAND_COLOR[band] }}>{count}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{band}</div>
            </button>
          )
        })}
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>{rows.length} entités</SectionTitle>
          <div className="flex items-center gap-2">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border px-2 py-1 text-sm" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <option value="">Tous les types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded-lg border px-2 py-1 text-sm" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <option value="score">Trier : risque</option>
              <option value="effectiveCriticality">Trier : criticité</option>
              <option value="blastRadius">Trier : portée</option>
              <option value="directDependents">Trier : dépendants</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--color-text-muted)' }} className="text-left text-xs uppercase">
                <th className="pb-2 font-medium">Actif</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Bande</th>
                <th className="pb-2 text-right font-medium">Criticité</th>
                <th className="pb-2 text-right font-medium">Dépendants</th>
                <th className="pb-2 text-right font-medium">Portée</th>
                <th className="pb-2 text-right font-medium"><span className="inline-flex items-center gap-1">Risque <ArrowUpDown size={11} /></span></th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <RiskRowView key={r.id} r={r} onSimulate={() => navigate(`/simulations?asset=${r.id}&name=${encodeURIComponent(r.name)}`)} />)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function RiskRowView({ r, onSimulate }: { r: RiskRow; onSimulate: () => void }) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
      <td className="py-2 font-medium" style={{ color: 'var(--color-text-strong)' }}>
        {r.name}
        {!r.hasRedundancy && r.directDependents > 0 && <span className="ml-2 text-[10px]" style={{ color: 'var(--color-high)' }}>SPOF</span>}
      </td>
      <td className="py-2"><Badge>{r.entityType}</Badge></td>
      <td className="py-2"><Badge color={BAND_COLOR[r.band]}>{r.band}</Badge></td>
      <td className="py-2 text-right tabular-nums">{r.effectiveCriticality}</td>
      <td className="py-2 text-right tabular-nums">{r.directDependents}</td>
      <td className="py-2 text-right tabular-nums">{r.blastRadius}</td>
      <td className="py-2 text-right"><span className="font-semibold tabular-nums" style={{ color: BAND_COLOR[r.band] }}>{r.score}</span></td>
      <td className="py-2 text-right">
        <button onClick={onSimulate} title="Simuler" className="inline-flex rounded-md border p-1 transition-colors hover:brightness-125" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          <Zap size={14} />
        </button>
      </td>
    </tr>
  )
}
