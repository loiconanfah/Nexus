import { useEffect, useState } from 'react'
import { Cookie } from 'lucide-react'
import { useLang } from '../lib/i18n'

/**
 * Consentement aux témoins de mesure d'audience — Loi 25 (Québec) et RGPD.
 *
 * Le parti pris est le plus strict, et le seul réellement défendable : Google
 * Analytics n'est PAS chargé tant que rien n'a été accepté. Le « Consent Mode »
 * de Google, qui charge le script en mode dégradé avant le choix, reste
 * contesté par les autorités européennes ; ici le script n'existe simplement
 * pas dans la page tant que le visiteur n'a pas dit oui.
 *
 * Conséquences voulues :
 * - refuser est aussi simple qu'accepter (deux boutons de même poids) ;
 * - l'absence de choix vaut refus, et rien n'est déposé ;
 * - le choix est révocable à tout moment (lien « Témoins » du pied de page).
 */

const KEY = 'nexus.consent.analytics'
const GA_ID = 'G-DZ515V72NY'
const mono = 'var(--font-mono)'

type Choice = 'granted' | 'denied' | null

function readChoice(): Choice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch { return null }
}

/** Charge la mesure d'audience — appelé UNIQUEMENT après un consentement. */
function loadAnalytics() {
  if (document.getElementById('ga4-script')) return
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }
  w.dataLayer = w.dataLayer || []
  w.gtag = function gtag() { w.dataLayer!.push(arguments) }

  const s = document.createElement('script')
  s.id = 'ga4-script'
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)

  w.gtag('js', new Date())
  // Pas de signaux publicitaires : la mesure sert à comprendre l'audience du
  // site vitrine, pas à constituer des profils.
  w.gtag('config', GA_ID, { anonymize_ip: true, allow_google_signals: false })
}

/** Retire les témoins déposés par Google Analytics. */
function clearAnalyticsCookies() {
  const host = location.hostname
  const domains = [host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim()
    if (!/^(_ga|_gid|_gat)/.test(name)) continue
    for (const d of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${d}`
    }
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  }
}

/** Rouvre la bannière pour changer d'avis (pied de page, page Mentions). */
export function reopenConsent() {
  window.dispatchEvent(new CustomEvent('nexus:consent:open'))
}

export function CookieConsent() {
  const { t } = useLang()
  const [choice, setChoice] = useState<Choice>(() => readChoice())
  const [open, setOpen] = useState(false)

  // Un consentement déjà donné lors d'une visite précédente réactive la mesure.
  useEffect(() => {
    if (choice === 'granted') loadAnalytics()
    if (choice === null) setOpen(true)
  }, [choice])

  useEffect(() => {
    function onOpen() { setOpen(true) }
    window.addEventListener('nexus:consent:open', onOpen)
    return () => window.removeEventListener('nexus:consent:open', onOpen)
  }, [])

  function decide(next: Exclude<Choice, null>) {
    try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
    setChoice(next)
    setOpen(false)
    if (next === 'granted') loadAnalytics()
    else clearAnalyticsCookies()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('Consentement aux témoins', 'Cookie consent')}
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 10000,
        maxWidth: 560, marginLeft: 'auto', marginRight: 'auto',
        background: '#0d0d11', border: '1px solid #2a2a33', borderRadius: 4,
        boxShadow: '0 18px 40px rgba(0,0,0,0.55)', padding: 18, color: '#f3f3f6',
      }}
    >
      <div className="flex items-center gap-2">
        <Cookie size={15} style={{ color: 'var(--nx-cyan)' }} />
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-cyan-text)' }}>
          {t('Témoins de mesure d’audience', 'Analytics cookies')}
        </span>
      </div>

      <p className="mt-3" style={{ fontSize: 13.5, lineHeight: 1.6, color: '#c8c8d2' }}>
        {t('Nous aimerions mesurer la fréquentation de ce site avec Google Analytics, pour savoir ce qui est lu. Rien n’est déposé tant que vous n’avez pas accepté, et refuser ne change rien à votre navigation.',
           'We would like to measure traffic on this site with Google Analytics, to learn what gets read. Nothing is stored until you accept, and declining changes nothing about your browsing.')}
      </p>
      <p className="mt-2" style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--nx-text-muted)' }}>
        {t('Les témoins strictement nécessaires au fonctionnement — votre session, votre langue — ne sont pas concernés : ils ne servent pas à vous suivre.',
           'Strictly necessary storage — your session, your language — is not covered: it is not used to track you.')}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {/* Refuser est présenté avec le même poids qu'accepter : c'est une
            exigence de la Loi 25 comme du RGPD, pas une préférence de style. */}
        <button onClick={() => decide('denied')} style={btn(false)}>{t('Refuser', 'Decline')}</button>
        <button onClick={() => decide('granted')} style={btn(true)}>{t('Accepter', 'Accept')}</button>
        <a href="/legal?doc=privacy"
          style={{ alignSelf: 'center', marginLeft: 4, fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>
          {t('Politique de confidentialité', 'Privacy policy')}
        </a>
      </div>
    </div>
  )
}

/**
 * Les deux boutons ont la MÊME saillance : même taille, même place, même
 * bordure, même contraste. Un « Accepter » plein et coloré face à un « Refuser »
 * grisé constitue un design trompeur au sens de la Loi 25 comme du RGPD — le
 * refus doit être aussi facile et aussi visible que l'acceptation.
 */
function btn(_accept: boolean): React.CSSProperties {
  return {
    flex: '1 1 140px',
    padding: '10px 18px',
    fontFamily: mono, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase',
    border: '1px solid var(--nx-cyan)',
    background: 'color-mix(in srgb, var(--nx-cyan) 10%, transparent)',
    color: 'var(--nx-cyan-text)',
    borderRadius: 3,
  }
}
