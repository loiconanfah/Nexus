import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { ActionModal } from '../components/ActionModal'
import type { ActionStatus, RemediationAction } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

const PRIO: Record<string, string> = { High: '#ffb4ab', Medium: '#facc15', Low: '#849396' }
const STATUS_ORDER: ActionStatus[] = ['Open', 'InProgress', 'Done']

export function ActionPlan() {
  const { t } = useLang()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const { data, isLoading, error } = useQuery({ queryKey: ['actions'], queryFn: api.actions })

  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ActionStatus }) => api.updateActionStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['actions'] }),
  })

  const statusLabel = (s: ActionStatus) => s === 'Open' ? t('À faire', 'Open') : s === 'InProgress' ? t('En cours', 'In progress') : t('Terminé', 'Done')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
            <ClipboardList size={22} style={{ color: CYAN }} /> {t('Plan d’action', 'Action Plan')}
          </h2>
          <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>{t('Actions de remédiation et plans de contingence, reliés aux actifs qu’ils protègent.', 'Remediation actions and contingency plans, linked to the assets they protect.')}</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontSize: 13, fontWeight: 600 }}>
          <Plus size={16} /> {t('Nouvelle action', 'New action')}
        </button>
      </div>

      {isLoading && <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>{t('Chargement…', 'Loading…')}</div>}
      {error && <div style={{ color: '#ffb4ab' }}>{(error as Error).message}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Tile label={t('TOTAL', 'TOTAL')} value={data.summary.total} color="var(--nx-text)" />
            <Tile label={t('À FAIRE', 'OPEN')} value={data.summary.open} color="#ffb4ab" />
            <Tile label={t('EN COURS', 'IN PROGRESS')} value={data.summary.inProgress} color="#facc15" />
            <Tile label={t('TERMINÉ', 'DONE')} value={data.summary.done} color="#4ade80" />
          </div>

          {data.actions.length === 0 && (
            <div className="rounded-sm border p-8 text-center" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 13, color: 'var(--nx-text-muted)' }}>
              {t('Aucune action pour l’instant. Créez-en une, ou depuis les centres Risques et Dép. humaines.', 'No actions yet. Create one, or from the Risks and Human Deps centers.')}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {data.actions.map((a) => (
              <ActionRow key={a.id} a={a} statusLabel={statusLabel} onStatus={(status) => patch.mutate({ id: a.id, status })} />
            ))}
          </div>
        </>
      )}

      <ActionModal open={modal} onClose={() => setModal(false)} />
    </div>
  )
}

function ActionRow({ a, statusLabel, onStatus }: { a: RemediationAction; statusLabel: (s: ActionStatus) => string; onStatus: (s: ActionStatus) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-sm border p-4 md:flex-row md:items-center md:justify-between" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', borderLeft: `3px solid ${PRIO[a.priority]}` }}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 9, color: PRIO[a.priority], background: `${PRIO[a.priority]}18` }}>{a.priority.toUpperCase()}</span>
          {a.targetName !== '—' && <span style={{ fontFamily: mono, fontSize: 10, color: CYAN_T }}>→ {a.targetName}</span>}
          <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{a.kind}</span>
        </div>
        <div className="mt-1" style={{ fontSize: 14, color: 'var(--nx-text)' }}>{a.title}</div>
        {a.detail && <div style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>{a.detail}</div>}
      </div>
      <div className="flex shrink-0 gap-1">
        {STATUS_ORDER.map((s) => {
          const active = a.status === s
          return (
            <button key={s} onClick={() => onStatus(s)} className="rounded-sm border px-2.5 py-1" style={{ fontFamily: mono, fontSize: 10, borderColor: active ? CYAN : 'var(--nx-border)', color: active ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', background: active ? CYAN : 'transparent' }}>
              {statusLabel(s)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-sm border p-3" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: geist, fontSize: 24, fontWeight: 500, color }}>{value}</div>
    </div>
  )
}
