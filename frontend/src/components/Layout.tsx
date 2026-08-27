import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AlertTriangle, Boxes, Database, GitBranch, HelpCircle, LayoutDashboard, Network,
  ScrollText, Search, Settings, Sparkles, Terminal, Users, Zap,
} from 'lucide-react'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/graph', label: 'Graph', icon: Network },
  { to: '/assets', label: 'Assets', icon: Boxes },
  { to: '/dependencies', label: 'Dependencies', icon: GitBranch },
  { to: '/risks', label: 'Risks', icon: AlertTriangle },
  { to: '/human', label: 'Human Deps', icon: Users },
  { to: '/simulations', label: 'Simulations', icon: Zap },
  { to: '/ai', label: 'AI Analyst', icon: Sparkles },
  { to: '/reports', label: 'Reports', icon: ScrollText },
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
        <div className="flex-1 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="flex items-center gap-3 rounded-sm px-3 py-2.5 transition-colors"
              style={({ isActive }) => ({
                background: isActive ? 'rgba(0,229,255,0.10)' : 'transparent',
                color: isActive ? 'var(--nx-cyan-text)' : 'var(--nx-text-muted)',
                borderLeft: `2px solid ${isActive ? 'var(--nx-cyan)' : 'transparent'}`,
                fontWeight: isActive ? 600 : 400,
              })}
            >
              <Icon size={18} />
              <span style={{ fontSize: 14 }}>{label}</span>
            </NavLink>
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
            {[{ label: 'Settings', icon: Settings }, { label: 'Support', icon: HelpCircle }].map(({ label, icon: Icon }) => (
              <span key={label} className="flex cursor-default items-center gap-3 rounded-sm px-3 py-2" style={{ color: 'var(--nx-text-muted)', fontSize: 14 }}>
                <Icon size={18} /> {label}
              </span>
            ))}
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
