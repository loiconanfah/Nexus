/**
 * Notifications en surimpression (« toasts ») et TÂCHES DE FOND.
 *
 * Deux manques que ce module comble :
 *
 * 1. L'application était muette : une analyse se terminait, un import créait
 *    cinquante actifs, le modèle IA était absent, et rien ne le disait si l'on
 *    ne regardait pas le bon écran. Elle signale désormais ce qu'elle trouve.
 *
 * 2. Une analyse ou un import s'arrêtait dès qu'on quittait l'écran. Le travail
 *    vit maintenant ICI, hors des composants : on peut naviguer ailleurs pendant
 *    qu'il tourne. Limite assumée : fermer ou recharger l'onglet l'interrompt,
 *    car le traitement s'exécute dans le navigateur.
 */

export type ToastKind = 'info' | 'success' | 'warning' | 'error'
export type ToastAction = { label: string; to?: string; run?: () => void }

export type Toast = {
  id: number
  kind: ToastKind
  title: string
  message?: string
  actions?: ToastAction[]
  /** Millisecondes avant disparition ; 0 = reste jusqu'au clic. */
  duration: number
}

export type JobStatus = 'running' | 'done' | 'error' | 'cancelled'
export type Job = {
  id: number
  kind: 'document' | 'import'
  label: string
  detail: string
  step: number
  total: number
  status: JobStatus
  startedAt: number
  /** Résultat lisible une fois terminé (compte d'éléments, de liens…). */
  summary?: string
  error?: string
  cancel?: () => void
}

type Listener = () => void

let toasts: Toast[] = []
let jobs: Job[] = []
let nextId = 1
const listeners = new Set<Listener>()
const emit = () => listeners.forEach((l) => l())

export function subscribe(l: Listener): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export const getToasts = (): Toast[] => toasts
export const getJobs = (): Job[] => jobs

const DEFAULT_DURATION: Record<ToastKind, number> = { info: 6000, success: 6000, warning: 10000, error: 0 }

/** Affiche une notification. Retourne son identifiant (pour la retirer plus tôt). */
export function notify(t: { kind?: ToastKind; title: string; message?: string; actions?: ToastAction[]; duration?: number }): number {
  const kind = t.kind ?? 'info'
  const id = nextId++
  const toast: Toast = { id, kind, title: t.title, message: t.message, actions: t.actions, duration: t.duration ?? DEFAULT_DURATION[kind] }
  // Cinq au maximum à l'écran : au-delà, les plus anciennes cèdent la place.
  toasts = [...toasts, toast].slice(-5)
  emit()
  if (toast.duration > 0) setTimeout(() => dismiss(id), toast.duration)
  return id
}

export function dismiss(id: number): void {
  toasts = toasts.filter((x) => x.id !== id)
  emit()
}

/** Déclare une tâche de fond et renvoie de quoi la faire avancer. */
export function startJob(kind: Job['kind'], label: string, total: number, cancel?: () => void) {
  const id = nextId++
  const job: Job = { id, kind, label, detail: '', step: 0, total, status: 'running', startedAt: Date.now(), cancel }
  jobs = [...jobs, job]
  emit()

  const update = (patch: Partial<Job>) => {
    jobs = jobs.map((j) => (j.id === id ? { ...j, ...patch } : j))
    emit()
  }
  return {
    id,
    progress: (step: number, detail = '') => update({ step, detail }),
    total: (n: number) => update({ total: n }),
    done: (summary: string) => update({ status: 'done', summary, step: jobs.find((j) => j.id === id)?.total ?? 0 }),
    fail: (error: string) => update({ status: 'error', error }),
    cancelled: () => update({ status: 'cancelled' }),
  }
}

/** Retire une tâche terminée de la liste. */
export function clearJob(id: number): void {
  jobs = jobs.filter((j) => j.id !== id)
  emit()
}

export const runningJobs = (): Job[] => jobs.filter((j) => j.status === 'running')
