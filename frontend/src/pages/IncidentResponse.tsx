import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertOctagon, BookOpen, LifeBuoy, Loader2, Phone, Search, Truck } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { useMoney } from '../lib/money'
import { entityTypeLabel, relationTypeLabel } from '../lib/labels'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const ERR = 'var(--nx-danger)'
const CYAN_T = 'var(--nx-cyan-text)'

/**
 * Mode incident. Le moment où la cartographie vaut le plus cher est aussi celui
 * où personne n'a le temps de naviguer : une recherche, puis les cinq réponses
 * dans l'ordre où les questions se posent réellement pendant une panne.
 */
export function IncidentResponse() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')

  const graph = useQuery({ queryKey: ['graph'], queryFn: api.graph })
  const selected = params.get('asset')
  const incident = useQuery({
    queryKey: ['incident', selected],
    queryFn: () => api.incident(selected!),
    enabled: Boolean(selected),
  })

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return (graph.data?.nodes ?? [])
      .filter((n) => n.name.toLowerCase().includes(q) || n.aliases.some((a) => a.toLowerCase().includes(q)))
      .sort((a, b) => b.criticality - a.criticality)
      .slice(0, 8)
  }, [graph.data, query])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <AlertOctagon size={22} style={{ color: ERR }} /> {t('Mode incident', 'Incident mode')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
          {t('Quel système est tombé ? Ce qui tombe avec, ce que ça coûte par heure, qui appeler, ce qui prend le relais, ce que dit le plan.',
            'Which system is down? What falls with it, what it costs per hour, who to call, what takes over, what the plan says.')}
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-sm border px-3 py-2.5" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
        <Search size={16} style={{ color: 'var(--nx-text-muted)' }} />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Nom du système, de l’agence, du fournisseur…', 'Name of the system, branch, supplier…')}
          className="w-full bg-transparent outline-none" style={{ color: 'var(--nx-text)', fontSize: 15 }} />
      </div>

      {matches.length > 0 && (
        <div className="flex flex-col divide-y rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
          {matches.map((n) => (
            <button key={n.id} onClick={() => { setParams({ asset: n.id }); setQuery('') }}
              className="flex items-center justify-between px-3 py-2.5 text-left" style={{ borderColor: 'var(--nx-border)' }}>
              <span style={{ fontSize: 13.5, color: 'var(--nx-text)' }}>{n.name}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{entityTypeLabel(n.entityType, t)} · {n.criticality}</span>
            </button>
          ))}
        </div>
      )}

      {incident.isLoading && (
        <div className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12.5, color: 'var(--nx-text-muted)' }}>
          <Loader2 size={14} className="animate-spin" /> {t('CALCUL DE LA CASCADE…', 'COMPUTING THE CASCADE…')}
        </div>
      )}
      {incident.data && <Report data={incident.data} onOpen={(id, name) => navigate(`/simulations?asset=${id}&name=${encodeURIComponent(name)}`)} />}
    </div>
  )
}

function Report({ data, onOpen }: { data: NonNullable<ReturnType<typeof useIncident>>; onOpen: (id: string, name: string) => void }) {
  const { t } = useLang()
  const money = useMoney()

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-sm border p-4" style={{ background: 'color-mix(in srgb, var(--nx-danger) 6%, transparent)', borderColor: 'color-mix(in srgb, var(--nx-danger) 35%, transparent)' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>{t('Système tombé', 'System down')}</p>
            <h3 style={{ fontFamily: geist, fontSize: 26, color: 'var(--nx-text)' }}>{data.entity.name}</h3>
            <p style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{entityTypeLabel(data.entity.type, t)} · {t('criticité', 'criticality')} {data.entity.criticality}</p>
          </div>
          <div className="flex gap-8">
            <Figure label={t('Éléments touchés', 'Affected elements')} value={String(data.affectedCount)} />
            <Figure label={t('Coût par heure', 'Cost per hour')} value={money.compact(data.estimatedHourlyCost)} color={ERR} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('Qui appeler', 'Who to call')} icon={<Phone size={14} />}>
          {data.people.length === 0
            ? <Empty text={t('Personne n’est rattaché à ces éléments. C’est un angle mort : nommez un responsable.', 'Nobody is attached to these elements. That is a blind spot: name someone responsible.')} />
            : data.people.map((p) => (
              <div key={p.id} className="flex flex-col gap-0.5 py-2">
                <span style={{ fontSize: 13.5, color: 'var(--nx-text)' }}>{p.name}</span>
                <span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
                  {relationTypeLabel(p.link, t)} · {p.via.join(', ')}
                </span>
                {p.backup.length > 0 && (
                  <span style={{ fontSize: 12, color: CYAN_T }}>{t('Suppléant', 'Backup')} : {p.backup.join(', ')}</span>
                )}
              </div>
            ))}
        </Panel>

        <Panel title={t('Ce qui prend le relais', 'What takes over')} icon={<LifeBuoy size={14} />}>
          {data.alternatives.length === 0
            ? <Empty text={t('Aucun secours déclaré. Si cet élément tombe, rien ne le remplace.', 'No declared backup. If this element fails, nothing replaces it.')} danger />
            : data.alternatives.map((a) => (
              <div key={a.id} className="py-2" style={{ fontSize: 13.5, color: 'var(--nx-text)' }}>
                {a.name} <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{entityTypeLabel(a.entityType, t)}</span>
              </div>
            ))}
        </Panel>

        <Panel title={t('Ce que dit le plan', 'What the plan says')} icon={<BookOpen size={14} />}>
          {data.plans.length === 0
            ? <Empty text={t('Aucun plan rattaché à ce périmètre.', 'No plan attached to this scope.')} />
            : data.plans.map((p) => (
              <div key={p.id} className="flex flex-col gap-0.5 py-2">
                <span style={{ fontSize: 13.5, color: 'var(--nx-text)' }}>{p.name}</span>
                {p.description && <span style={{ fontSize: 12, color: 'var(--nx-text-muted)', lineHeight: 1.45 }}>{p.description}</span>}
              </div>
            ))}
        </Panel>

        <Panel title={t('Fournisseurs concernés', 'Suppliers involved')} icon={<Truck size={14} />}>
          {data.suppliers.length === 0
            ? <Empty text={t('Aucun fournisseur dans le périmètre touché.', 'No supplier in the affected scope.')} />
            : data.suppliers.map((s) => (
              <div key={s.id} className="flex flex-col gap-0.5 py-2">
                <span style={{ fontSize: 13.5, color: 'var(--nx-text)' }}>{s.name}</span>
                {s.description && <span style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{s.description}</span>}
              </div>
            ))}
        </Panel>
      </div>

      <Panel title={t('Ce qui tombe avec', 'What falls with it')} icon={<AlertOctagon size={14} />}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
              {[t('Élément', 'Element'), t('Type', 'Type'), t('Profondeur', 'Depth'), t('Criticité', 'Criticality'), t('Coût/h', 'Cost/h')].map((h, i) => (
                <th key={h} className={`px-2 py-2 ${i > 1 ? 'text-right' : ''}`} style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.top.map((n) => (
              <tr key={n.id} className="border-b" style={{ borderColor: 'var(--nx-border)' }}>
                <td className="px-2 py-2"><button onClick={() => onOpen(n.id, n.name)} style={{ fontSize: 13, color: CYAN_T }}>{n.name}</button></td>
                <td className="px-2 py-2" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{entityTypeLabel(n.type, t)}</td>
                <td className="px-2 py-2 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{n.depth}</td>
                <td className="px-2 py-2 text-right" style={{ fontFamily: mono, fontSize: 12, color: n.criticality >= 80 ? ERR : 'var(--nx-text)' }}>{n.criticality}</td>
                <td className="px-2 py-2 text-right" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{money.compact(n.hourlyCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-container)' }}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: 'var(--nx-border)' }}>
        <span style={{ color: 'var(--nx-text-muted)' }}>{icon}</span>
        <h3 style={{ fontFamily: mono, fontSize: 12, textTransform: 'uppercase', color: 'var(--nx-text)' }}>{title}</h3>
      </div>
      <div className="flex flex-col divide-y px-4 py-1" style={{ borderColor: 'var(--nx-border)' }}>{children}</div>
    </div>
  )
}

function Empty({ text, danger }: { text: string; danger?: boolean }) {
  return <p className="py-3" style={{ fontSize: 12.5, lineHeight: 1.5, color: danger ? ERR : 'var(--nx-text-muted)' }}>{text}</p>
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>{label}</p>
      <p style={{ fontFamily: geist, fontSize: 24, color: color ?? 'var(--nx-text)' }}>{value}</p>
    </div>
  )
}

/** Sert uniquement à typer le rapport à partir du client d'API. */
function useIncident() { return undefined as unknown as Awaited<ReturnType<typeof api.incident>> }
