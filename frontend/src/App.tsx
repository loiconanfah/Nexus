import { Route, Routes, useLocation } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Simulation } from './pages/Simulation'
import { getTenantId, resetTenant } from './lib/tenant'

const TITLES: Record<string, string> = {
  '/': 'Overview',
  '/simulations': 'What-If Simulation',
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
        <Route path="/simulations" element={<Simulation />} />
      </Routes>
    </Layout>
  )
}
