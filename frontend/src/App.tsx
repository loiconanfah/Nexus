import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Layout } from './components/Layout'
import { GuidedTour } from './components/GuidedTour'
import { CookieConsent } from './components/CookieConsent'
import { useLang } from './lib/i18n'
import { Landing } from './pages/Landing'
import { LogoMark } from './components/Logo'
import { useOrganization } from './lib/money'
import { getTenantId } from './lib/tenant'
import { isAuthed, logout } from './lib/auth'

/*
  Chargement à la demande : la page d'accueil publique ne télécharge que son
  propre code. Les écrans de l'application (graphe 3D, simulations, rapports)
  arrivent au moment où on les ouvre.
*/
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Simulation = lazy(() => import('./pages/Simulation').then((m) => ({ default: m.Simulation })))
const GraphExplorer = lazy(() => import('./pages/GraphExplorer').then((m) => ({ default: m.GraphExplorer })))
const RiskCenter = lazy(() => import('./pages/RiskCenter').then((m) => ({ default: m.RiskCenter })))
const Assets = lazy(() => import('./pages/Assets').then((m) => ({ default: m.Assets })))
const AiAnalyst = lazy(() => import('./pages/AiAnalyst').then((m) => ({ default: m.AiAnalyst })))
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })))
const HumanDependency = lazy(() => import('./pages/HumanDependency').then((m) => ({ default: m.HumanDependency })))
const DependencyIntelligence = lazy(() => import('./pages/DependencyIntelligence').then((m) => ({ default: m.DependencyIntelligence })))
const SupplierIntelligence = lazy(() => import('./pages/SupplierIntelligence').then((m) => ({ default: m.SupplierIntelligence })))
const Incidents = lazy(() => import('./pages/Incidents').then((m) => ({ default: m.Incidents })))
const IncidentResponse = lazy(() => import('./pages/IncidentResponse').then((m) => ({ default: m.IncidentResponse })))
const Audit = lazy(() => import('./pages/Audit').then((m) => ({ default: m.Audit })))
const ChangeImpact = lazy(() => import('./pages/ChangeImpact').then((m) => ({ default: m.ChangeImpact })))
const DigitalTwin = lazy(() => import('./pages/DigitalTwin').then((m) => ({ default: m.DigitalTwin })))
const History = lazy(() => import('./pages/History').then((m) => ({ default: m.History })))
const DocumentIntelligence = lazy(() => import('./pages/DocumentIntelligence').then((m) => ({ default: m.DocumentIntelligence })))
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })))
const IntegrationMarketplace = lazy(() => import('./pages/IntegrationMarketplace').then((m) => ({ default: m.IntegrationMarketplace })))
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))
const ActionPlan = lazy(() => import('./pages/ActionPlan').then((m) => ({ default: m.ActionPlan })))
const EnterpriseModel = lazy(() => import('./pages/EnterpriseModel').then((m) => ({ default: m.EnterpriseModel })))
const DecisionSim = lazy(() => import('./pages/DecisionSim').then((m) => ({ default: m.DecisionSim })))
const ImpactIntelligence = lazy(() => import('./pages/ImpactIntelligence').then((m) => ({ default: m.ImpactIntelligence })))
const RelationInference = lazy(() => import('./pages/RelationInference').then((m) => ({ default: m.RelationInference })))
const AttackSim = lazy(() => import('./pages/AttackSim').then((m) => ({ default: m.AttackSim })))
const Help = lazy(() => import('./pages/Help').then((m) => ({ default: m.Help })))
const Setup = lazy(() => import('./pages/Setup').then((m) => ({ default: m.Setup })))
const Docs = lazy(() => import('./pages/Docs').then((m) => ({ default: m.Docs })))
const Legal = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Legal })))
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const DemoChoice = lazy(() => import('./pages/DemoChoice').then((m) => ({ default: m.DemoChoice })))
const Blog = lazy(() => import('./pages/site/Blog').then((m) => ({ default: m.Blog })))
const BlogPost = lazy(() => import('./pages/site/Blog').then((m) => ({ default: m.BlogPost })))
const Videos = lazy(() => import('./pages/site/Videos').then((m) => ({ default: m.Videos })))
const Solutions = lazy(() => import('./pages/site/Solutions').then((m) => ({ default: m.Solutions })))

/** Écran d'attente pendant le chargement d'un écran. */
function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--nx-bg)' }}>
      <div className="nx-breathe"><LogoMark size={44} title="Lenexux" /></div>
    </div>
  )
}

// Titre affiché en en-tête de chaque écran. Bilingue et aligné sur le libellé
// du menu : l'utilisateur retrouve en haut de page exactement ce qu'il a cliqué.
const TITLES: Record<string, [string, string]> = {
  '/': ['Accueil', 'Home'],
  '/dashboard': ['Tableau de bord', 'Dashboard'],
  '/enterprise': ['Modèle d’entreprise', 'Enterprise Model'],
  '/decision': ['Décision & simulation', 'Decision & Simulation'],
  '/impact': ['Impact transversal', 'Cross-system Impact'],
  '/attacks': ['Simulation d’attaque', 'Attack Simulation'],
  '/inference': ['Dépendances inférées', 'Inferred Dependencies'],
  '/graph': ['Graphe de dépendances', 'Dependency Graph'],
  '/assets': ['Actifs', 'Assets'],
  '/dependencies': ['Dépendances', 'Dependencies'],
  '/risks': ['Centre de risques', 'Risk Center'],
  '/suppliers': ['Fournisseurs', 'Supplier Intelligence'],
  '/incident': ['Mode incident', 'Incident mode'],
  '/incidents': ['Alerte anticipée', 'Incident Early-Warning'],
  '/change': ['Impact de changement', 'Change Impact'],
  '/audit': ['Confiance & audit', 'Confidence & Audit'],
  '/twin': ['Jumeau numérique', 'Digital Twin'],
  '/history': ['Historique du jumeau', 'Digital Twin History'],
  '/documents': ['Documents', 'Document Intelligence'],
  '/onboarding': ['Import & intégration', 'Data Onboarding'],
  '/integrations': ['Connecteurs', 'Integrations'],
  '/admin': ['Admin & système', 'Admin & System'],
  '/help': ['Documentation', 'Documentation'],
  '/simulations': ['Simulation « et si ? »', 'What-If Simulation'],
  '/ai': ['Analyste IA', 'AI Analyst'],
  '/reports': ['Rapports', 'Reports'],
  '/human': ['Dépendances humaines', 'Human Dependency'],
  '/actions': ['Plan d’action', 'Action Plan'],
}

export default function App() {
  const { pathname } = useLocation()

  // Pages publiques plein écran (hors du layout applicatif).
  if (pathname === '/welcome') {
    return <><Suspense fallback={<Loading />}><Landing /></Suspense><CookieConsent /></>
  }
  if (pathname === '/demo') {
    return <><Suspense fallback={<Loading />}><DemoChoice /></Suspense><CookieConsent /></>
  }
  if (pathname === '/login') {
    return <><Suspense fallback={<Loading />}><Login /></Suspense><CookieConsent /></>
  }
  if (pathname === '/legal') {
    return <><Suspense fallback={<Loading />}><Legal /></Suspense><CookieConsent /></>
  }
  if (pathname === '/docs') {
    return <><Suspense fallback={<Loading />}><Docs /></Suspense><CookieConsent /></>
  }
  if (pathname === '/videos') {
    return <><Suspense fallback={<Loading />}><Videos /></Suspense><CookieConsent /></>
  }
  if (pathname === '/solutions') {
    return <><Suspense fallback={<Loading />}><Solutions /></Suspense><CookieConsent /></>
  }
  if (pathname === '/blog' || pathname.startsWith('/blog/')) {
    return (
      <>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
          </Routes>
        </Suspense>
        <CookieConsent />
      </>
    )
  }
  // Gate d'authentification : les visiteurs non connectés arrivent sur la landing.
  if (!isAuthed()) {
    return <Navigate to="/welcome" replace />
  }
  return <AuthedApp />
}

/**
 * Application connectée. Un espace neuf passe d'abord par l'assistant de
 * démarrage : sans profil, ni la devise ni le chiffrage ne sont les siens.
 */
function AuthedApp() {
  const { pathname } = useLocation()
  const { t } = useLang()
  const navigate = useNavigate()
  const tenant = getTenantId()
  const org = useOrganization()

  if (pathname === '/demarrage') return <Suspense fallback={<Loading />}><Setup /></Suspense>
  // Pas d'écran blanc si l'API est indisponible : on laisse passer, la barre de progression rattrapera.
  if (org.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--nx-bg)' }}>
        <div className="nx-breathe"><LogoMark size={44} title="Lenexux" /></div>
      </div>
    )
  }
  if (org.data?.requiresOnboarding) return <Navigate to="/demarrage" replace />

  return (
    <Layout
      header={
        <>
          <h1 className="whitespace-nowrap text-sm font-semibold" style={{ color: 'var(--color-text-strong)' }}>
            {TITLES[pathname] ? t(...TITLES[pathname]) : 'Lenexux'}
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
      <GuidedTour />
      <CookieConsent />
      <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/enterprise" element={<EnterpriseModel />} />
        <Route path="/decision" element={<DecisionSim />} />
        <Route path="/impact" element={<ImpactIntelligence />} />
        <Route path="/attacks" element={<AttackSim />} />
        <Route path="/inference" element={<RelationInference />} />
        <Route path="/graph" element={<GraphExplorer />} />
        <Route path="/dependencies" element={<DependencyIntelligence />} />
        <Route path="/suppliers" element={<SupplierIntelligence />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/incident" element={<IncidentResponse />} />
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
      </Suspense>
    </Layout>
  )
}
