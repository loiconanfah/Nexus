import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { notify } from '../lib/notify'
import { actionKindLabel, priorityLabel } from '../lib/labels'
import { ActionModal } from '../components/ActionModal'
import type { ActionStatus, RemediationAction } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

const PRIO: Record<string, string> = { High: 'var(--nx-danger)', Medium: 'var(--nx-warning)', Low: 'var(--nx-text-muted)' }
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
      {error && <div style={{ color: 'var(--nx-danger)' }}>{(error as Error).message}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Tile label={t('TOTAL', 'TOTAL')} value={data.summary.total} color="var(--nx-text)" />
            <Tile label={t('À FAIRE', 'OPEN')} value={data.summary.open} color="var(--nx-danger)" />
            <Tile label={t('EN COURS', 'IN PROGRESS')} value={data.summary.inProgress} color="var(--nx-warning)" />
            <Tile label={t('TERMINÉ', 'DONE')} value={data.summary.done} color="var(--nx-success)" />
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

/**
 * Une action n'est pas une ligne, c'est une marche à suivre.
 *
 * Plate, elle ne se suit pas : on ne sait ni par où commencer, ni où l'on en est,
 * et le statut se tient à la main, donc mal. Avec ses étapes, cocher la dernière
 * suffit : le statut suit tout seul, et la barre dit l'avancement sans qu'on ait
 * à le déclarer.
 */
function ActionRow({ a, statusLabel, onStatus }: { a: RemediationAction; statusLabel: (s: ActionStatus) => string; onStatus: (s: ActionStatus) => void }) {
  const { t } = useLang()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const steps = a.steps ?? []
  const done = steps.filter((x) => x.done).length

  const toggle = useMutation({
    mutationFn: ({ index, value }: { index: number; value: boolean }) => api.toggleActionStep(a.id, index, value),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['actions'] })
      if (r.status === 'Done') {
        notify({
          kind: 'success',
          title: t('Action terminée', 'Action completed'),
          message: t(`« ${a.title} » : toutes les étapes sont faites.${a.expectedGain ? ' ' + a.expectedGain : ''}`,
            `“${a.title}”: every step is done.${a.expectedGain ? ' ' + a.expectedGain : ''}`),
          actions: [{ label: t('Voir l’indice', 'See the index'), to: '/dashboard' }],
        })
      }
    },
    onError: (e) => notify({ kind: 'error', title: t('Mise à jour impossible', 'Could not update'), message: (e as Error).message.slice(0, 160) }),
  })

  return (
    <div className="flex flex-col gap-2 rounded-sm border p-4" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)', borderLeft: `3px solid ${PRIO[a.priority]}` }}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 9, color: PRIO[a.priority], background: `color-mix(in srgb, ${PRIO[a.priority]} 9%, transparent)` }}>{priorityLabel(a.priority, t)}</span>
            {a.targetName !== '—' && <span style={{ fontFamily: mono, fontSize: 10, color: CYAN_T }}>→ {a.targetName}</span>}
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{actionKindLabel(a.kind, t)}</span>
            {steps.length > 0 && (
              <span style={{ fontFamily: mono, fontSize: 10, color: done === steps.length ? 'var(--nx-success)' : 'var(--nx-text-muted)' }}>
                {done}/{steps.length} {t('étapes', 'steps')}
              </span>
            )}
          </div>
          <div className="mt-1" style={{ fontSize: 14, color: 'var(--nx-text)' }}>{a.title}</div>
          {a.detail && <div style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{a.detail}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {steps.length > 0 && (
            <button onClick={() => setOpen((v) => !v)} className="rounded-sm border px-2 py-1" style={{ fontFamily: mono, fontSize: 10, borderColor: 'var(--nx-border)', color: CYAN_T }}>
              {open ? t('Masquer', 'Hide') : t('Étapes', 'Steps')}
            </button>
          )}
          {STATUS_ORDER.map((st) => {
            const active = a.status === st
            return (
              <button key={st} onClick={() => onStatus(st)} className="rounded-sm border px-2.5 py-1" style={{ fontFamily: mono, fontSize: 10, borderColor: active ? CYAN : 'var(--nx-border)', color: active ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', background: active ? CYAN : 'transparent' }}>
                {statusLabel(st)}
              </button>
            )
          })}
        </div>
      </div>

      {steps.length > 0 && (
        <div className="h-1 overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-high)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(done / steps.length) * 100}%`, background: done === steps.length ? 'var(--nx-success)' : CYAN }} />
        </div>
      )}

      {open && steps.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t pt-2" style={{ borderColor: 'var(--nx-border)' }}>
          {steps.map((step, i) => (
            <label key={i} className="flex cursor-pointer items-start gap-2" style={{ fontSize: 13, lineHeight: 1.5, color: step.done ? 'var(--nx-text-muted)' : 'var(--nx-text)' }}>
              <input type="checkbox" checked={step.done} disabled={toggle.isPending}
                onChange={(e) => toggle.mutate({ index: i, value: e.target.checked })}
                className="mt-0.5" style={{ accentColor: CYAN }} />
              <span style={{ textDecoration: step.done ? 'line-through' : 'none' }}>{step.text}</span>
            </label>
          ))}
          {a.expectedGain && (
            <span className="mt-1" style={{ fontSize: 12, color: 'var(--nx-success)', lineHeight: 1.45 }}>{a.expectedGain}</span>
          )}
        </div>
      )}
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
