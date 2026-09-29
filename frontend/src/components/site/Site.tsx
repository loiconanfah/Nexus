import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ChevronDown, Menu, Moon, Sun, X } from 'lucide-react'
import { useLang } from '../../lib/i18n'
import { Logo } from '../Logo'
import { reopenConsent } from '../CookieConsent'
import { SOCIAL, type Social } from '../../lib/social'
import { setSiteTheme, useSiteTheme } from '../../lib/site-theme'

/*
  Habillage commun du site vitrine (accueil public, blog, vidéos, solutions) :
  même palette sombre, même en-tête, même pied de page. Indépendant du thème
  de l'application.
*/

const mono = 'var(--font-mono)'

/** Bascule clair / sombre du site vitrine. */
function SiteThemeButton() {
  const { t } = useLang()
  const theme = useSiteTheme()
  const light = theme === 'light'
  return (
    <button
      onClick={() => setSiteTheme(light ? 'dark' : 'light')}
      className="flex h-[30px] w-[30px] items-center justify-center border"
      style={{ borderColor: 'var(--slb-line-2)', color: 'var(--slb-muted)' }}
      aria-label={light ? t('Passer en thème sombre', 'Switch to dark theme') : t('Passer en thème clair', 'Switch to light theme')}
      title={light ? t('Thème sombre', 'Dark theme') : t('Thème clair', 'Light theme')}>
      {light ? <Moon size={14} /> : <Sun size={14} />}
    </button>
  )
}

export const DARK_VARS: React.CSSProperties = {
  ['--nx-bg' as string]: 'var(--slb-bg)',
  ['--nx-panel' as string]: 'var(--slb-surface)',
  ['--nx-surface' as string]: 'var(--slb-surface)',
  ['--nx-surface-container' as string]: 'var(--slb-surface-2)',
  ['--nx-surface-high' as string]: 'var(--slb-surface-2)',
  ['--nx-surface-highest' as string]: 'var(--slb-line-2)',
  ['--nx-border' as string]: 'var(--slb-line-2)',
  ['--nx-outline' as string]: 'var(--slb-faint)',
  ['--nx-text' as string]: 'var(--slb-text)',
  ['--nx-text-muted' as string]: 'var(--slb-muted)',
  ['--nx-cyan' as string]: 'var(--slb-cyan)',
  ['--nx-cyan-text' as string]: 'var(--slb-cyan-text)',
  ['--nx-on-cyan' as string]: 'var(--slb-on-cyan)',
}

type T = (fr: string, en: string) => string

// ── Navigation ──────────────────────────────────────────────────────────────

type NavItem = { to: string; label: [string, string]; desc: [string, string] }
type NavGroup = { key: string; label: [string, string]; items: NavItem[] }

/** Une entrée commençant par « # » est une section de la page d'accueil. */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'product', label: ['Produit', 'Product'], items: [
      { to: '#probleme', label: ['Le problème', 'The problem'], desc: ['Pourquoi personne ne voit toute la chaîne', 'Why nobody sees the whole chain'] },
      { to: '#fonctionnement', label: ['Comment ça marche', 'How it works'], desc: ['Cartographier, révéler, simuler, chiffrer', 'Map, reveal, simulate, quantify'] },
      { to: '#minute', label: ['En une minute', 'In one minute'], desc: ['Une panne racontée de bout en bout', 'An outage told end to end'] },
      { to: '#connecteurs', label: ['Connecteurs', 'Connectors'], desc: ['Quinze sources lues et relues toutes seules', 'Fifteen sources read and re-read on their own'] },
      { to: '#produit', label: ['Visite du produit', 'Product tour'], desc: ['Les écrans, tels qu’ils sont', 'The screens, as they are'] },
      { to: '#plateforme', label: ['La plateforme', 'The platform'], desc: ['Moteurs, sécurité, intégrations', 'Engines, security, integrations'] },
    ],
  },
  {
    key: 'why', label: ['Pourquoi Lenexux', 'Why Lenexux'], items: [
      { to: '#difference', label: ['Ce qui nous distingue', 'What sets us apart'], desc: ['Face aux outils que vous avez déjà', 'Next to the tools you already have'] },
      { to: '#secteurs', label: ['Secteurs', 'Industries'], desc: ['Où la continuité se joue', 'Where continuity is at stake'] },
      { to: '#faq', label: ['Questions fréquentes', 'FAQ'], desc: ['Données, sécurité, déploiement', 'Data, security, deployment'] },
    ],
  },
  {
    key: 'resources', label: ['Ressources', 'Resources'], items: [
      { to: '/videos', label: ['Vidéos de démonstration', 'Demo videos'], desc: ['Le produit en action, fonction par fonction', 'The product in action, feature by feature'] },
      { to: '/blog', label: ['Blog', 'Blog'], desc: ['Méthodes et retours de terrain', 'Methods and field notes'] },
      { to: '/docs', label: ['Documentation', 'Documentation'], desc: ['Guides, API, sécurité', 'Guides, API, security'] },
    ],
  },
  {
    key: 'company', label: ['Entreprise', 'Company'], items: [
      { to: '/solutions', label: ['Solutions SplitsPay', 'SplitsPay solutions'], desc: ['L’éditeur et ses solutions', 'The publisher and its solutions'] },
      { to: '#demarrer', label: ['Démarrer', 'Get started'], desc: ['Du premier import au pilote', 'From first import to pilot'] },
      { to: '/legal?doc=terms', label: ['Mentions légales', 'Legal'], desc: ['Conditions, confidentialité, DPA', 'Terms, privacy, DPA'] },
    ],
  },
]

/** Suit un lien du site : section de l'accueil (même page ou non) ou page. */
function useGo() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (to: string) => {
    if (to.startsWith('#')) {
      if (pathname === '/welcome') document.getElementById(to.slice(1))?.scrollIntoView({ behavior: 'smooth' })
      else navigate(`/welcome${to}`)
    } else navigate(to)
  }
}

export function SiteHeader() {
  // Le logotype est encré en blanc sur fond sombre : en thème clair il
  // disparaîtrait purement et simplement.
  const siteTheme = useSiteTheme()
  const { lang, setLang, t } = useLang()
  const navigate = useNavigate()
  const go = useGo()
  const { pathname } = useLocation()
  const [open, setOpen] = useState<string | null>(null)
  const [mobile, setMobile] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => { setOpen(null); setMobile(false) }, [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setMobile(false) } }
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [])

  const activeGroup = NAV_GROUPS.find((g) => g.items.some((i) => !i.to.startsWith('#') && pathname.startsWith(i.to.split('?')[0])))?.key

  return (
    <header className="slb-nav" ref={ref}>
      <a href="/welcome" onClick={(e) => { e.preventDefault(); navigate('/welcome') }} aria-label={t('Lenexux, accueil', 'Lenexux, home')} className="flex items-center">
        <Logo size={34} variant={siteTheme === 'light' ? 'light' : 'dark'} wordSize={20} />
      </a>

      <nav className="slb-nav-links" aria-label={t('Navigation principale', 'Main navigation')}>
        {NAV_GROUPS.map((g) => (
          <div key={g.key} className="slb-dd" onMouseEnter={() => setOpen(g.key)} onMouseLeave={() => setOpen((o) => (o === g.key ? null : o))}>
            <button className="slb-dd-trigger" aria-expanded={open === g.key} aria-haspopup="true"
              // Au survol le menu est déjà ouvert : le clic (ou le toucher) l'ouvre, sans le refermer.
              onClick={() => setOpen(g.key)} onFocus={() => setOpen(g.key)}
              style={{ color: activeGroup === g.key ? 'var(--slb-text)' : undefined }}>
              {t(...g.label)} <ChevronDown size={13} className="slb-dd-chev" />
            </button>
            {open === g.key && (
              <div className="slb-dd-panel" role="menu">
                {g.items.map((i) => (
                  <a key={i.to} role="menuitem" href={i.to.startsWith('#') ? `/welcome${i.to}` : i.to}
                    onClick={(e) => { e.preventDefault(); setOpen(null); go(i.to) }} className="slb-dd-item">
                    <span className="slb-dd-title">{t(...i.label)}</span>
                    <span className="slb-dd-desc">{t(...i.desc)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <div className="flex items-center border" style={{ borderColor: 'var(--slb-line-2)' }}>
          {(['fr', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className="px-2 py-1"
              style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: lang === l ? 'var(--slb-on-cyan)' : 'var(--slb-muted)', background: lang === l ? 'var(--slb-cyan)' : 'transparent' }}>{l}</button>
          ))}
        </div>
        <SiteThemeButton />
        <span className="hidden sm:inline-flex"><BoxBtn onClick={() => navigate('/demo')} label={t('Démo', 'Demo')} small /></span>
        <span className="hidden sm:inline-flex"><BoxBtn onClick={() => navigate('/login')} label={t('Se connecter', 'Sign in')} small primary /></span>
        <button className="slb-burger" aria-label={t('Menu', 'Menu')} aria-expanded={mobile} onClick={() => setMobile((o) => !o)}>
          {mobile ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobile && (
        <div className="slb-mobile-menu">
          {NAV_GROUPS.map((g) => (
            <div key={g.key} className="slb-mobile-group">
              <div className="slb-mobile-head">{t(...g.label)}</div>
              {g.items.map((i) => (
                <a key={i.to} href={i.to.startsWith('#') ? `/welcome${i.to}` : i.to} onClick={(e) => { e.preventDefault(); setMobile(false); go(i.to) }}>{t(...i.label)}</a>
              ))}
            </div>
          ))}
          <a href="/demo" onClick={(e) => { e.preventDefault(); navigate('/demo') }} style={{ color: 'var(--slb-cyan-text)' }}>{t('Explorer la démo', 'Explore the demo')}</a>
          <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login') }} style={{ color: 'var(--slb-cyan-text)' }}>{t('Se connecter', 'Sign in')}</a>
        </div>
      )}
    </header>
  )
}

export function SiteFooter() {
  const siteTheme = useSiteTheme()
  const { t } = useLang()
  const navigate = useNavigate()
  const go = useGo()
  const link = (to: string, label: string) => (
    <a key={to} href={to.startsWith('#') ? `/welcome${to}` : to} onClick={(e) => { e.preventDefault(); go(to) }} className="slb-foot-link">{label}</a>
  )
  return (
    <footer className="border-t px-6 pb-10 pt-14" style={{ borderColor: 'var(--slb-line)', background: 'var(--slb-bg)' }}>
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo size={26} variant={siteTheme === 'light' ? 'light' : 'dark'} wordSize={16} />
          <p style={{ fontSize: 13, color: 'var(--slb-muted)', lineHeight: 1.6, maxWidth: 280 }}>
            {t('L’intelligence des dépendances et de l’impact opérationnel. Une solution SplitsPay Inc.', 'Dependency and operational impact intelligence. A SplitsPay Inc. solution.')}
          </p>
          <SocialLinks />
          <button onClick={() => navigate('/login')} className="flex w-fit items-center gap-1" style={{ fontFamily: mono, fontSize: 11, color: 'var(--slb-cyan-text)' }}>
            {t('Se connecter', 'Sign in')} <ArrowUpRight size={13} />
          </button>
        </div>
        {NAV_GROUPS.map((g) => (
          <div key={g.key} className="flex flex-col gap-2">
            <div className="slb-foot-head">{t(...g.label)}</div>
            {g.items.map((i) => link(i.to, t(...i.label)))}
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t pt-6" style={{ borderColor: 'var(--slb-surface-2)', fontFamily: mono, fontSize: 11, color: 'var(--slb-faint)' }}>
        <span>© {new Date().getFullYear()} SplitsPay Inc.</span>
        <div className="flex flex-wrap gap-4">
          {link('/legal?doc=terms', t('Conditions', 'Terms'))}
          {link('/legal?doc=privacy', t('Confidentialité', 'Privacy'))}
          {link('/legal?doc=dpa', 'DPA')}
          <button onClick={reopenConsent} className="slb-foot-link">{t('Témoins', 'Cookies')}</button>
        </div>
      </div>
    </footer>
  )
}

/** Liens vers les réseaux (source : lib/social.ts). */
export function SocialLinks() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SOCIAL.map((s) => (
        <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer me" aria-label={s.label} title={s.label} className="slb-social">
          <SocialIcon s={s} />
        </a>
      ))}
    </div>
  )
}

function SocialIcon({ s }: { s: Social }) {
  if (s.key === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden fill="currentColor">
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
      </svg>
    )
  }
  return <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, letterSpacing: '.02em' }}>{s.key === 'medium' ? 'M' : s.label}</span>
}

/** Page du site vitrine : habillage, en-tête et pied de page communs. */
export function SitePage({ children }: { children: ReactNode }) {
  const theme = useSiteTheme()
  return (
    <div className="slb h-full overflow-y-auto" data-site-theme={theme}
      style={{ ...DARK_VARS, background: 'var(--slb-bg)', color: 'var(--slb-text)', fontFamily: 'var(--font-inter)' }}>
      <style>{SILBER_CSS}</style>
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  )
}

/** En-tête de page intérieure (blog, vidéos, solutions). */
export function PageHero({ eyebrow, title, sub, t, children }: { eyebrow: string; title: string; sub?: string; t?: T; children?: ReactNode }) {
  void t
  return (
    <section className="relative overflow-hidden border-b px-6 pb-14 pt-16 md:pt-24" style={{ borderColor: 'var(--slb-line)' }}>
      <div className="slb-light slb-light-soft" aria-hidden><span className="slb-silk slb-silk-2" /></div>
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="slb-h2" style={{ marginTop: 0, fontFamily: 'var(--font-geist)', maxWidth: '24ch' }}>{title}</h1>
        {sub && <p className="slb-sub">{sub}</p>}
        {children}
      </div>
    </section>
  )
}

// ── Primitives ──────────────────────────────────────────────────────────────

export function BoxBtn({ label, onClick, primary, small, icon }: { label: string; onClick?: () => void; primary?: boolean; small?: boolean; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`slb-btn ${primary ? 'slb-btn-primary' : ''} ${small ? 'slb-btn-sm' : ''}`}>
      <span className="slb-btn-label">{icon}{label}</span>
      <span className="slb-btn-arrow"><ArrowRight size={small ? 13 : 15} /></span>
    </button>
  )
}
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="slb-eyebrow"><span className="slb-eyebrow-mark">▸</span>{children}</div>
}

// ── CSS bespoke (style Silber AI) ─────────────────────────────────────────────
export const SILBER_CSS = `
/*
  La palette du site vitrine. Sombre par defaut, claire sur demande du visiteur.

  Les deux jeux portent les MEMES noms : aucun ecran n'a donc a connaitre le
  theme, et une couleur oubliee se voit tout de suite au lieu de se fondre dans
  le decor. Le cyan de la marque ne change pas, seule sa declinaison lisible sur
  fond clair est assombrie, sans quoi elle disparaitrait sur du blanc.
*/
.slb {
  --slb-bg: #050506;
  --slb-surface: #0c0c12;
  --slb-surface-2: #16161d;
  --slb-line: #1c1c22;
  --slb-line-2: #2a2a33;
  --slb-text: #f3f3f6;
  --slb-text-2: #c8c8d2;
  --slb-text-3: #b4b4c0;
  --slb-muted: #a2a2b0;
  --slb-faint: #6b6b78;
  --slb-cyan: #22d3ee;
  --slb-cyan-text: #7fe8f7;
  --slb-cyan-deep: #0aa5bd;
  --slb-on-cyan: #070714;
  --slb-red: #d15b54;
  --slb-amber: #e0a458;
  --slb-amber-soft: #f5d76e;
  --slb-violet: #8a6bff;
  --slb-violet-soft: #c4b5ff;
  --slb-nav-bg: rgba(5,5,6,.78);
  --slb-veil: rgba(255,255,255,.035);
  --slb-shadow: rgba(0,0,0,.5);
}
.slb[data-site-theme="light"] {
  --slb-bg: #ffffff;
  --slb-surface: #f7f8fb;
  --slb-surface-2: #eceef4;
  --slb-line: #e4e6ec;
  --slb-line-2: #d0d3dd;
  --slb-text: #0f1014;
  --slb-text-2: #33343e;
  --slb-text-3: #454650;
  --slb-muted: #5c5e6b;
  --slb-faint: #7b7d8b;
  --slb-cyan: #22d3ee;
  --slb-cyan-text: #0c7086;
  --slb-cyan-deep: #0aa5bd;
  --slb-on-cyan: #04252e;
  --slb-red: #b23a32;
  --slb-amber: #96620f;
  --slb-amber-soft: #7d5a12;
  --slb-violet: #6b4ad6;
  --slb-violet-soft: #5a3cc0;
  --slb-nav-bg: rgba(255,255,255,.85);
  --slb-veil: rgba(0,0,0,.03);
  --slb-shadow: rgba(15,16,20,.14);
}
.slb { scroll-behavior: smooth; }
.slb a { color: inherit; }

.slb-nav { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; gap: 12px; background: var(--slb-nav-bg); backdrop-filter: blur(10px); border-bottom: 1px solid var(--slb-line); }
@media (min-width: 640px) { .slb-nav { padding: 16px 24px; gap: 16px; } }
.slb { overflow-x: hidden; }
.slb-nav-links { display: none; gap: 6px; font-size: 13.5px; color: var(--slb-text-2); }
@media (min-width: 980px) { .slb-nav-links { display: flex; } }
.slb-dd { position: relative; }
.slb-dd-trigger { display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; color: var(--slb-text-2); border-radius: 6px; }
.slb-dd-trigger:hover, .slb-dd-trigger[aria-expanded="true"] { color: var(--slb-text); background: var(--slb-surface-2); }
.slb-dd-trigger[aria-expanded="true"] .slb-dd-chev { transform: rotate(180deg); }
.slb-dd-chev { transition: transform .15s ease; opacity: .7; }
.slb-dd-panel { position: absolute; top: 100%; left: 0; margin-top: 6px; min-width: 300px; padding: 8px; display: flex; flex-direction: column;
  background: var(--slb-surface); border: 1px solid var(--slb-line-2); border-radius: 10px; box-shadow: 0 18px 40px var(--slb-shadow); }
.slb-dd-panel::before { content: ""; position: absolute; left: 0; right: 0; top: -8px; height: 8px; }
.slb-dd-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 7px; }
.slb-dd-item:hover { background: var(--slb-surface-2); }
.slb-dd-title { font-size: 14px; color: var(--slb-text); font-weight: 500; }
.slb-dd-desc { font-size: 12.5px; color: var(--slb-muted); }
.slb-burger { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid var(--slb-line-2); color: var(--slb-text-2); }
@media (min-width: 980px) { .slb-burger { display: none; } }
.slb-mobile-menu { position: absolute; top: 100%; left: 0; right: 0; display: flex; flex-direction: column; padding: 8px 20px 18px; max-height: 80vh; overflow-y: auto;
  background: var(--slb-surface); border-bottom: 1px solid var(--slb-line-2); box-shadow: 0 12px 24px var(--slb-shadow); }
.slb-mobile-group { display: flex; flex-direction: column; padding: 8px 0; border-bottom: 1px solid var(--slb-surface-2); }
.slb-mobile-head { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--slb-faint); padding: 6px 2px; }
.slb-mobile-menu a { padding: 9px 2px; font-size: 15px; color: var(--slb-text-2); }
.slb-mobile-menu a:hover { color: var(--slb-text); }
@media (min-width: 980px) { .slb-mobile-menu { display: none; } }

.slb-foot-head { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--slb-faint); margin-bottom: 4px; }
.slb-foot-link { font-size: 13px; color: var(--slb-muted); text-align: left; }
.slb-foot-link:hover { color: var(--slb-text); }
.slb-social { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; padding: 0 8px; border: 1px solid var(--slb-line-2); color: var(--slb-text-3); transition: color .15s, border-color .15s; }
.slb-social:hover { color: var(--slb-text); border-color: var(--slb-line-2); }

/* Boutons encadres a deux parties (label | fleche) facon Silber */
.slb-btn { display: inline-flex; align-items: stretch; border: 1px solid var(--slb-line-2); background: var(--slb-surface); color: var(--slb-text); }
.slb-btn-label { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; font-family: var(--font-mono); font-size: 12.5px; letter-spacing: .04em; text-transform: uppercase; }
.slb-btn-arrow { display: inline-flex; align-items: center; padding: 0 12px; border-left: 1px solid var(--slb-line-2); color: var(--slb-cyan-text); transition: background .16s; }
.slb-btn:hover .slb-btn-arrow { background: var(--slb-surface-2); }
.slb-btn-primary { background: var(--slb-cyan); border-color: var(--slb-cyan); color: var(--slb-on-cyan); }
.slb-btn-primary .slb-btn-arrow { border-left-color: rgba(7,7,20,.25); color: var(--slb-on-cyan); }
.slb-btn-primary:hover .slb-btn-arrow { background: rgba(7,7,20,.12); }
.slb-btn-sm .slb-btn-label { padding: 8px 12px; font-size: 11px; }
.slb-btn-sm .slb-btn-arrow { padding: 0 8px; }

/* Eyebrow encadre */
.slb-eyebrow { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; border: 1px solid var(--slb-line-2);
  padding: 6px 12px; font-family: var(--font-mono); font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--slb-text-3); margin-bottom: 26px; }
.slb-eyebrow-mark { color: var(--slb-violet); }

/* Label de section */
.slb-label { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--slb-line-2); padding: 5px 11px;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--slb-cyan-text); }

.slb-h1 { font-weight: 600; letter-spacing: -.03em; line-height: 1.02; color: var(--slb-text); font-size: clamp(2.6rem, 7.4vw, 6.4rem); }
.slb-accent { background: linear-gradient(100deg, var(--slb-cyan) 0%, var(--slb-cyan-deep) 60%, var(--slb-cyan-text) 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.slb-h2 { margin-top: 20px; font-weight: 600; letter-spacing: -.02em; line-height: 1.06; color: var(--slb-text); font-size: clamp(1.9rem, 3.6vw, 3.2rem); max-width: 22ch; }
.slb-sub { max-width: 620px; margin-top: 26px; font-size: clamp(1rem, 1.3vw, 1.18rem); line-height: 1.6; color: var(--slb-muted); }

/* HERO */
.slb-hero { position: relative; overflow: hidden; min-height: 92vh; display: flex; align-items: center; background: var(--slb-bg); }
.slb-hero-inner { position: relative; z-index: 10; width: 100%; max-width: 1180px; margin: 0 auto; padding: 40px 24px; display: flex; flex-direction: column; }
.slb-grid { position: absolute; inset: 0; z-index: 1;
  background-image: linear-gradient(90deg, var(--slb-veil) 1px, transparent 1px); background-size: 12.5% 100%;
  mask-image: linear-gradient(180deg, #000 0%, transparent 85%); }

/* Vague de lumiere liquide bleu/violet */
.slb-light { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
.slb-silk { position: absolute; border-radius: 50%; filter: blur(80px); mix-blend-mode: screen; will-change: transform; opacity: .8; }
.slb-silk-1 { width: 120vw; height: 60vh; left: -10vw; bottom: -22vh;
  background: linear-gradient(120deg, rgba(34,211,238,0) 8%, rgba(34,211,238,.5) 38%, rgba(10,165,189,.6) 62%, rgba(34,211,238,0) 92%);
  transform: rotate(-8deg); animation: slbSilk1 20s ease-in-out infinite; }
.slb-silk-2 { width: 90vw; height: 50vh; right: -12vw; bottom: -10vh;
  background: radial-gradient(closest-side, rgba(34,211,238,.42), rgba(34,211,238,0) 72%); animation: slbSilk2 16s ease-in-out infinite; }
.slb-silk-3 { width: 70vw; height: 40vh; left: 30vw; bottom: -18vh;
  background: linear-gradient(80deg, rgba(127,232,247,0) 12%, rgba(34,211,238,.4) 50%, rgba(127,232,247,0) 88%); animation: slbSilk3 24s ease-in-out infinite; }
@keyframes slbSilk1 { 0%,100% { transform: translate(0,0) rotate(-8deg) scale(1); } 50% { transform: translate(4%,-4%) rotate(-4deg) scale(1.12); } }
@keyframes slbSilk2 { 0%,100% { transform: translate(0,0) scale(1); opacity:.7; } 50% { transform: translate(-6%,-3%) scale(1.18); opacity:.9; } }
@keyframes slbSilk3 { 0%,100% { transform: translate(0,0) scale(1.05); } 50% { transform: translate(6%,-5%) scale(1.2); } }
.slb-light-soft .slb-silk { opacity: .45; }

/* Cartes numerotees */
.slb-numcard { background: var(--slb-bg); padding: 34px 26px; }
.slb-numcard-tag { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--slb-faint); }
.slb-numcard-n { font-size: 46px; font-weight: 300; color: var(--slb-line-2); line-height: 1; }

/* Cellule (persona) */
.slb-cell { background: var(--slb-bg); padding: 30px 24px; }

/* Onglets de la galerie produit */
.slb-shot-tab { border: 1px solid; padding: 7px 14px; font-family: var(--font-mono); font-size: 11.5px;
  letter-spacing: .04em; text-transform: uppercase; transition: border-color .15s, color .15s; }
.slb-shot-tab[aria-pressed="false"]:hover { border-color: var(--slb-line-2); color: var(--slb-text); }

/* Chips */
.slb-chip { border: 1px solid var(--slb-line-2); padding: 6px 12px; font-family: var(--font-mono); font-size: 11.5px; color: var(--slb-text-3); }

/* STAT */
.slb-stat { position: relative; overflow: hidden; padding: 120px 0; background: var(--slb-bg); }
.slb-stat-num { margin-top: 14px; font-weight: 600; letter-spacing: -.03em; line-height: 1; font-size: clamp(3.4rem, 9vw, 8rem);
  background: linear-gradient(100deg, var(--slb-cyan), var(--slb-cyan-deep) 55%, var(--slb-cyan-text)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

/* CTA */
.slb-cta { position: relative; overflow: hidden; padding: 130px 0; background: var(--slb-bg); border-top: 1px solid var(--slb-line); }

.slb-faq summary::-webkit-details-marker { display: none; }
.slb-faq[open] .slb-faq-chev { transform: rotate(180deg); }
.slb-faq-chev { transition: transform .2s ease; }

/* Cartes de contenu (blog, vidéos, solutions) */
.slb-card { display: flex; flex-direction: column; border: 1px solid var(--slb-surface-2); background: var(--slb-surface); transition: border-color .15s, transform .15s; }
.slb-card:hover { border-color: var(--slb-line-2); }
.slb-card-link:hover { transform: translateY(-2px); }

/* Article */
.slb-prose { max-width: 720px; margin: 0 auto; font-size: 17px; line-height: 1.75; color: var(--slb-text-2); }
.slb-prose h2 { margin: 2.2em 0 .6em; font-family: var(--font-geist); font-size: 1.55rem; font-weight: 600; letter-spacing: -.01em; color: var(--slb-text); }
.slb-prose p { margin: 0 0 1.15em; }
.slb-prose ul { margin: 0 0 1.2em; padding-left: 1.2em; list-style: disc; }
.slb-prose li { margin: .35em 0; }
.slb-prose strong { color: var(--slb-text); }
.slb-prose blockquote { margin: 1.6em 0; padding: 4px 0 4px 18px; border-left: 2px solid var(--slb-cyan); color: var(--slb-text-2); font-size: 1.1em; }

@media (prefers-reduced-motion: reduce) { .slb-silk { animation: none; } }
`
