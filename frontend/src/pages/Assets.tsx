import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Zap } from 'lucide-react'
import { api } from '../lib/api'
import { scoreColor } from '../lib/format'
import { Badge, Card, SectionTitle, Spinner } from '../components/ui'

export function Assets() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const [q, setQ] = useState('')
  const [type, setType] = useState('')

  const types = useMemo(() => [...new Set(data?.nodes.map((n) => n.entityType) ?? [])].sort(), [data])
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return (data?.nodes ?? [])
      .filter((n) => (!query || n.name.toLowerCase().includes(query) || n.aliases.some((a) => a.toLowerCase().includes(query))))
      .filter((n) => !type || n.entityType === type)
      .sort((a, b) => b.criticality - a.criticality)
  }, [data, q, type])

  if (isLoading) return <Spinner label="Chargement des actifs…" />
  if (error) return <div style={{ color: 'var(--color-critical)' }}>{(error as Error).message}</div>

  return (
    <div className="mx-auto max-w-6xl">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>{rows.length} actifs</SectionTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border px-2 py-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
              <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, alias)…" className="w-52 bg-transparent text-sm outline-none" style={{ color: 'var(--color-text-strong)' }} />
            </div>
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border px-2 py-1 text-sm" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              <option value="">Tous les types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--color-text-muted)' }} className="text-left text-xs uppercase">
                <th className="pb-2 font-medium">Nom</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Alias</th>
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 text-right font-medium">Criticité</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-2 font-medium" style={{ color: 'var(--color-text-strong)' }}>{n.name}</td>
                  <td className="py-2"><Badge>{n.entityType}</Badge></td>
                  <td className="py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{n.aliases.join(', ') || '—'}</td>
                  <td className="py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{n.sourceSystem ?? '—'}</td>
                  <td className="py-2 text-right"><span className="font-semibold tabular-nums" style={{ color: scoreColor(n.criticality) }}>{n.criticality}</span></td>
                  <td className="py-2 text-right">
                    <button onClick={() => navigate(`/simulations?asset=${n.id}&name=${encodeURIComponent(n.name)}`)} title="Simuler" className="inline-flex rounded-md border p-1 transition-colors hover:brightness-125" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      <Zap size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
