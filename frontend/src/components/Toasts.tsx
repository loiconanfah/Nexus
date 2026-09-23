import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react'
import { clearJob, dismiss, getJobs, getToasts, subscribe, type Job, type ToastKind } from '../lib/notify'
import { useLang } from '../lib/i18n'

const mono = 'var(--font-mono)'

const TONE: Record<ToastKind, { color: string; icon: typeof Info }> = {
  info: { color: 'var(--nx-cyan)', icon: Info },
  success: { color: 'var(--nx-success)', icon: CheckCircle2 },
  warning: { color: 'var(--nx-warning)', icon: AlertTriangle },
  error: { color: 'var(--nx-danger)', icon: XCircle },
}

/** S'abonne au flux des notifications et des tâches de fond. */
function useNotifications() {
  const [, force] = useState(0)
  useEffect(() => subscribe(() => force((n) => n + 1)), [])
  return { toasts: getToasts(), jobs: getJobs() }
}

/**
 * Pile de notifications, en bas à droite, avec les tâches de fond en cours.
 * Montée une seule fois dans la mise en page : elle survit aux changements
 * d'écran, comme les traitements qu'elle annonce.
 */
export function Toasts() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { toasts, jobs } = useNotifications()
  const visibleJobs = useMemo(() => jobs.filter((j) => j.status === 'running' || Date.now() - j.startedAt < 1000 * 60 * 30), [jobs])

  if (toasts.length === 0 && visibleJobs.length === 0) return null
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(92vw,380px)] flex-col gap-2">
      {visibleJobs.map((j) => <JobCard key={j.id} job={j} t={t} />)}
      {toasts.map((toast) => {
        const tone = TONE[toast.kind]
        const Icon = tone.icon
        return (
          <div key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex gap-2.5 rounded-lg border p-3 shadow-lg"
            style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)', borderLeft: `3px solid ${tone.color}` }}>
            <Icon size={16} className="mt-0.5 shrink-0" style={{ color: tone.color }} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nx-text)' }}>{toast.title}</span>
              {toast.message && <span style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{toast.message}</span>}
              {toast.actions && toast.actions.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-3">
                  {toast.actions.map((a) => (
                    <button key={a.label} onClick={() => { dismiss(toast.id); if (a.to) navigate(a.to); a.run?.() }}
                      style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--nx-cyan-text)' }}>{a.label}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => dismiss(toast.id)} aria-label={t('Fermer', 'Close')} style={{ color: 'var(--nx-outline)' }}><X size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}

function JobCard({ job, t }: { job: Job; t: (fr: string, en: string) => string }) {
  const pct = job.total > 0 ? Math.min(100, Math.round((job.step / job.total) * 100)) : 0
  const running = job.status === 'running'
  const color = job.status === 'error' ? 'var(--nx-danger)' : job.status === 'done' ? 'var(--nx-success)' : 'var(--nx-cyan)'
  return (
    <div className="pointer-events-auto flex flex-col gap-1.5 rounded-lg border p-3 shadow-lg"
      style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)', borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center gap-2">
        {running ? <Loader2 size={14} className="animate-spin shrink-0" style={{ color }} />
          : job.status === 'done' ? <CheckCircle2 size={14} className="shrink-0" style={{ color }} />
            : <AlertTriangle size={14} className="shrink-0" style={{ color }} />}
        <span className="flex-1 truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-text)' }}>{job.label}</span>
        {running
          ? <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{pct} %</span>
          : <button onClick={() => clearJob(job.id)} aria-label={t('Retirer', 'Remove')} style={{ color: 'var(--nx-outline)' }}><X size={13} /></button>}
      </div>
      {running && (
        <div className="h-1 overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-high)' }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(4, pct)}%`, background: color }} />
        </div>
      )}
      <span className="truncate" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>
        {job.status === 'error' ? job.error : job.status === 'done' ? job.summary : job.status === 'cancelled' ? t('Annulé', 'Cancelled') : job.detail}
      </span>
      {running && job.cancel && (
        <button onClick={() => job.cancel?.()} className="self-start" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Annuler', 'Cancel')}</button>
      )}
      {running && (
        <span style={{ fontSize: 11.5, color: 'var(--nx-outline)' }}>
          {t('Vous pouvez continuer ailleurs : le traitement se poursuit.', 'You can carry on elsewhere: the task keeps running.')}
        </span>
      )}
    </div>
  )
}
