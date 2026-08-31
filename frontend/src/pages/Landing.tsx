import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Share2, ArrowRight, PlayCircle, ShieldCheck, Boxes, FlaskConical, Gauge,
  Plug, Bot, Network, TrendingUp, Users, FileText, CheckCircle2, Lock,
} from 'lucide-react'
import { login } from '../lib/auth'
import { useLang } from '../lib/i18n'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'

export function Landing() {
  const navigate = useNavigate()
  const { lang, setLang, t } = useLang()
  const [busy, setBusy] = useState(false)

  async function tryDemo() {
    if (busy) return
    setBusy(true)
    try {
      await login('admin@cgi.demo', 'nexus-demo-2026')
      navigate('/')
    } catch {
      navigate('/login')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--nx-bg)', color: 'var(--nx-text)', fontFamily: 'var(--font-inter)' }}>
      {/* ===== Barre de navigation ===== */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between border-b px-5 py-4 backdrop-blur md:px-10"
        style={{ borderColor: 'var(--nx-border)', background: 'color-mix(in srgb, var(--nx-bg) 80%, transparent)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm" style={{ background: CYAN }}>
            <Share2 size={18} strokeWidth={2.4} style={{ color: 'var(--nx-on-cyan)' }} />
          </div>
          <span className="text-xl font-semibold tracking-tight" style={{ fontFamily: geist }}>NEXUS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-sm border" style={{ borderColor: 'var(--nx-border)' }}>
            {(['fr', 'en'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} className="px-2 py-1"
                style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: lang === l ? 'var(--nx-on-cyan)' : 'var(--nx-text-muted)', background: lang === l ? CYAN : 'transparent' }}>{l}</button>
            ))}
          </div>
          <button onClick={() => navigate('/login')} className="rounded px-3 py-1.5 transition-colors hover:brightness-125"
            style={{ fontSize: 13, color: 'var(--nx-text-muted)', border: '1px solid var(--nx-border)' }}>
            {t('Se connecter', 'Sign in')}
          </button>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden px-5 py-20 md:px-10 md:py-28">
        <div className="absolute inset-0 z-0" style={{ opacity: 0.35 }}>
          <div className="nx-grid absolute inset-0" />
          <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <line x1="15%" y1="25%" x2="35%" y2="45%" stroke="#3b494c" strokeWidth="1" />
            <line x1="35%" y1="45%" x2="65%" y2="35%" stroke="#3b494c" strokeWidth="1" />
            <line x1="65%" y1="35%" x2="82%" y2="65%" stroke="url(#lg)" strokeWidth="1.5" />
            <line x1="35%" y1="45%" x2="28%" y2="75%" stroke="#3b494c" strokeWidth="1" />
            <line x1="65%" y1="35%" x2="58%" y2="80%" stroke="#3b494c" strokeWidth="1" />
            <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#00e5ff" stopOpacity="0.8" /><stop offset="100%" stopColor="#3b494c" stopOpacity="0.1" /></linearGradient></defs>
            <circle className="nx-node-pulse" cx="15%" cy="25%" r="3" fill="#849396" />
            <circle className="nx-node-pulse" cx="35%" cy="45%" r="4" fill="#00e5ff" style={{ animationDelay: '1s' }} />
            <circle className="nx-node-pulse" cx="65%" cy="35%" r="3" fill="#849396" style={{ animationDelay: '.5s' }} />
            <circle className="nx-node-pulse" cx="82%" cy="65%" r="5" fill="#00e5ff" style={{ animationDelay: '1.5s' }} />
            <circle cx="28%" cy="75%" r="3" fill="#849396" />
            <circle cx="58%" cy="80%" r="4" fill="#3b494c" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1"
            style={{ borderColor: 'rgba(0,229,255,0.3)', background: 'rgba(0,229,255,0.08)', fontFamily: mono, fontSize: 12, color: 'var(--nx-cyan-text)' }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: CYAN }} />
            {t('Intelligence des dépendances opérationnelles', 'Operational Dependency Intelligence')}
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl" style={{ fontFamily: geist }}>
            {t('Sachez ce qui casse ', 'Know what breaks ')}
            <span style={{ color: CYAN }}>{t('avant', 'before')}</span>
            {t(' que l’activité n’en pâtisse.', ' the business does.')}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
            {t(
              'NEXUS cartographie vos systèmes, fournisseurs et personnes en un graphe de dépendances vivant — puis révèle vos points uniques de défaillance, simule les pannes et en chiffre l’impact.',
              'NEXUS maps your systems, suppliers and people into a living dependency graph — then reveals your single points of failure, simulates outages and quantifies their impact.',
            )}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate('/login?signup=1')}
              className="flex w-full items-center justify-center gap-2 rounded px-6 py-3 transition-all active:scale-[0.99] sm:w-auto"
              style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', boxShadow: '0 0 20px rgba(0,229,255,0.25)' }}>
              {t('Créer un compte', 'Create an account')} <ArrowRight size={17} />
            </button>
            <button onClick={tryDemo} disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded px-6 py-3 transition-colors hover:brightness-125 disabled:opacity-60 sm:w-auto"
              style={{ border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <PlayCircle size={17} /> {busy ? t('Ouverture…', 'Opening…') : t('Explorer la démo', 'Explore the demo')}
            </button>
          </div>
          <p className="mt-4" style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-outline)' }}>
            {t('Gratuit pour démarrer · aucune carte requise · espace de travail isolé', 'Free to start · no card required · isolated workspace')}
          </p>
        </div>
      </section>

      {/* ===== Problème ===== */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Kicker>{t('Le problème', 'The problem')}</Kicker>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl" style={{ fontFamily: geist }}>
            {t('Tout est connecté. Personne ne voit la carte.', 'Everything is connected. Nobody sees the map.')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
            {t(
              'Un fournisseur, un serveur d’authentification, une seule personne qui détient un savoir critique — leur défaillance se propage silencieusement jusqu’à interrompre l’activité. La cartographie vit dans des têtes et des tableurs éparpillés.',
              'A supplier, an auth server, a single person holding critical knowledge — their failure propagates silently until the business stops. The map lives in people’s heads and scattered spreadsheets.',
            )}
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <PainCard icon={Network} title={t('Dépendances invisibles', 'Invisible dependencies')} body={t('Vous découvrez le lien le jour où il casse.', 'You discover the link the day it breaks.')} />
          <PainCard icon={TrendingUp} title={t('Impact non chiffré', 'Unquantified impact')} body={t('Impossible de prioriser sans connaître le coût réel d’une panne.', 'Impossible to prioritize without knowing the real cost of an outage.')} />
          <PainCard icon={Users} title={t('Facteur humain', 'Human factor')} body={t('Le savoir critique repose parfois sur une seule personne.', 'Critical knowledge sometimes rests on a single person.')} />
        </div>
      </Section>

      {/* ===== Solution / valeur ===== */}
      <Section alt>
        <div className="mx-auto max-w-3xl text-center">
          <Kicker>{t('La solution', 'The solution')}</Kicker>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl" style={{ fontFamily: geist }}>
            {t('Une seule plateforme, du signal à la décision', 'One platform, from signal to decision')}
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <ValueCard icon={Boxes} title={t('Cartographier', 'Map')} body={t('Systèmes, infra, fournisseurs, personnes et processus dans un graphe unique.', 'Systems, infra, suppliers, people and processes in a single graph.')} />
          <ValueCard icon={FlaskConical} title={t('Simuler', 'Simulate')} body={t('Rejouez une panne ou une cyberattaque et voyez la cascade, niveau par niveau.', 'Replay an outage or cyberattack and watch the cascade, level by level.')} />
          <ValueCard icon={Gauge} title={t('Chiffrer', 'Quantify')} body={t('Score de risque explicable et impact financier en devise locale.', 'Explainable risk score and financial impact in local currency.')} />
          <ValueCard icon={CheckCircle2} title={t('Prioriser', 'Prioritize')} body={t('Des recommandations classées, suivies jusqu’à la clôture.', 'Ranked recommendations, tracked to closure.')} />
        </div>
      </Section>

      {/* ===== Comment ça marche ===== */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Kicker>{t('Comment ça marche', 'How it works')}</Kicker>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl" style={{ fontFamily: geist }}>
            {t('Trois étapes', 'Three steps')}
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <StepCard n="1" title={t('Importez', 'Import')} body={t('Fichier, JSON, ou collez des données en vrac : l’IA en déduit la structure. Aucun accès privilégié requis.', 'File, JSON, or paste messy data: the AI infers the structure. No privileged access required.')} />
          <StepCard n="2" title={t('Analysez', 'Analyze')} body={t('NEXUS révèle les points uniques de défaillance, la concentration fournisseurs et le rayon d’impact.', 'NEXUS reveals single points of failure, supplier concentration and blast radius.')} />
          <StepCard n="3" title={t('Décidez', 'Decide')} body={t('Simulez, chiffrez l’impact, et générez un plan d’action et un rapport exécutif.', 'Simulate, quantify impact, and generate an action plan and an executive report.')} />
        </div>
      </Section>

      {/* ===== Capacités ===== */}
      <Section alt>
        <div className="mx-auto max-w-3xl text-center">
          <Kicker>{t('Capacités', 'Capabilities')}</Kicker>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl" style={{ fontFamily: geist }}>
            {t('Ce que vous obtenez', 'What you get')}
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureRow icon={Network} title={t('Graphe de dépendances', 'Dependency graph')} body={t('Exploration visuelle, recherche et détail par nœud.', 'Visual exploration, search and per-node detail.')} />
          <FeatureRow icon={Gauge} title={t('Moteur de risque explicable', 'Explainable risk engine')} body={t('Score 0–100 décomposé en six facteurs. Pas de boîte noire.', '0–100 score broken into six factors. No black box.')} />
          <FeatureRow icon={FlaskConical} title={t('Simulation What-If', 'What-If simulation')} body={t('Cascade, probabilité, RTO et impact financier.', 'Cascade, probability, RTO and financial impact.')} />
          <FeatureRow icon={Users} title={t('Dépendance humaine', 'Human dependency')} body={t('Facteur de bus et savoir non documenté.', 'Bus factor and undocumented knowledge.')} />
          <FeatureRow icon={FileText} title={t('Intelligence documentaire', 'Document intelligence')} body={t('Extrayez des dépendances depuis vos documents.', 'Extract dependencies from your documents.')} />
          <FeatureRow icon={Bot} title={t('Assistant IA ancré', 'Grounded AI analyst')} body={t('Questions en langage naturel, chiffres jamais inventés.', 'Natural-language questions, numbers never invented.')} />
        </div>
      </Section>

      {/* ===== Confiance ===== */}
      <Section>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <Kicker>{t('Confiance', 'Trust')}</Kicker>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl" style={{ fontFamily: geist }}>
              {t('Vos données, votre contrôle', 'Your data, your control')}
            </h2>
            <ul className="mt-6 flex flex-col gap-4">
              <TrustItem icon={Plug} text={t('Fonctionne par import : vous n’exposez que ce que vous choisissez de partager.', 'Works by import: you only expose what you choose to share.')} />
              <TrustItem icon={Gauge} text={t('Chaque score de risque est explicable, décomposé facteur par facteur.', 'Every risk score is explainable, broken down factor by factor.')} />
              <TrustItem icon={Lock} text={t('Authentification par jeton, espaces isolés par client, mots de passe jamais en clair.', 'Token authentication, per-client isolated workspaces, passwords never in clear text.')} />
              <TrustItem icon={ShieldCheck} text={t('SSO Microsoft Entra ID disponible pour la connexion d’entreprise.', 'Microsoft Entra ID SSO available for enterprise sign-in.')} />
            </ul>
          </div>
          <div className="rounded-xl border p-6" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--nx-border)' }}>
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-outline)' }}>{t('Analyse d’impact', 'Impact analysis')}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: '#f87171' }}>SEV_CRIT</span>
            </div>
            <p className="mt-4" style={{ fontSize: 14, color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
              {t('Compromission d’Entra ID (jeu de démo CGI) :', 'Entra ID compromise (CGI demo dataset):')}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label={t('Pire cas', 'Worst case')} value="1,94 M$" />
              <Stat label={t('Cas attendu', 'Expected')} value="1,70 M$" />
              <Stat label={t('Récupération', 'Recovery')} value="4,9 h" />
            </div>
            <p className="mt-4" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>
              {t('Chiffres dérivés du graphe, pas inventés.', 'Figures derived from the graph, not invented.')}
            </p>
          </div>
        </div>
      </Section>

      {/* ===== CTA final ===== */}
      <section className="px-5 py-20 md:px-10">
        <div className="mx-auto max-w-3xl rounded-2xl border p-10 text-center"
          style={{ borderColor: 'rgba(0,229,255,0.3)', background: 'linear-gradient(135deg, rgba(0,229,255,0.10), transparent)' }}>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ fontFamily: geist }}>
            {t('Voyez vos angles morts dès aujourd’hui', 'See your blind spots today')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: 'var(--nx-text-muted)' }}>
            {t('Créez un espace de travail gratuit, ou explorez le jeu de démo en un clic.', 'Create a free workspace, or explore the demo dataset in one click.')}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate('/login?signup=1')}
              className="flex w-full items-center justify-center gap-2 rounded px-6 py-3 transition-all active:scale-[0.99] sm:w-auto"
              style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', boxShadow: '0 0 20px rgba(0,229,255,0.25)' }}>
              {t('Créer un compte', 'Create an account')} <ArrowRight size={17} />
            </button>
            <button onClick={tryDemo} disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded px-6 py-3 transition-colors hover:brightness-125 disabled:opacity-60 sm:w-auto"
              style={{ border: '1px solid var(--nx-border)', color: 'var(--nx-text)', fontFamily: mono, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <PlayCircle size={17} /> {t('Explorer la démo', 'Explore the demo')}
            </button>
          </div>
        </div>
      </section>

      {/* ===== Pied ===== */}
      <footer className="border-t px-5 py-8 md:px-10" style={{ borderColor: 'var(--nx-border)' }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-sm" style={{ background: CYAN }}>
              <Share2 size={13} strokeWidth={2.4} style={{ color: 'var(--nx-on-cyan)' }} />
            </div>
            <span style={{ fontFamily: geist, fontSize: 14 }}>NEXUS</span>
          </div>
          <p style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-outline)' }}>
            {t('Savoir ce qui casse avant que l’activité n’en pâtisse.', 'Know what breaks before the business does.')}
          </p>
          <a href="/help" onClick={(e) => { e.preventDefault(); navigate('/login') }} style={{ fontSize: 13, color: 'var(--nx-cyan-text)' }}>
            {t('Se connecter', 'Sign in')}
          </a>
        </div>
      </footer>
    </div>
  )
}

// ── Primitives locales ───────────────────────────────────────────────────────
function Section({ children, alt }: { children: React.ReactNode; alt?: boolean }) {
  return (
    <section className="px-5 py-16 md:px-10 md:py-20" style={{ background: alt ? 'var(--nx-surface)' : 'transparent' }}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  )
}
function Kicker({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-cyan-text)' }}>{children}</span>
}
function PainCard({ icon: Icon, title, body }: { icon: typeof Network; title: string; body: string }) {
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <Icon size={22} style={{ color: '#f87171' }} />
      <h3 className="mt-3 text-lg font-medium" style={{ fontFamily: geist }}>{title}</h3>
      <p className="mt-1.5" style={{ fontSize: 14, color: 'var(--nx-text-muted)', lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}
function ValueCard({ icon: Icon, title, body }: { icon: typeof Boxes; title: string; body: string }) {
  return (
    <div className="rounded-lg border p-5 transition-colors hover:brightness-110" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <div className="flex h-10 w-10 items-center justify-center rounded" style={{ background: 'rgba(0,229,255,0.12)' }}>
        <Icon size={20} style={{ color: CYAN }} />
      </div>
      <h3 className="mt-4 text-lg font-medium" style={{ fontFamily: geist }}>{title}</h3>
      <p className="mt-1.5" style={{ fontSize: 14, color: 'var(--nx-text-muted)', lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}
function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border p-6" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 15, fontWeight: 600 }}>{n}</div>
      <h3 className="mt-4 text-lg font-medium" style={{ fontFamily: geist }}>{title}</h3>
      <p className="mt-1.5" style={{ fontSize: 14, color: 'var(--nx-text-muted)', lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}
function FeatureRow({ icon: Icon, title, body }: { icon: typeof Network; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-lg border p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <Icon size={20} style={{ color: CYAN, flexShrink: 0, marginTop: 2 }} />
      <div>
        <h3 className="font-medium" style={{ fontFamily: geist, fontSize: 15 }}>{title}</h3>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{body}</p>
      </div>
    </div>
  )
}
function TrustItem({ icon: Icon, text }: { icon: typeof Plug; text: string }) {
  return (
    <li className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded" style={{ background: 'rgba(0,229,255,0.12)' }}>
        <Icon size={16} style={{ color: CYAN }} />
      </div>
      <span style={{ fontSize: 14, color: 'var(--nx-text-muted)', lineHeight: 1.5, alignSelf: 'center' }}>{text}</span>
    </li>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2 text-center" style={{ borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{value}</div>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--nx-outline)' }}>{label}</div>
    </div>
  )
}
