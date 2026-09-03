import { useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, Blocks, Boxes, Building2, Database, FileSearch, GitBranch, GitPullRequest,
  ClipboardList, HelpCircle, History, LayoutDashboard, Moon, Network, PanelLeftClose, PanelLeftOpen,
  Radar, Radio, ScanText, ScrollText, Search,
  Settings, Sparkles, Sun, Terminal, Truck, Upload, Users, Waypoints, Zap, ShieldAlert,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { useTheme } from '../lib/theme'

type NavItem = { to: string; fr: string; en: string; icon: typeof LayoutDashboard }
const NAV: { fr: string; en: string; items: NavItem[] }[] = [
  {
    fr: 'Intelligence', en: 'Intelligence',
    items: [
      { to: '/', fr: 'Vue d’ensemble', en: 'Overview', icon: LayoutDashboard },
      { to: '/enterprise', fr: 'Modèle d’entreprise', en: 'Enterprise Model', icon: Building2 },
      { to: '/decision', fr: 'Décision & simulation', en: 'Decision & Sim', icon: Sparkles },
      { to: '/impact', fr: 'Impact transversal', en: 'Cross-system Impact', icon: Waypoints },
      { to: '/graph', fr: 'Graphe', en: 'Graph', icon: Network },
      { to: '/twin', fr: 'Jumeau numérique', en: 'Digital Twin', icon: Radio },
      { to: '/history', fr: 'Historique du jumeau', en: 'Twin History', icon: History },
    ],
  },
  {
    fr: 'Analyse', en: 'Analysis',
    items: [
      { to: '/dependencies', fr: 'Dépendances', en: 'Dependencies', icon: GitBranch },
      { to: '/risks', fr: 'Risques', en: 'Risks', icon: AlertTriangle },
      { to: '/incidents', fr: 'Alerte anticipée', en: 'Early-Warning', icon: Radar },
      { to: '/attacks', fr: 'Simulation d’attaque', en: 'Attack Simulation', icon: ShieldAlert },
      { to: '/change', fr: 'Impact de changement', en: 'Change Impact', icon: GitPullRequest },
      { to: '/audit', fr: 'Confiance & audit', en: 'Confidence & Audit', icon: FileSearch },
    ],
  },
  {
    fr: 'Résilience', en: 'Resilience',
    items: [
      { to: '/suppliers', fr: 'Fournisseurs', en: 'Suppliers', icon: Truck },
      { to: '/human', fr: 'Dép. humaines', en: 'Human Deps', icon: Users },
      { to: '/actions', fr: 'Plan d’action', en: 'Action Plan', icon: ClipboardList },
      { to: '/simulations', fr: 'Simulations', en: 'Simulations', icon: Zap },
    ],
  },
  {
    fr: 'Connaissance', en: 'Knowledge',
    items: [
      { to: '/ai', fr: 'Analyste IA', en: 'AI Analyst', icon: Sparkles },
      { to: '/documents', fr: 'Documents', en: 'Documents', icon: ScanText },
      { to: '/reports', fr: 'Rapports', en: 'Reports', icon: ScrollText },
    ],
  },
  {
    fr: 'Données', en: 'Data',
    items: [
      { to: '/assets', fr: 'Actifs', en: 'Assets', icon: Boxes },
      { to: '/onboarding', fr: 'Intégration', en: 'Onboarding', icon: Upload },
      { to: '/inference', fr: 'Dépendances inférées', en: 'Inferred Deps', icon: GitBranch },
      { to: '/integrations', fr: 'Connecteurs', en: 'Integrations', icon: Blocks },
    ],
  },
]

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'

export function Layout({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const { lang, t } = useLang()
  const searchRef = useRef<HTMLInputElement>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('nexus.nav.collapsed') === '1' } catch { return false }
  })
  function toggleNav() {
    setCollapsed((c) => {
      const next = !c
      try { localStorage.setItem('nexus.nav.collapsed', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--nx-bg)', fontFamily: 'var(--font-inter)' }}>
      {/* ===== Sidebar ===== */}
      <nav
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r px-2 py-4 transition-[width] duration-200 ease-in-out md:flex ${collapsed ? 'w-[68px]' : 'w-[280px]'}`}
        style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}
      >
        {/* Marque + bascule */}
        <div className={`mb-8 mt-2 flex items-center px-3 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm" style={{ background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.35)' }}>
            <Database size={18} style={{ color: 'var(--nx-cyan)' }} />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-bold tracking-tighter" style={{ fontFamily: geist, fontSize: 20, lineHeight: 1, color: 'var(--nx-cyan-text)' }}>Lenexus</div>
              <div className="mt-1 truncate" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', opacity: 0.8 }}>{t('Intelligence opérationnelle', 'Operational Intel')}</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={toggleNav}
              className="shrink-0 rounded-sm p-1 transition-colors hover:brightness-125"
              style={{ color: 'var(--nx-text-muted)' }}
              title={t('Replier le menu', 'Collapse menu')}
              aria-label={t('Replier le menu', 'Collapse menu')}
            >
              <PanelLeftClose size={17} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
          {NAV.map((group) => (
            <div key={group.en}>
              {collapsed
                ? <div className="mx-3 mb-1 border-t" style={{ borderColor: 'rgba(59,73,76,0.35)' }} />
                : <div className="px-3 pb-1" style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', opacity: 0.6 }}>{lang === 'fr' ? group.fr : group.en}</div>}
              <div className="space-y-0.5">
                {group.items.map(({ to, fr, en, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    title={collapsed ? (lang === 'fr' ? fr : en) : undefined}
                    className={`flex items-center rounded-sm py-2 transition-colors ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}
                    style={({ isActive }) => ({
                      background: isActive ? 'rgba(0,229,255,0.10)' : 'transparent',
                      color: isActive ? 'var(--nx-cyan-text)' : 'var(--nx-text-muted)',
                      borderLeft: collapsed ? '2px solid transparent' : `2px solid ${isActive ? 'var(--nx-cyan)' : 'transparent'}`,
                      fontWeight: isActive ? 600 : 400,
                    })}
                  >
                    <Icon size={17} className="shrink-0" />
                    {!collapsed && <span style={{ fontSize: 13.5 }}>{lang === 'fr' ? fr : en}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pied */}
        <div className="mt-auto space-y-4 border-t pt-4" style={{ borderColor: 'rgba(59,73,76,0.3)' }}>
          <button
            onClick={() => { if (collapsed) toggleNav(); setTimeout(() => searchRef.current?.focus(), 0) }}
            className={`flex w-full items-center rounded-sm py-2 transition-colors ${collapsed ? 'justify-center' : 'justify-center gap-2'}`}
            style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.30)', color: 'var(--nx-cyan-text)', fontFamily: mono, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}
            title={t('Rechercher', 'Execute Command')}
          >
            <Terminal size={14} /> {!collapsed && t('Rechercher', 'Execute Command')}
          </button>
          <div className="space-y-1">
            <NavLink to="/admin" title={collapsed ? t('Admin & système', 'Admin & System') : undefined} className={`flex items-center rounded-sm py-2 transition-colors ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`} style={({ isActive }) => ({ color: isActive ? 'var(--nx-cyan-text)' : 'var(--nx-text-muted)', fontSize: 14, background: isActive ? 'rgba(0,229,255,0.10)' : 'transparent' })}>
              <Settings size={18} className="shrink-0" /> {!collapsed && t('Admin & système', 'Admin & System')}
            </NavLink>
            <NavLink to="/help" title={collapsed ? t('Assistance', 'Support') : undefined} className={`flex items-center rounded-sm py-2 transition-colors ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`} style={({ isActive }) => ({ color: isActive ? 'var(--nx-cyan-text)' : 'var(--nx-text-muted)', fontSize: 14, background: isActive ? 'rgba(0,229,255,0.10)' : 'transparent' })}>
              <HelpCircle size={18} className="shrink-0" /> {!collapsed && t('Assistance', 'Support')}
            </NavLink>
          </div>
        </div>
      </nav>

      {/* ===== Zone principale ===== */}
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b px-6" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleNav}
              className="hidden shrink-0 rounded-sm p-1.5 transition-colors hover:brightness-125 md:block"
              style={{ color: 'var(--nx-text-muted)', border: '1px solid var(--nx-border)' }}
              title={collapsed ? t('Déplier le menu', 'Expand menu') : t('Replier le menu', 'Collapse menu')}
              aria-label={collapsed ? t('Déplier le menu', 'Expand menu') : t('Replier le menu', 'Collapse menu')}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <span className="hidden font-bold tracking-tight md:block" style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>Lenexus COMMAND</span>
            <CommandSearch inputRef={searchRef} />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LangToggle />
            {header}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6" style={{ color: 'var(--nx-text)' }}>{children}</main>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const { t } = useLang()
  const dark = theme === 'dark'
  return (
    <button
      onClick={toggle}
      className="flex shrink-0 items-center justify-center rounded-sm p-1.5 transition-colors hover:brightness-125"
      style={{ color: 'var(--nx-text-muted)', border: '1px solid var(--nx-border)' }}
      title={dark ? t('Passer en clair', 'Switch to light') : t('Passer en sombre', 'Switch to dark')}
      aria-label={dark ? t('Passer en clair', 'Switch to light') : t('Passer en sombre', 'Switch to dark')}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <div className="flex items-center rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className="px-2 py-1 transition-colors"
          style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: lang === l ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', background: lang === l ? 'var(--nx-cyan)' : 'transparent' }}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function CommandSearch({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const { data: graph } = useQuery({ queryKey: ['graph'], queryFn: api.graph })

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return (graph?.nodes ?? [])
      .filter((n) => n.name.toLowerCase().includes(term) || n.entityType.toLowerCase().includes(term))
      .slice(0, 8)
  }, [q, graph])

  function go(id: string) {
    setQ(''); setOpen(false)
    navigate(`/graph?focus=${id}`)
  }

  return (
    <div className="relative hidden w-64 items-center sm:flex lg:w-96">
      <Search size={15} className="absolute left-3 z-10" style={{ color: 'var(--nx-text-muted)' }} />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0].id); if (e.key === 'Escape') { setQ(''); setOpen(false) } }}
        placeholder={t('Rechercher un actif, un système…', 'Search entities, systems, assets…')}
        className="w-full rounded-sm py-1.5 pl-9 pr-3 outline-none transition-all nx-input"
        style={{ background: 'var(--nx-surface-high)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }}
      />
      {open && results.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-sm border shadow-lg" style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}>
          {results.map((n) => (
            <button key={n.id} onMouseDown={() => go(n.id)} className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:brightness-125" style={{ background: 'transparent' }}>
              <span style={{ fontSize: 13, color: 'var(--nx-text)' }}>{n.name}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)' }}>{n.entityType} · c{n.criticality}</span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && results.length === 0 && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-sm border px-3 py-2" style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{t('Aucun résultat', 'No match')}</div>
      )}
    </div>
  )
}
