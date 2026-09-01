import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Simulation } from './pages/Simulation'
import { GraphExplorer } from './pages/GraphExplorer'
import { RiskCenter } from './pages/RiskCenter'
import { Assets } from './pages/Assets'
import { AiAnalyst } from './pages/AiAnalyst'
import { Reports } from './pages/Reports'
import { HumanDependency } from './pages/HumanDependency'
import { DependencyIntelligence } from './pages/DependencyIntelligence'
import { SupplierIntelligence } from './pages/SupplierIntelligence'
import { Incidents } from './pages/Incidents'
import { Audit } from './pages/Audit'
import { ChangeImpact } from './pages/ChangeImpact'
import { DigitalTwin } from './pages/DigitalTwin'
import { History } from './pages/History'
import { DocumentIntelligence } from './pages/DocumentIntelligence'
import { Onboarding } from './pages/Onboarding'
import { IntegrationMarketplace } from './pages/IntegrationMarketplace'
import { Admin } from './pages/Admin'
import { ActionPlan } from './pages/ActionPlan'
import { EnterpriseModel } from './pages/EnterpriseModel'
import { DecisionSim } from './pages/DecisionSim'
import { Help } from './pages/Help'
import { Landing } from './pages/Landing'
import { DemoChoice } from './pages/DemoChoice'
import { Login } from './pages/Login'
import { getTenantId } from './lib/tenant'
import { isAuthed, logout } from './lib/auth'

const TITLES: Record<string, string> = {
  '/': 'Overview',
  '/enterprise': 'Enterprise Model',
  '/decision': 'Decision & Simulation',
  '/graph': 'Graph Explorer',
  '/assets': 'Assets',
  '/dependencies': 'Dependencies',
  '/risks': 'Risk Center',
  '/suppliers': 'Supplier Intelligence',
  '/incidents': 'Incident Early-Warning',
  '/change': 'Change Impact',
  '/audit': 'Confidence & Audit',
  '/twin': 'Digital Twin',
  '/history': 'Digital Twin History',
  '/documents': 'Document Intelligence',
  '/onboarding': 'Data Onboarding',
  '/integrations': 'Integration Marketplace',
  '/admin': 'Admin & System',
  '/help': 'Documentation',
  '/simulations': 'What-If Simulation',
  '/ai': 'AI Analyst',
  '/reports': 'Reports',
  '/human': 'Human Dependency',
  '/actions': 'Action Plan',
}

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tenant = getTenantId()

  // Pages publiques plein écran (hors du layout applicatif).
  if (pathname === '/welcome') {
    return <Landing />
  }
  if (pathname === '/demo') {
    return <DemoChoice />
  }
  if (pathname === '/login') {
    return <Login />
  }
  // Gate d'authentification : les visiteurs non connectés arrivent sur la landing.
  if (!isAuthed()) {
    return <Navigate to="/welcome" replace />
  }

  return (
    <Layout
      header={
        <>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--color-text-strong)' }}>
            {TITLES[pathname] ?? 'Lenexus'}
          </h1>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span title="Tenant (issu du jeton)">tenant&nbsp;·&nbsp;{tenant.slice(0, 8)}</span>
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="flex items-center gap-1 rounded-md border px-2 py-1 transition-colors hover:brightness-125"
              style={{ borderColor: 'var(--color-border)' }}
              title="Se déconnecter"
            >
              <LogOut size={12} /> logout
            </button>
          </div>
        </>
      }
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/enterprise" element={<EnterpriseModel />} />
        <Route path="/decision" element={<DecisionSim />} />
        <Route path="/graph" element={<GraphExplorer />} />
        <Route path="/dependencies" element={<DependencyIntelligence />} />
        <Route path="/suppliers" element={<SupplierIntelligence />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/change" element={<ChangeImpact />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/twin" element={<DigitalTwin />} />
        <Route path="/history" element={<History />} />
        <Route path="/documents" element={<DocumentIntelligence />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/integrations" element={<IntegrationMarketplace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/help" element={<Help />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/risks" element={<RiskCenter />} />
        <Route path="/simulations" element={<Simulation />} />
        <Route path="/ai" element={<AiAnalyst />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/human" element={<HumanDependency />} />
        <Route path="/actions" element={<ActionPlan />} />
      </Routes>
    </Layout>
  )
}
