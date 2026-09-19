import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ChevronDown, Menu, X } from 'lucide-react'
import { useLang } from '../../lib/i18n'
import { Logo } from '../Logo'
import { reopenConsent } from '../CookieConsent'

/*
  Habillage commun du site vitrine (accueil public, blog, vidéos, solutions) :
  même palette sombre, même en-tête, même pied de page. Indépendant du thème
  de l'application.
*/

const mono = 'var(--font-mono)'

export const DARK_VARS: React.CSSProperties = {
  ['--nx-bg' as string]: '#050506',
  ['--nx-panel' as string]: '#0d0d11',
  ['--nx-surface' as string]: '#0a0a0d',
  ['--nx-surface-container' as string]: '#121216',
  ['--nx-surface-high' as string]: '#1b1b21',
  ['--nx-surface-highest' as string]: '#26262e',
  ['--nx-border' as string]: '#26262e',
  ['--nx-outline' as string]: '#6b6b78',
  ['--nx-text' as string]: '#f3f3f6',
  ['--nx-text-muted' as string]: '#a2a2b0',
  ['--nx-cyan' as string]: '#22d3ee',
  ['--nx-cyan-text' as string]: '#7fe8f7',
  ['--nx-on-cyan' as string]: '#070714',
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
      <a href="/welcome" onClick={(e) => { e.preventDefault(); navigate('/welcome') }} aria-label={t('Lenexux — accueil', 'Lenexux — home')} className="flex items-center">
        <Logo size={34} variant="dark" wordSize={20} />
      </a>

      <nav className="slb-nav-links" aria-label={t('Navigation principale', 'Main navigation')}>
        {NAV_GROUPS.map((g) => (
          <div key={g.key} className="slb-dd" onMouseEnter={() => setOpen(g.key)} onMouseLeave={() => setOpen((o) => (o === g.key ? null : o))}>
            <button className="slb-dd-trigger" aria-expanded={open === g.key} aria-haspopup="true"
              // Au survol le menu est déjà ouvert : le clic (ou le toucher) l'ouvre, sans le refermer.
              onClick={() => setOpen(g.key)} onFocus={() => setOpen(g.key)}
              style={{ color: activeGroup === g.key ? '#fff' : undefined }}>
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
        <div className="flex items-center border" style={{ borderColor: '#2a2a33' }}>
          {(['fr', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className="px-2 py-1"
              style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: lang === l ? '#070714' : '#a2a2b0', background: lang === l ? '#22d3ee' : 'transparent' }}>{l}</button>
          ))}
        </div>
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
          <a href="/demo" onClick={(e) => { e.preventDefault(); navigate('/demo') }} style={{ color: '#7fe8f7' }}>{t('Explorer la démo', 'Explore the demo')}</a>
          <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login') }} style={{ color: '#7fe8f7' }}>{t('Se connecter', 'Sign in')}</a>
        </div>
      )}
    </header>
  )
}

export function SiteFooter() {
  const { t } = useLang()
  const navigate = useNavigate()
  const go = useGo()
  const link = (to: string, label: string) => (
    <a key={to} href={to.startsWith('#') ? `/welcome${to}` : to} onClick={(e) => { e.preventDefault(); go(to) }} className="slb-foot-link">{label}</a>
  )
  return (
    <footer className="border-t px-6 pb-10 pt-14" style={{ borderColor: '#1c1c22', background: '#050506' }}>
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo size={26} variant="dark" wordSize={16} />
          <p style={{ fontSize: 13, color: '#8a8a98', lineHeight: 1.6, maxWidth: 280 }}>
            {t('L’intelligence des dépendances et de l’impact opérationnel. Une solution SplitsPay Inc.', 'Dependency and operational impact intelligence. A SplitsPay Inc. solution.')}
          </p>
          <button onClick={() => navigate('/login')} className="flex w-fit items-center gap-1" style={{ fontFamily: mono, fontSize: 11, color: '#7fe8f7' }}>
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
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t pt-6" style={{ borderColor: '#17171f', fontFamily: mono, fontSize: 11, color: '#6b6b78' }}>
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

/** Page du site vitrine : habillage, en-tête et pied de page communs. */
export function SitePage({ children }: { children: ReactNode }) {
  return (
    <div className="slb h-full overflow-y-auto" style={{ ...DARK_VARS, background: '#050506', color: '#f3f3f6', fontFamily: 'var(--font-inter)' }}>
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
    <section className="relative overflow-hidden border-b px-6 pb-14 pt-16 md:pt-24" style={{ borderColor: '#14141a' }}>
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
.slb { scroll-behavior: smooth; }
.slb a { color: inherit; }

.slb-nav { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; gap: 12px; background: rgba(5,5,6,.78); backdrop-filter: blur(10px); border-bottom: 1px solid #14141a; }
@media (min-width: 640px) { .slb-nav { padding: 16px 24px; gap: 16px; } }
.slb { overflow-x: hidden; }
.slb-nav-links { display: none; gap: 6px; font-size: 13.5px; color: #c8c8d2; }
@media (min-width: 980px) { .slb-nav-links { display: flex; } }
.slb-dd { position: relative; }
.slb-dd-trigger { display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; color: #c8c8d2; border-radius: 6px; }
.slb-dd-trigger:hover, .slb-dd-trigger[aria-expanded="true"] { color: #fff; background: #111118; }
.slb-dd-trigger[aria-expanded="true"] .slb-dd-chev { transform: rotate(180deg); }
.slb-dd-chev { transition: transform .15s ease; opacity: .7; }
.slb-dd-panel { position: absolute; top: 100%; left: 0; margin-top: 6px; min-width: 300px; padding: 8px; display: flex; flex-direction: column;
  background: #0c0c12; border: 1px solid #23232c; border-radius: 10px; box-shadow: 0 18px 40px rgba(0,0,0,.5); }
.slb-dd-panel::before { content: ""; position: absolute; left: 0; right: 0; top: -8px; height: 8px; }
.slb-dd-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 7px; }
.slb-dd-item:hover { background: #15151d; }
.slb-dd-title { font-size: 14px; color: #f3f3f6; font-weight: 500; }
.slb-dd-desc { font-size: 12.5px; color: #8a8a98; }
.slb-burger { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid #2a2a33; color: #c8c8d2; }
@media (min-width: 980px) { .slb-burger { display: none; } }
.slb-mobile-menu { position: absolute; top: 100%; left: 0; right: 0; display: flex; flex-direction: column; padding: 8px 20px 18px; max-height: 80vh; overflow-y: auto;
  background: #0b0b12; border-bottom: 1px solid #2a2a33; box-shadow: 0 12px 24px rgba(0,0,0,0.4); }
.slb-mobile-group { display: flex; flex-direction: column; padding: 8px 0; border-bottom: 1px solid #17171f; }
.slb-mobile-head { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: #6b6b78; padding: 6px 2px; }
.slb-mobile-menu a { padding: 9px 2px; font-size: 15px; color: #d5d5df; }
.slb-mobile-menu a:hover { color: #fff; }
@media (min-width: 980px) { .slb-mobile-menu { display: none; } }

.slb-foot-head { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: #6b6b78; margin-bottom: 4px; }
.slb-foot-link { font-size: 13px; color: #a2a2b0; text-align: left; }
.slb-foot-link:hover { color: #fff; }

/* Boutons encadres a deux parties (label | fleche) facon Silber */
.slb-btn { display: inline-flex; align-items: stretch; border: 1px solid #2e2e38; background: #0f0f14; color: #f3f3f6; }
.slb-btn-label { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; font-family: var(--font-mono); font-size: 12.5px; letter-spacing: .04em; text-transform: uppercase; }
.slb-btn-arrow { display: inline-flex; align-items: center; padding: 0 12px; border-left: 1px solid #2e2e38; color: #7fe8f7; transition: background .16s; }
.slb-btn:hover .slb-btn-arrow { background: #17171f; }
.slb-btn-primary { background: #22d3ee; border-color: #22d3ee; color: #070714; }
.slb-btn-primary .slb-btn-arrow { border-left-color: rgba(7,7,20,.25); color: #070714; }
.slb-btn-primary:hover .slb-btn-arrow { background: rgba(7,7,20,.12); }
.slb-btn-sm .slb-btn-label { padding: 8px 12px; font-size: 11px; }
.slb-btn-sm .slb-btn-arrow { padding: 0 8px; }

/* Eyebrow encadre */
.slb-eyebrow { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; border: 1px solid #2a2a33;
  padding: 6px 12px; font-family: var(--font-mono); font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: #b9b9c6; margin-bottom: 26px; }
.slb-eyebrow-mark { color: #8a6bff; }

/* Label de section */
.slb-label { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #2a2a33; padding: 5px 11px;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #7fe8f7; }

.slb-h1 { font-weight: 600; letter-spacing: -.03em; line-height: 1.02; color: #fbfbfe; font-size: clamp(2.6rem, 7.4vw, 6.4rem); }
.slb-accent { background: linear-gradient(100deg, #22d3ee 0%, #0aa5bd 60%, #7fe8f7 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.slb-h2 { margin-top: 20px; font-weight: 600; letter-spacing: -.02em; line-height: 1.06; color: #f7f7fb; font-size: clamp(1.9rem, 3.6vw, 3.2rem); max-width: 22ch; }
.slb-sub { max-width: 620px; margin-top: 26px; font-size: clamp(1rem, 1.3vw, 1.18rem); line-height: 1.6; color: #a2a2b0; }

/* HERO */
.slb-hero { position: relative; overflow: hidden; min-height: 92vh; display: flex; align-items: center; background: #050506; }
.slb-hero-inner { position: relative; z-index: 10; width: 100%; max-width: 1180px; margin: 0 auto; padding: 40px 24px; display: flex; flex-direction: column; }
.slb-grid { position: absolute; inset: 0; z-index: 1;
  background-image: linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 12.5% 100%;
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
.slb-numcard { background: #050506; padding: 34px 26px; }
.slb-numcard-tag { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #6b6b78; }
.slb-numcard-n { font-size: 46px; font-weight: 300; color: #2f2f3a; line-height: 1; }

/* Cellule (persona) */
.slb-cell { background: #050506; padding: 30px 24px; }

/* Onglets de la galerie produit */
.slb-shot-tab { border: 1px solid; padding: 7px 14px; font-family: var(--font-mono); font-size: 11.5px;
  letter-spacing: .04em; text-transform: uppercase; transition: border-color .15s, color .15s; }
.slb-shot-tab[aria-pressed="false"]:hover { border-color: #3a3a47; color: #f3f3f6; }

/* Chips */
.slb-chip { border: 1px solid #26262e; padding: 6px 12px; font-family: var(--font-mono); font-size: 11.5px; color: #b9b9c6; }

/* STAT */
.slb-stat { position: relative; overflow: hidden; padding: 120px 0; background: #050506; }
.slb-stat-num { margin-top: 14px; font-weight: 600; letter-spacing: -.03em; line-height: 1; font-size: clamp(3.4rem, 9vw, 8rem);
  background: linear-gradient(100deg, #22d3ee, #0aa5bd 55%, #7fe8f7); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

/* CTA */
.slb-cta { position: relative; overflow: hidden; padding: 130px 0; background: #050506; border-top: 1px solid #14141a; }

.slb-faq summary::-webkit-details-marker { display: none; }
.slb-faq[open] .slb-faq-chev { transform: rotate(180deg); }
.slb-faq-chev { transition: transform .2s ease; }

/* Cartes de contenu (blog, vidéos, solutions) */
.slb-card { display: flex; flex-direction: column; border: 1px solid #1f1f27; background: #0a0a0e; transition: border-color .15s, transform .15s; }
.slb-card:hover { border-color: #33333f; }
.slb-card-link:hover { transform: translateY(-2px); }

/* Article */
.slb-prose { max-width: 720px; margin: 0 auto; font-size: 17px; line-height: 1.75; color: #d0d0da; }
.slb-prose h2 { margin: 2.2em 0 .6em; font-family: var(--font-geist); font-size: 1.55rem; font-weight: 600; letter-spacing: -.01em; color: #f7f7fb; }
.slb-prose p { margin: 0 0 1.15em; }
.slb-prose ul { margin: 0 0 1.2em; padding-left: 1.2em; list-style: disc; }
.slb-prose li { margin: .35em 0; }
.slb-prose strong { color: #f3f3f6; }
.slb-prose blockquote { margin: 1.6em 0; padding: 4px 0 4px 18px; border-left: 2px solid #22d3ee; color: #e6e6ee; font-size: 1.1em; }

@media (prefers-reduced-motion: reduce) { .slb-silk { animation: none; } }
`
