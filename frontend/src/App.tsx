import { Route, Routes, useLocation } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Simulation } from './pages/Simulation'
import { GraphExplorer } from './pages/GraphExplorer'
import { RiskCenter } from './pages/RiskCenter'
import { Assets } from './pages/Assets'
import { AiAnalyst } from './pages/AiAnalyst'
import { Reports } from './pages/Reports'
import { getTenantId, resetTenant } from './lib/tenant'

const TITLES: Record<string, string> = {
  '/': 'Overview',
  '/graph': 'Graph Explorer',
  '/assets': 'Assets',
  '/dependencies': 'Dependencies',
  '/risks': 'Risk Center',
  '/simulations': 'What-If Simulation',
  '/ai': 'AI Analyst',
  '/reports': 'Reports',
}

export default function App() {
  const { pathname } = useLocation()
  const tenant = getTenantId()

  return (
    <Layout
      header={
        <>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--color-text-strong)' }}>
            {TITLES[pathname] ?? 'NEXUS'}
          </h1>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span title="Tenant (stub dev)">tenant&nbsp;·&nbsp;{tenant.slice(0, 8)}</span>
            <button
              onClick={() => { resetTenant(); window.location.href = '/' }}
              className="flex items-center gap-1 rounded-md border px-2 py-1 transition-colors hover:brightness-125"
              style={{ borderColor: 'var(--color-border)' }}
              title="Nouveau tenant vierge"
            >
              <RotateCcw size={12} /> reset
            </button>
          </div>
        </>
      }
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/graph" element={<GraphExplorer />} />
        <Route path="/dependencies" element={<GraphExplorer />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/risks" element={<RiskCenter />} />
        <Route path="/simulations" element={<Simulation />} />
        <Route path="/ai" element={<AiAnalyst />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Layout>
  )
}
