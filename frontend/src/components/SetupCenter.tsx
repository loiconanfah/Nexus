import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowRight, Bell, CheckCircle2, ChevronDown, ChevronUp, Circle, Info, Loader2, X, XCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { useOrganization } from '../lib/money'
import type { Notice, SetupStep } from '../lib/types'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

type T = (fr: string, en: string) => string

/** Libellé et raison d'être de chaque étape : l'utilisateur sait QUOI faire et POURQUOI. */
const STEP_TEXT: Record<string, { title: [string, string]; why: [string, string] }> = {
  profile: {
    title: ['Compléter le profil de l’organisation', 'Complete the organisation profile'],
    why: ['Devise et chiffres de référence : sans eux, les montants ne sont pas à votre échelle.', 'Currency and reference figures: without them, amounts are not at your scale.'],
  },
  activities: {
    title: ['Déclarer vos activités métier', 'Declare your business activities'],
    why: ['Ce que votre organisation produit (crédit, épargne, transferts…) : c’est ce qu’une panne menace.', 'What your organisation delivers (loans, savings, transfers…): this is what an outage threatens.'],
  },
  systems: {
    title: ['Recenser vos systèmes', 'List your systems'],
    why: ['Logiciels, serveurs, réseaux, services cloud : les maillons sur lesquels reposent vos activités.', 'Software, servers, networks, cloud services: the links your activities rely on.'],
  },
  dependencies: {
    title: ['Relier les dépendances', 'Connect the dependencies'],
    why: ['« A a besoin de B » : sans ces liens, impossible de voir comment une panne se propage.', '“A needs B”: without these links, there is no way to see how an outage spreads.'],
  },
  suppliers: {
    title: ['Identifier vos fournisseurs clés', 'Identify your key suppliers'],
    why: ['Opérateur télécom, éditeur du logiciel bancaire, électricité : les dépendances hors de vos murs.', 'Telecom operator, banking software vendor, power: the dependencies outside your walls.'],
  },
  people: {
    title: ['Indiquer les rôles clés', 'Record key roles'],
    why: ['Par rôle, pas par nom : qui détient un savoir que personne d’autre n’a.', 'By role, not by name: who holds knowledge nobody else has.'],
  },
  costs: {
    title: ['Chiffrer l’arrêt des activités critiques', 'Price the downtime of critical activities'],
    why: ['Le coût d’une heure d’arrêt, activité par activité : la base de tout chiffrage d’impact.', 'The cost of one hour of downtime, activity by activity: the basis of every impact estimate.'],
  },
  validate: {
    title: ['Valider les dépendances importantes', 'Validate the important dependencies'],
    why: ['Une dépendance confirmée par un humain rend les analyses fiables et défendables.', 'A dependency confirmed by a person makes analyses reliable and defensible.'],
  },
  simulation: {
    title: ['Lancer une première simulation', 'Run a first simulation'],
    why: ['« Et si ce système tombait ? » : le moment où la cartographie devient utile.', '“What if this system went down?”: the moment the map becomes useful.'],
  },
  team: {
    title: ['Inviter un collègue', 'Invite a colleague'],
    why: ['DSI, risques, continuité : la cartographie se fiabilise à plusieurs.', 'IT, risk, continuity: the map becomes reliable when several people contribute.'],
  },
  report: {
    title: ['Produire un premier rapport', 'Produce a first report'],
    why: ['La synthèse à présenter à la direction ou au régulateur.', 'The summary to present to management or the regulator.'],
  },
}

export function stepTitle(key: string, t: T) {
  const s = STEP_TEXT[key]
  return s ? t(...s.title) : key
}

function useSetupProgress() {
  const { pathname } = useLocation()
  const q = useQuery({ queryKey: ['setup-progress'], queryFn: api.setupProgress, refetchInterval: 60_000, staleTime: 15_000 })
  // Chaque changement d'écran peut avoir fait avancer la mise en place (import, validation…).
  const { refetch } = q
  useEffect(() => { void refetch() }, [pathname, refetch])
  return q
}

const HIDE_KEY = 'nexus.setupbar.collapsed'

/**
 * Barre de mise en place, sous l'en-tête : où j'en suis, quelle est la prochaine
 * étape, et un clic pour y aller. Disparaît quand tout est fait.
 */
export function SetupBar() {
  const { t } = useLang()
  const navigate = useNavigate()
  const org = useOrganization()
  const { data } = useSetupProgress()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false } })

  const toggleCollapsed = () => {
    const v = !collapsed
    setCollapsed(v)
    try { localStorage.setItem(HIDE_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }

  if (org.data?.waitingForAdmin) {
    return (
      <div className="flex items-center gap-2 border-b px-6 py-2 text-sm" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)', color: 'var(--nx-text-muted)' }}>
        <Info size={14} style={{ color: CYAN }} />
        {t('L’administrateur de votre espace n’a pas encore terminé la mise en place : certains montants peuvent ne pas être dans votre devise.',
          'Your workspace administrator has not finished setup yet: some amounts may not be in your currency.')}
      </div>
    )
  }
  if (!data || data.percent >= 100) return null

  const next = data.steps.find((s) => s.key === data.next)
  const requiredLeft = data.steps.filter((s) => s.required && !s.done).length

  // Obligatoire fait et barre repliée : une simple pastille, l'essentiel reste dans la cloche.
  if (collapsed && data.requiredDone) {
    return (
      <button onClick={toggleCollapsed} className="flex w-full items-center gap-2 border-b px-6 py-1 text-left" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)', fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
        <Progress percent={data.percent} width={80} /> {t('Mise en place', 'Setup')} {data.percent} % <ChevronDown size={12} />
      </button>
    )
  }

  return (
    <div className="border-b" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }} data-tour="setup">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5">
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>{t('Mise en place', 'Setup')}</span>
          <Progress percent={data.percent} width={140} />
          <span style={{ fontFamily: geist, fontSize: 14, fontWeight: 600 }}>{data.percent} %</span>
        </div>
        {next && (
          <div className="order-last flex min-w-0 flex-1 basis-full items-center gap-2 text-sm lg:order-none lg:basis-auto">
            <span className="shrink-0 whitespace-nowrap" style={{ color: 'var(--nx-text-muted)' }}>{requiredLeft > 0 ? t('À faire :', 'To do:') : t('Pour aller plus loin :', 'To go further:')}</span>
            <span className="truncate font-medium">{stepTitle(next.key, t)}</span>
            {next.target > 1 && <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{next.current}/{next.target}</span>}
            <button onClick={() => navigate(next.route)} className="flex shrink-0 items-center gap-1 rounded px-2.5 py-1" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('Y aller', 'Go')} <ArrowRight size={12} />
            </button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-sm border px-2 py-1 text-xs" style={{ borderColor: 'var(--nx-border)', color: 'var(--nx-text-muted)' }}>
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {t(`Toutes les étapes (${data.doneCount}/${data.total})`, `All steps (${data.doneCount}/${data.total})`)}
          </button>
          {data.requiredDone && (
            <button onClick={toggleCollapsed} className="rounded-sm p-1" style={{ color: 'var(--nx-text-muted)' }} title={t('Réduire', 'Collapse')} aria-label={t('Réduire', 'Collapse')}><X size={14} /></button>
          )}
        </div>
      </div>

      {open && (
        <div className="grid gap-2 border-t px-6 py-4 sm:grid-cols-2 xl:grid-cols-3" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
          {data.steps.map((s) => <StepCard key={s.key} s={s} t={t} onGo={() => { setOpen(false); navigate(s.route) }} />)}
        </div>
      )}
    </div>
  )
}

function StepCard({ s, t, onGo }: { s: SetupStep; t: T; onGo: () => void }) {
  const text = STEP_TEXT[s.key]
  return (
    <button onClick={onGo} className="flex items-start gap-3 rounded-md border p-3 text-left transition-colors hover:brightness-110"
      style={{ borderColor: s.done ? 'var(--nx-border)' : s.required ? 'color-mix(in srgb, var(--nx-cyan) 45%, var(--nx-border))' : 'var(--nx-border)', background: 'var(--nx-surface)', opacity: s.done ? 0.7 : 1 }}>
      {s.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--color-low)' }} /> : <Circle size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--nx-text-muted)' }} />}
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium" style={{ textDecoration: s.done ? 'line-through' : 'none' }}>{text ? t(...text.title) : s.key}</span>
          {s.required && !s.done && <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)', border: `1px solid ${CYAN}`, borderRadius: 3, padding: '0 4px' }}>{t('Requis', 'Required')}</span>}
          {s.target > 1 && <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{Math.min(s.current, s.target)}/{s.target}</span>}
        </span>
        {text && <span className="mt-0.5 block text-xs" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{t(...text.why)}</span>}
      </span>
    </button>
  )
}

function Progress({ percent, width }: { percent: number; width: number }) {
  return (
    <span className="relative inline-block overflow-hidden rounded-full" style={{ width, height: 6, background: 'var(--nx-border)' }} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <span className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${percent}%`, background: CYAN }} />
    </span>
  )
}

// ── Notifications ──────────────────────────────────────────────────────────

const READ_KEY = 'nexus.notices.read'

function readSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

function noticeText(n: Notice, t: T, lang: string): string {
  const d = n.data
  const num = (k: string) => Number(d[k] ?? 0)
  if (n.code.startsWith('setup.')) {
    const key = n.code.slice(6)
    const progress = num('target') > 1 ? ` (${num('current')}/${num('target')})` : ''
    return t(`Prochaine étape de mise en place : ${stepTitle(key, t)}${progress}`, `Next setup step: ${stepTitle(key, t)}${progress}`)
  }
  switch (n.code) {
    case 'ops.running': return t(`${num('count')} collecte(s) en cours d’exécution`, `${num('count')} collection(s) running`)
    case 'ops.queued': return t(`${num('count')} collecte(s) en attente de la sonde`, `${num('count')} collection(s) waiting for the probe`)
    case 'ops.failed': return t(`Une collecte a échoué${d.error ? ` : ${String(d.error)}` : ''}`, `A collection failed${d.error ? `: ${String(d.error)}` : ''}`)
    case 'ops.done': return t(`Collecte terminée : ${num('entities')} élément(s) et ${num('relations')} dépendance(s) ajoutés`, `Collection finished: ${num('entities')} element(s) and ${num('relations')} dependency(ies) added`)
    case 'collector.offline': {
      const since = d.since ? new Date(String(d.since)).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'short', timeStyle: 'short' }) : '—'
      return t(`La sonde « ${String(d.name)} » ne répond plus depuis le ${since}`, `Probe “${String(d.name)}” has not responded since ${since}`)
    }
    case 'data.suggested': return t(`${num('count')} dépendance(s) suggérée(s) par l’IA attendent votre validation`, `${num('count')} AI-suggested dependency(ies) await your validation`)
    case 'data.weak': return t(`${num('count')} dépendance(s) reposent sur des preuves faibles`, `${num('count')} dependency(ies) rest on weak evidence`)
    case 'actions.open': return t(`${num('count')} action(s) du plan restent ouvertes`, `${num('count')} action plan item(s) remain open`)
    default: return n.code
  }
}

const SEVERITY: Record<Notice['severity'], { color: string; icon: typeof Info }> = {
  danger: { color: 'var(--color-critical)', icon: XCircle },
  warning: { color: 'var(--color-elevated)', icon: AlertTriangle },
  info: { color: CYAN, icon: Info },
  success: { color: 'var(--color-low)', icon: CheckCircle2 },
}

/** Cloche : rappels de tâches et opérations en cours, rafraîchis chaque minute. */
export function NotificationBell() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState<Set<string>>(readSet)
  const ref = useRef<HTMLDivElement>(null)
  const { data, isFetching } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications, refetchInterval: 60_000, staleTime: 15_000 })
  const list = useMemo(() => data?.notifications ?? [], [data])
  const unread = list.filter((n) => !read.has(n.id)).length
  const running = list.some((n) => n.code === 'ops.running')

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const markAll = () => {
    const s = new Set([...read, ...list.map((n) => n.id)])
    setRead(s)
    // On ne garde que les identifiants encore d'actualité : la liste ne grossit pas indéfiniment.
    try { localStorage.setItem(READ_KEY, JSON.stringify(list.map((n) => n.id).filter((id) => s.has(id)))) } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative flex shrink-0 items-center justify-center rounded-sm p-1.5 transition-colors hover:brightness-125"
        style={{ color: 'var(--nx-text-muted)', border: '1px solid var(--nx-border)' }}
        title={t('Notifications', 'Notifications')} aria-label={t(`Notifications (${unread} non lues)`, `Notifications (${unread} unread)`)}>
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1" style={{ background: 'var(--color-critical)', color: '#fff', fontFamily: mono, fontSize: 10, lineHeight: 1 }}>{unread > 9 ? '9+' : unread}</span>
        )}
        {running && unread === 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: CYAN }} />}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-[60] w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-md border shadow-xl" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
          <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--nx-border)' }}>
            <span className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>
              {t('Notifications', 'Notifications')} {isFetching && <Loader2 size={12} className="animate-spin" />}
            </span>
            {unread > 0 && <button onClick={markAll} className="text-xs" style={{ color: CYAN_T }}>{t('Tout marquer comme lu', 'Mark all as read')}</button>}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {list.length === 0 && (
              <li className="px-4 py-6 text-center text-sm" style={{ color: 'var(--nx-text-muted)' }}>
                <CheckCircle2 size={20} className="mx-auto mb-2" style={{ color: 'var(--color-low)' }} />
                {t('Rien à signaler : tout est à jour.', 'Nothing to report: everything is up to date.')}
              </li>
            )}
            {list.map((n) => {
              const sev = SEVERITY[n.severity] ?? SEVERITY.info
              const Icon = n.code === 'ops.running' ? Loader2 : sev.icon
              const isRead = read.has(n.id)
              return (
                <li key={n.id}>
                  <button onClick={() => {
                    const s = new Set(read); s.add(n.id); setRead(s)
                    try { localStorage.setItem(READ_KEY, JSON.stringify([...s])) } catch { /* ignore */ }
                    setOpen(false)
                    if (n.route) navigate(n.route)
                  }} className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:brightness-110"
                    style={{ borderColor: 'var(--nx-border)', background: isRead ? 'transparent' : 'color-mix(in srgb, var(--nx-cyan) 5%, transparent)' }}>
                    <Icon size={16} className={`mt-0.5 shrink-0 ${n.code === 'ops.running' ? 'animate-spin' : ''}`} style={{ color: sev.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm" style={{ color: 'var(--nx-text)', fontWeight: isRead ? 400 : 500, lineHeight: 1.45 }}>{noticeText(n, t, lang)}</span>
                      <span className="mt-0.5 block" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {n.kind === 'task' ? t('À faire', 'To do') : n.kind === 'operation' ? t('Opération', 'Operation') : t('Alerte', 'Alert')}
                        {n.at && ` · ${new Date(n.at).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'short', timeStyle: 'short' })}`}
                      </span>
                    </span>
                    {!isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: CYAN }} />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
