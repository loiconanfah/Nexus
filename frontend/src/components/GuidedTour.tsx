import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react'
import { useLang } from '../lib/i18n'

/**
 * Visite guidée du premier lancement.
 *
 * Elle surligne des éléments RÉELS de l'interface (pas des captures) et peut
 * changer de page en cours de route : chaque étape déclare le chemin où elle se
 * joue, et on attend que sa cible apparaisse avant de la montrer. Une étape dont
 * la cible reste introuvable est sautée plutôt que de bloquer la visite.
 *
 * Marquer une cible : `data-tour="nom"` sur l'élément.
 */

const DONE_KEY = 'nexus.tour.done'
const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'

type Step = {
  /** Sélecteur data-tour de la cible ; absent = étape centrée, sans surlignage. */
  target?: string
  /** Page sur laquelle jouer l'étape. */
  path?: string
  title: [string, string]
  body: [string, string]
  /** Côté préféré pour l'infobulle ; on bascule si la place manque. */
  place?: 'right' | 'bottom' | 'left' | 'top'
}

const STEPS: Step[] = [
  {
    path: '/',
    title: ['Bienvenue dans Lenexux', 'Welcome to Lenexux'],
    body: [
      'Quelques minutes pour faire le tour. Lenexux relie vos systèmes, fournisseurs et personnes en une seule carte, puis vous dit ce qui casse quand l’un d’eux tombe — et ce que ça coûte.',
      'A few minutes for the tour. Lenexux links your systems, suppliers and people into a single map, then tells you what breaks when one of them fails — and what it costs.',
    ],
  },
  {
    path: '/', target: 'nav', place: 'right',
    title: ['Le menu, en six familles', 'The menu, in six families'],
    body: [
      'Tout est rangé par intention : comprendre, analyser, tenir le choc, savoir, alimenter. Vous n’avez pas à tout connaître aujourd’hui.',
      'Everything is grouped by intent: understand, analyse, withstand, know, feed. You do not need to know all of it today.',
    ],
  },
  {
    path: '/', target: 'tutorial', place: 'top',
    title: ['Le mode d’emploi reste ici', 'The manual stays here'],
    body: [
      'Les huit fonctions phares, chacune avec les gestes à faire dans l’ordre. Cette page ne bouge pas : revenez-y quand un écran vous semble obscur.',
      'The eight flagship features, each with the steps to follow in order. This page does not move: come back whenever a screen seems opaque.',
    ],
  },
  {
    path: '/', target: 'search', place: 'bottom',
    title: ['Chercher un actif, de partout', 'Search an asset, from anywhere'],
    body: [
      'Tapez le nom d’un serveur, d’une application ou d’un fournisseur : vous atterrissez directement dessus dans le graphe.',
      'Type the name of a server, application or supplier: you land straight on it in the graph.',
    ],
  },
  {
    path: '/graph', target: 'page', place: 'top',
    title: ['La carte de vos dépendances', 'The map of your dependencies'],
    body: [
      'Chaque point est un actif, chaque trait un « dépend de ». Cliquez un point pour ne garder que son voisinage — ce dont il dépend, et ce qui dépend de lui.',
      'Each dot is an asset, each line a “depends on”. Click a dot to keep only its neighbourhood — what it depends on, and what depends on it.',
    ],
  },
  {
    path: '/risks', target: 'page', place: 'top',
    title: ['Ce qu’il faut sécuriser en premier', 'What to secure first'],
    body: [
      'Vos actifs classés de 0 à 100. Regardez ceux marqués sans redondance : ce sont vos points uniques de défaillance, ceux qu’on découvre d’habitude le jour de la panne.',
      'Your assets ranked 0 to 100. Look at those marked without redundancy: those are your single points of failure, the ones usually discovered on the day it fails.',
    ],
  },
  {
    path: '/impact', target: 'page', place: 'top',
    title: ['Poser la question en français', 'Ask the question in plain language'],
    body: [
      '« Et si nous perdons ce fournisseur ? » Le moteur suit la cascade et chiffre l’impact — et vous dit toujours sur quelles preuves il s’avance.',
      '“What if we lose this supplier?” The engine follows the cascade and quantifies the impact — and always tells you what evidence it stands on.',
    ],
  },
  {
    path: '/dashboard', target: 'page', place: 'top',
    title: ['Votre tableau de bord quotidien', 'Your daily dashboard'],
    body: [
      'Vos activités debout, chacune nommée : la hauteur dit ce qu’elle mobilise, la couleur combien de points uniques de défaillance elle traverse. C’est ici qu’on revient chaque matin.',
      'Your activities standing up, each named: height says what it mobilises, colour how many single points of failure it crosses. This is where you come back each morning.',
    ],
  },
  {
    path: '/simulations', target: 'page', place: 'top',
    title: ['Faire tomber un élément, pour voir', 'Take something down, to see'],
    body: [
      'Choisissez une cible à gauche, puis la perturbation à droite — panne électrique, coupure réseau, cyberattaque, départ d’un employé clé. La cascade se propage sous vos yeux, sans que rien ne casse pour de vrai.',
      'Pick a target on the left, then the disturbance on the right — power loss, network outage, cyberattack, key employee leaving. The cascade propagates before your eyes, with nothing actually breaking.',
    ],
  },
  {
    path: '/attacks', target: 'page', place: 'top',
    title: ['Suivre une attaque de bout en bout', 'Follow an attack end to end'],
    body: [
      'Une intrusion ne s’arrête pas au premier poste : elle progresse. On voit la chaîne complète, l’impact de chaque étape, et ce que chaque contre-mesure permettrait d’éviter.',
      'An intrusion does not stop at the first machine: it progresses. You see the full chain, the impact of each step, and what each countermeasure would avoid.',
    ],
  },
  {
    path: '/suppliers', target: 'page', place: 'top',
    title: ['Vos fournisseurs, et ce qui en dépend', 'Your suppliers, and what depends on them'],
    body: [
      'Pour chaque fournisseur : ce qu’il soutient, ce qui est critique, et s’il existe une alternative. C’est la page qui révèle les risques de concentration.',
      'For each supplier: what it supports, what is critical, and whether an alternative exists. This is the page that reveals concentration risk.',
    ],
  },
  {
    path: '/human', target: 'page', place: 'top',
    title: ['Le savoir détenu par une seule personne', 'Knowledge held by one person'],
    body: [
      'Une dépendance n’est pas toujours une machine. Ici, les savoirs critiques qu’une seule personne détient — et pour lesquels personne ne peut prendre le relais.',
      'A dependency is not always a machine. Here: the critical knowledge one person alone holds — with nobody able to take over.',
    ],
  },
  {
    path: '/decision', target: 'page', place: 'top',
    title: ['Tester une décision avant de la prendre', 'Test a decision before making it'],
    body: [
      'Changer de fournisseur, externaliser, fermer un site : décrivez-le en une phrase. Le modèle d’entreprise — vos revenus, coûts et effectifs, que vous renseignez une fois — convertit la conséquence opérationnelle en dollars.',
      'Switching supplier, outsourcing, closing a site: describe it in one sentence. The enterprise model — your revenue, costs and headcount, filled in once — converts the operational consequence into dollars.',
    ],
  },
  {
    path: '/reports', target: 'page', place: 'top',
    title: ['Le rapport pour la direction', 'The report for leadership'],
    body: [
      'Un document prêt à présenter, qui reprend les chiffres du moteur — pas des captures recollées à la main la veille du comité.',
      'A document ready to present, carrying the engine’s own figures — not screenshots pasted together the night before the committee.',
    ],
  },
  {
    path: '/', target: 'nav-help', place: 'right',
    title: ['C’est tout pour l’instant', 'That’s it for now'],
    body: [
      'Vous pouvez rejouer cette visite à tout moment depuis Assistance. Bonne exploration.',
      'You can replay this tour any time from Support. Enjoy.',
    ],
  },
]

/** Ouvre la visite depuis n'importe où (bouton « Revoir la visite guidée »). */
export function startGuidedTour() {
  try { localStorage.removeItem(DONE_KEY) } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('nexus:tour:start'))
}

function alreadyDone(): boolean {
  try { return localStorage.getItem(DONE_KEY) === '1' } catch { return true }
}

type Rect = { top: number; left: number; width: number; height: number }

/** Reporte la visite automatique (elle reste disponible via la boussole et l'Accueil). */
export function deferGuidedTour() {
  try { localStorage.setItem(DONE_KEY, '1') } catch { /* ignore */ }
}

export function GuidedTour() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [running, setRunning] = useState(() => !alreadyDone())
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  /** L'étape est prête à être peinte (cible trouvée, ou étape centrée). */
  const [ready, setReady] = useState(false)
  const skippedRef = useRef(false)

  const step = STEPS[i]

  useEffect(() => {
    function onStart() { setI(0); setReady(false); setRect(null); setRunning(true) }
    window.addEventListener('nexus:tour:start', onStart)
    return () => window.removeEventListener('nexus:tour:start', onStart)
  }, [])

  const finish = useCallback(() => {
    try { localStorage.setItem(DONE_KEY, '1') } catch { /* ignore */ }
    setRunning(false)
  }, [])

  // Amène l'utilisateur sur la page de l'étape.
  useEffect(() => {
    if (!running || !step) return
    if (step.path && step.path !== pathname) navigate(step.path)
  }, [running, step, pathname, navigate])

  // Attend que la cible existe, puis mesure. Une cible introuvable au bout de
  // ~2 s n'est pas une raison de bloquer : on passe à l'étape suivante.
  useEffect(() => {
    if (!running || !step) return
    setReady(false)
    skippedRef.current = false

    if (!step.target) { setRect(null); setReady(true); return }
    if (step.path && step.path !== pathname) return

    // On sonde avec un minuteur, jamais avec requestAnimationFrame : rAF est
    // suspendu quand l'onglet passe en arrière-plan, ce qui figeait la visite
    // au premier changement d'onglet — sans erreur ni moyen d'en sortir.
    const started = Date.now()
    const look = (): boolean => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        const r = el.getBoundingClientRect()
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        setReady(true)
        return true
      }
      if (Date.now() - started > 2000 && !skippedRef.current) {
        skippedRef.current = true
        setI((k) => (k + 1 < STEPS.length ? k + 1 : k))
        return true
      }
      return false
    }

    if (look()) return
    const id = window.setInterval(() => { if (look()) window.clearInterval(id) }, 60)
    return () => window.clearInterval(id)
  }, [running, step, pathname, i])

  // Re-mesure quand la fenêtre bouge.
  useLayoutEffect(() => {
    if (!running || !step?.target) return
    function remeasure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [running, step])

  // Clavier : flèches pour circuler, Échap pour sortir.
  useEffect(() => {
    if (!running) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') setI((k) => (k + 1 < STEPS.length ? k + 1 : k))
      else if (e.key === 'ArrowLeft') setI((k) => Math.max(0, k - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, finish])

  if (!running || !step || !ready) return null

  const last = i === STEPS.length - 1
  const pad = 6
  const spot = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Voile. Sur une étape ciblée, le trou est fait par une ombre géante. */}
      {spot ? (
        <div
          onClick={finish}
          style={{
            position: 'fixed', top: spot.top, left: spot.left, width: spot.width, height: spot.height,
            borderRadius: 4, border: `1px solid ${CYAN}`,
            boxShadow: '0 0 0 9999px rgba(2,4,8,0.72)', pointerEvents: 'auto',
          }}
        />
      ) : (
        <div onClick={finish} style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.72)' }} />
      )}

      <Bubble
        spot={spot}
        place={step.place}
        index={i}
        total={STEPS.length}
        title={t(...step.title)}
        body={t(...step.body)}
        t={t}
        last={last}
        onPrev={() => setI((k) => Math.max(0, k - 1))}
        onNext={() => (last ? finish() : setI((k) => k + 1))}
        onSkip={finish}
      />
    </div>
  )
}

const BUBBLE_W = 360
const GAP = 16

function Bubble({
  spot, place, index, total, title, body, t, last, onPrev, onNext, onSkip,
}: {
  spot: Rect | null
  place?: Step['place']
  index: number
  total: number
  title: string
  body: string
  t: (fr: string, en: string) => string
  last: boolean
  onPrev: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Position : on tente le côté demandé, puis on retombe sur ce qui tient.
  let top: number
  let left: number
  if (!spot) {
    top = Math.max(GAP, vh / 2 - 140)
    left = Math.max(GAP, vw / 2 - BUBBLE_W / 2)
  } else {
    const roomRight = vw - (spot.left + spot.width)
    const roomBelow = vh - (spot.top + spot.height)
    const side =
      place === 'right' && roomRight > BUBBLE_W + GAP ? 'right'
        : place === 'left' && spot.left > BUBBLE_W + GAP ? 'left'
          : place === 'top' && spot.top > 220 ? 'top'
            : roomBelow > 240 ? 'bottom'
              : roomRight > BUBBLE_W + GAP ? 'right'
                : spot.top > 220 ? 'top' : 'bottom'

    if (side === 'right') { left = spot.left + spot.width + GAP; top = spot.top }
    else if (side === 'left') { left = spot.left - BUBBLE_W - GAP; top = spot.top }
    else if (side === 'top') { left = spot.left; top = spot.top - 230 }
    else { left = spot.left; top = spot.top + spot.height + GAP }

    left = Math.min(Math.max(GAP, left), vw - BUBBLE_W - GAP)
    top = Math.min(Math.max(GAP, top), vh - 230)
  }

  return (
    <div
      role="dialog"
      aria-label={title}
      style={{
        position: 'fixed', top, left, width: BUBBLE_W,
        background: 'var(--nx-panel)', border: `1px solid ${CYAN}`, borderRadius: 4,
        boxShadow: '0 18px 40px rgba(0,0,0,0.55)', padding: 20, pointerEvents: 'auto',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-label)' }}>
          <Compass size={13} /> {t('Visite guidée', 'Guided tour')}
        </span>
        <button onClick={onSkip} title={t('Fermer', 'Close')} style={{ color: 'var(--nx-text-muted)' }}>
          <X size={15} />
        </button>
      </div>

      <h3 className="mt-3" style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{title}</h3>
      <p className="mt-2" style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--nx-text-muted)' }}>{body}</p>

      {/* Progression */}
      <div className="mt-4 flex gap-1">
        {Array.from({ length: total }, (_, k) => (
          <span key={k} style={{ height: 2, flex: 1, borderRadius: 2, background: k <= index ? CYAN : 'var(--nx-border)' }} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={onSkip} style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
          {t('Passer la visite', 'Skip tour')}
        </button>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>{index + 1}/{total}</span>
          {index > 0 && (
            <button onClick={onPrev} className="flex items-center rounded-sm px-2 py-1.5"
              style={{ border: '1px solid var(--nx-border)', color: 'var(--nx-text-muted)' }} title={t('Précédent', 'Back')}>
              <ArrowLeft size={14} />
            </button>
          )}
          <button onClick={onNext} className="flex items-center gap-1.5 rounded-sm px-3 py-1.5"
            style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {last ? t('Terminer', 'Finish') : t('Suivant', 'Next')} <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
