import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AlertTriangle, Blocks, Boxes, Database, FileSearch, GitBranch, GitPullRequest,
  HelpCircle, LayoutDashboard, Network, Radar, Radio, ScanText, ScrollText, Search,
  Settings, Sparkles, Terminal, Truck, Upload, Users, Zap,
} from 'lucide-react'

const NAV: { section: string; items: { to: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    section: 'Intelligence',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard },
      { to: '/graph', label: 'Graph', icon: Network },
      { to: '/twin', label: 'Digital Twin', icon: Radio },
    ],
  },
  {
    section: 'Analysis',
    items: [
      { to: '/dependencies', label: 'Dependencies', icon: GitBranch },
      { to: '/risks', label: 'Risks', icon: AlertTriangle },
      { to: '/incidents', label: 'Early-Warning', icon: Radar },
      { to: '/change', label: 'Change Impact', icon: GitPullRequest },
      { to: '/audit', label: 'Confidence & Audit', icon: FileSearch },
    ],
  },
  {
    section: 'Resilience',
    items: [
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/human', label: 'Human Deps', icon: Users },
      { to: '/simulations', label: 'Simulations', icon: Zap },
    ],
  },
  {
    section: 'Knowledge',
    items: [
      { to: '/ai', label: 'AI Analyst', icon: Sparkles },
      { to: '/documents', label: 'Documents', icon: ScanText },
      { to: '/reports', label: 'Reports', icon: ScrollText },
    ],
  },
  {
    section: 'Data',
    items: [
      { to: '/assets', label: 'Assets', icon: Boxes },
      { to: '/onboarding', label: 'Onboarding', icon: Upload },
      { to: '/integrations', label: 'Integrations', icon: Blocks },
    ],
  },
]

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'

export function Layout({ children, header }: { children: ReactNode; header?: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--nx-bg)', fontFamily: 'var(--font-inter)' }}>
      {/* ===== Sidebar ===== */}
      <nav
        className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r px-2 py-4 md:flex"
        style={{ background: 'var(--nx-panel)', borderColor: 'var(--nx-border)' }}
      >
        {/* Marque */}
        <div className="mb-8 mt-2 flex items-center gap-3 px-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-sm"
            style={{ background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.35)' }}
          >
            <Database size={18} style={{ color: 'var(--nx-cyan)' }} />
          </div>
          <div>
            <div className="font-bold tracking-tighter" style={{ fontFamily: geist, fontSize: 20, lineHeight: 1, color: 'var(--nx-cyan-text)' }}>NEXUS</div>
            <div className="mt-1" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', opacity: 0.8 }}>Operational Intel</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className="px-3 pb-1" style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--nx-text-muted)', opacity: 0.6 }}>{section}</div>
              <div className="space-y-0.5">
                {items.map(({ to, label, icon: Icon }) => (
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
                    <span style={{ fontSize: 13.5 }}>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pied */}
        <div className="mt-auto space-y-4 border-t pt-4" style={{ borderColor: 'rgba(59,73,76,0.3)' }}>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-sm py-2 transition-colors"
            style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.30)', color: 'var(--nx-cyan-text)', fontFamily: mono, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            <Terminal size={14} /> Execute Command
          </button>
          <div className="space-y-1">
            <NavLink to="/admin" className="flex items-center gap-3 rounded-sm px-3 py-2 transition-colors" style={({ isActive }) => ({ color: isActive ? 'var(--nx-cyan-text)' : 'var(--nx-text-muted)', fontSize: 14, background: isActive ? 'rgba(0,229,255,0.10)' : 'transparent' })}>
              <Settings size={18} /> Admin &amp; System
            </NavLink>
            <span className="flex cursor-default items-center gap-3 rounded-sm px-3 py-2" style={{ color: 'var(--nx-text-muted)', fontSize: 14 }}>
              <HelpCircle size={18} /> Support
            </span>
          </div>
        </div>
      </nav>

      {/* ===== Zone principale ===== */}
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        {/* Top command bar */}
        <header
          className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b px-6"
          style={{ background: 'var(--nx-surface)', borderColor: 'var(--nx-border)' }}
        >
          <div className="flex items-center gap-8">
            <span className="hidden font-bold tracking-tight md:block" style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>NEXUS COMMAND</span>
            <div className="relative hidden w-64 items-center sm:flex lg:w-96">
              <Search size={15} className="absolute left-3" style={{ color: 'var(--nx-text-muted)' }} />
              <input
                placeholder="Search entities, IPs, or assets..."
                className="w-full rounded-sm py-1.5 pl-9 pr-3 outline-none transition-all nx-input"
                style={{ background: 'var(--nx-surface-high)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontSize: 13 }}
              />
              <kbd className="absolute right-2 rounded px-1.5 py-0.5" style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-text-muted)', background: 'var(--nx-panel)', border: '1px solid rgba(59,73,76,0.5)' }}>⌘+K</kbd>
            </div>
          </div>
          <div className="flex items-center gap-3">{header}</div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6" style={{ color: 'var(--nx-text)' }}>{children}</main>
      </div>
    </div>
  )
}
