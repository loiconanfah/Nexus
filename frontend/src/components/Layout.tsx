import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Activity, AlertTriangle, Boxes, GitBranch, LayoutDashboard, Network,
  ScrollText, Sparkles, Zap,
} from 'lucide-react'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, ready: true },
  { to: '/simulations', label: 'Simulations', icon: Zap, ready: true },
  { to: '/graph', label: 'Graph', icon: Network, ready: false },
  { to: '/assets', label: 'Assets', icon: Boxes, ready: false },
  { to: '/dependencies', label: 'Dependencies', icon: GitBranch, ready: false },
  { to: '/risks', label: 'Risks', icon: AlertTriangle, ready: false },
  { to: '/ai', label: 'AI Analyst', icon: Sparkles, ready: false },
  { to: '/reports', label: 'Reports', icon: ScrollText, ready: false },
]

export function Layout({ children, header }: { children: ReactNode; header?: ReactNode }) {
  return (
    <div className="flex h-full">
      <aside
        className="flex w-56 shrink-0 flex-col border-r"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2 px-5 py-4">
          <Activity size={20} style={{ color: 'var(--color-brand)' }} />
          <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--color-text-strong)' }}>
            NEXUS
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV.map(({ to, label, icon: Icon, ready }) =>
            ready ? (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={({ isActive }) => ({
                  background: isActive ? 'var(--color-brand-soft)' : 'transparent',
                  color: isActive ? 'var(--color-text-strong)' : 'var(--color-text-muted)',
                })}
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ) : (
              <span
                key={to}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium opacity-40"
                style={{ color: 'var(--color-text-muted)' }}
                title="À venir"
              >
                <Icon size={16} />
                {label}
              </span>
            )
          )}
        </nav>
        <div className="px-5 py-3 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          Operational Dependency<br />Intelligence
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-14 shrink-0 items-center justify-between border-b px-6"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
        >
          {header}
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
