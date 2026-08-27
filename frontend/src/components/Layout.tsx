import { useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, Blocks, Boxes, Database, FileSearch, GitBranch, GitPullRequest,
  ClipboardList, HelpCircle, LayoutDashboard, Network, Radar, Radio, ScanText, ScrollText, Search,
  Settings, Sparkles, Terminal, Truck, Upload, Users, Zap,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'

type NavItem = { to: string; fr: string; en: string; icon: typeof LayoutDashboard }
const NAV: { fr: string; en: string; items: NavItem[] }[] = [
  {
    fr: 'Intelligence', en: 'Intelligence',
    items: [
      { to: '/', fr: 'Vue d’ensemble', en: 'Overview', icon: LayoutDashboard },
      { to: '/graph', fr: 'Graphe', en: 'Graph', icon: Network },
      { to: '/twin', fr: 'Jumeau numérique', en: 'Digital Twin', icon: Radio },
    ],
  },
  {
    fr: 'Analyse', en: 'Analysis',
    items: [
      { to: '/dependencies', fr: 'Dépendances', en: 'Dependencies', icon: GitBranch },
      { to: '/risks', fr: 'Risques', en: 'Risks', icon: AlertTriangle },
      { to: '/incidents', fr: 'Alerte anticipée', en: 'Early-Warning', icon: Radar },
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
      { to: '/integrations', fr: 'Connecteurs', en: 'Integrations', icon: Blocks },
    ],
  },
]

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'

export function Layout({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const { lang, t } = useLang()
  const searchRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--nx-bg)', fontFamily: 'var(--font-inter)' }}>
      {/* ===== Sidebar ===== */}
      <nav
        className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r px-2 py-4 md:flex"
        style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}
      >
        {/* Marque */}
        <div className="mb-8 mt-2 flex items-center gap-3 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm" style={{ background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.35)' }}>
            <Database size={18} style={{ color: 'var(--nx-cyan)' }} />
          </div>
          <div>
            <div className="font-bold tracking-tighter" style={{ fontFamily: geist, fontSize: 20, lineHeight: 1, color: 'var(--nx-cyan-text)' }}>NEXUS</div>
            <div className="mt-1" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', opacity: 0.8 }}>{t('Intelligence opérationnelle', 'Operational Intel')}</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {NAV.map((group) => (
            <div key={group.en}>
              <div className="px-3 pb-1" style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', opacity: 0.6 }}>{lang === 'fr' ? group.fr : group.en}</div>
              <div className="space-y-0.5">
                {group.items.map(({ to, fr, en, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className="flex items-center gap-3 rounded-sm px-3 py-2 transition-colors"
                    style={({ isActive }) => ({
                      background: isActive ? 'rgba(0,229,255,0.10)' : 'transparent',
                      color: isActive ? 'var(--nx-cyan-text)' : 'var(--nx-text-muted)',
                      borderLeft: `2px solid ${isActive ? 'var(--nx-cyan)' : 'transparent'}`,
                      fontWeight: isActive ? 600 : 400,
                    })}
                  >
                    <Icon size={17} />
                    <span style={{ fontSize: 13.5 }}>{lang === 'fr' ? fr : en}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pied */}
        <div className="mt-auto space-y-4 border-t pt-4" style={{ borderColor: 'rgba(59,73,76,0.3)' }}>
          <button
            onClick={() => searchRef.current?.focus()}
            className="flex w-full items-center justify-center gap-2 rounded-sm py-2 transition-colors"
            style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.30)', color: 'var(--nx-cyan-text)', fontFamily: mono, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            <Terminal size={14} /> {t('Rechercher', 'Execute Command')}
          </button>
          <div className="space-y-1">
            <NavLink to="/admin" className="flex items-center gap-3 rounded-sm px-3 py-2 transition-colors" style={({ isActive }) => ({ color: isActive ? 'var(--nx-cyan-text)' : 'var(--nx-text-muted)', fontSize: 14, background: isActive ? 'rgba(0,229,255,0.10)' : 'transparent' })}>
              <Settings size={18} /> {t('Admin & système', 'Admin & System')}
            </NavLink>
            <a href="mailto:support@nexus.io" className="flex items-center gap-3 rounded-sm px-3 py-2 transition-colors hover:brightness-125" style={{ color: 'var(--nx-text-muted)', fontSize: 14 }}>
              <HelpCircle size={18} /> {t('Assistance', 'Support')}
            </a>
          </div>
        </div>
      </nav>

      {/* ===== Zone principale ===== */}
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b px-6" style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center gap-8">
            <span className="hidden font-bold tracking-tight md:block" style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>NEXUS COMMAND</span>
            <CommandSearch inputRef={searchRef} />
          </div>
          <div className="flex items-center gap-3">
            <LangToggle />
            {header}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6" style={{ color: 'var(--nx-text)' }}>{children}</main>
      </div>
    </div>
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
