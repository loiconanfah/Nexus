import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Share2, ArrowRight, ArrowUpRight, PlayCircle, ShieldCheck, Boxes, FlaskConical, Gauge,
  Plug, Bot, Network, TrendingUp, Users, FileText, CheckCircle2, Lock,
  Shield, Server, AlertTriangle, Activity, Briefcase, Landmark, HeartPulse, Building2,
  Factory, Zap, ChevronDown, KeyRound, Scale,
} from 'lucide-react'
import { login } from '../lib/auth'
import { useLang } from '../lib/i18n'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'

// Direction artistique du hero : sombre cinématique, indépendante du thème de l'app.
const INK = '#06070c'

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
    <div className="h-full overflow-y-auto" style={{ background: 'var(--nx-bg)', color: 'var(--nx-text)', fontFamily: 'var(--font-inter)', scrollBehavior: 'smooth' }}>
      <style>{HERO_CSS}</style>

      {/* ══════════════ HERO CINÉMATIQUE ══════════════ */}
      <section className="nx-hero" style={{ background: INK }}>
        <div className="nx-hero-beams" aria-hidden>
          <span className="nx-beam nx-beam-a" />
          <span className="nx-beam nx-beam-b" />
          <span className="nx-beam nx-beam-c" />
          <div className="nx-hero-grid" />
          <div className="nx-hero-vignette" />
          <svg className="nx-hero-net" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <line x1="14%" y1="30%" x2="34%" y2="52%" />
            <line x1="34%" y1="52%" x2="66%" y2="40%" />
            <line x1="66%" y1="40%" x2="86%" y2="66%" />
            <line x1="34%" y1="52%" x2="26%" y2="78%" />
            <circle className="nx-dot" cx="14%" cy="30%" r="2.5" />
            <circle className="nx-dot nx-dot-hot" cx="34%" cy="52%" r="4" style={{ animationDelay: '.6s' }} />
            <circle className="nx-dot" cx="66%" cy="40%" r="3" style={{ animationDelay: '1.1s' }} />
            <circle className="nx-dot nx-dot-hot" cx="86%" cy="66%" r="5" style={{ animationDelay: '.3s' }} />
            <circle className="nx-dot" cx="26%" cy="78%" r="3" style={{ animationDelay: '1.5s' }} />
          </svg>
        </div>

        <header className="nx-hero-nav">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded" style={{ background: CYAN }}>
              <Share2 size={17} strokeWidth={2.4} style={{ color: 'var(--nx-on-cyan)' }} />
            </div>
            <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: geist, color: '#f2f5fa' }}>NEXUS</span>
          </div>

          <nav className="nx-hero-links">
            {[
              ['01', t('Solution', 'Solution'), '#solution'],
              ['02', t('Cas d’usage', 'Use cases'), '#cas'],
              ['03', t('Fonctionnalités', 'Features'), '#detail'],
              ['04', t('Sécurité', 'Security'), '#securite'],
              ['05', t('FAQ', 'FAQ'), '#faq'],
            ].map(([n, label, href]) => (
              <a key={href} href={href}>
                <span className="nx-hero-linknum">{n}</span>{label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded border" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
              {(['fr', 'en'] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} className="px-2 py-1"
                  style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: lang === l ? INK : '#aab4c5', background: lang === l ? CYAN : 'transparent' }}>{l}</button>
              ))}
            </div>
            <button onClick={() => navigate('/login')} className="rounded px-3 py-1.5 transition-colors"
              style={{ fontSize: 13, color: '#e6ebf2', border: '1px solid rgba(255,255,255,0.16)' }}>
              {t('Se connecter', 'Sign in')}
            </button>
          </div>
        </header>

        <div className="nx-hero-body">
          <div className="nx-hero-eyebrow">
            <span className="nx-hero-pulse" />
            {t('Intelligence des dépendances opérationnelles', 'Operational Dependency Intelligence')}
          </div>

          <h1 className="nx-hero-title" style={{ fontFamily: geist }}>
            {t('Sachez ce qui casse', 'Know what breaks')}<br />
            <span className="nx-hero-accent">{t('avant', 'before')}</span> {t('que l’activité n’en pâtisse.', 'the business does.')}
          </h1>

          <p className="nx-hero-sub">
            {t(
              'NEXUS cartographie vos systèmes, fournisseurs et personnes en un graphe de dépendances vivant — puis révèle vos points uniques de défaillance, simule les pannes et en chiffre l’impact.',
              'NEXUS maps your systems, suppliers and people into a living dependency graph — then reveals your single points of failure, simulates outages and quantifies their impact.',
            )}
          </p>

          <div className="nx-hero-cta">
            <button onClick={() => navigate('/login?signup=1')} className="nx-btn-primary">
              {t('Créer un compte', 'Create an account')} <ArrowRight size={17} />
            </button>
            <button onClick={tryDemo} disabled={busy} className="nx-btn-ghost">
              <PlayCircle size={17} /> {busy ? t('Ouverture…', 'Opening…') : t('Explorer la démo', 'Explore the demo')}
            </button>
          </div>
        </div>

        <div className="nx-hero-footer">
          <span>© 2026 — MJ CORP</span>
          <span>MONTRÉAL · QC</span>
          <span className="nx-hero-scroll">{t('DÉFILER', 'SCROLL')} ↓</span>
        </div>
      </section>

      {/* ══════════════ BANDEAU DE PREUVE ══════════════ */}
      <section className="border-y px-5 py-8 md:px-10" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 md:grid-cols-4">
          <Metric value={t('6 facteurs', '6 factors')} label={t('Score de risque explicable', 'Explainable risk score')} />
          <Metric value={t('Multi-niveaux', 'Multi-level')} label={t('Propagation en cascade simulée', 'Simulated cascade propagation')} />
          <Metric value="$ / RTO" label={t('Impact chiffré par panne', 'Quantified impact per outage')} />
          <Metric value={t('FR · EN', 'FR · EN')} label={t('Bilingue, prêt Loi 25 / RGPD', 'Bilingual, Law 25 / GDPR-ready')} />
        </div>
      </section>

      {/* ══════════════ 00 — INTRODUCTION ══════════════ */}
      <section className="px-5 py-24 md:px-10 md:py-32" style={{ background: 'var(--nx-bg)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center gap-3" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-cyan-text)' }}>
            <span style={{ color: 'var(--nx-outline)' }}>00</span>
            <span className="h-px w-8" style={{ background: 'var(--nx-border)' }} />
            {t('Introduction', 'Introduction')}
          </div>
          <p className="max-w-4xl text-2xl font-light leading-snug tracking-tight md:text-4xl" style={{ fontFamily: geist, color: 'var(--nx-text)' }}>
            {t('Tout est connecté. ', 'Everything is connected. ')}
            <span style={{ color: 'var(--nx-text-muted)' }}>
              {t(
                'Un fournisseur, un serveur d’authentification, une seule personne — leur défaillance se propage en silence jusqu’à interrompre l’activité. NEXUS rend cette carte visible, mesurable et actionnable.',
                'A supplier, an auth server, a single person — their failure propagates silently until the business stops. NEXUS makes that map visible, measurable and actionable.',
              )}
            </span>
          </p>
        </div>
      </section>

      {/* ══════════════ 01 — PROBLÈME ══════════════ */}
      <Section id="probleme" alt>
        <SectionHead n="01" kicker={t('Le problème', 'The problem')}
          title={t('Personne ne voit la carte', 'Nobody sees the map')} />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          <PainCard icon={Network} title={t('Dépendances invisibles', 'Invisible dependencies')} body={t('Vous découvrez le lien le jour où il casse.', 'You discover the link the day it breaks.')} />
          <PainCard icon={TrendingUp} title={t('Impact non chiffré', 'Unquantified impact')} body={t('Impossible de prioriser sans connaître le coût réel d’une panne.', 'Impossible to prioritize without knowing the real cost of an outage.')} />
          <PainCard icon={Users} title={t('Facteur humain', 'Human factor')} body={t('Le savoir critique repose parfois sur une seule personne.', 'Critical knowledge sometimes rests on a single person.')} />
        </div>
      </Section>

      {/* ══════════════ 02 — SOLUTION ══════════════ */}
      <Section id="solution">
        <SectionHead n="02" kicker={t('La solution', 'The solution')}
          title={t('Du signal à la décision, une seule plateforme', 'From signal to decision, one platform')} />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <ValueCard icon={Boxes} title={t('Cartographier', 'Map')} body={t('Systèmes, infra, fournisseurs, personnes et processus dans un graphe unique.', 'Systems, infra, suppliers, people and processes in a single graph.')} />
          <ValueCard icon={FlaskConical} title={t('Simuler', 'Simulate')} body={t('Rejouez une panne ou une cyberattaque et voyez la cascade, niveau par niveau.', 'Replay an outage or cyberattack and watch the cascade, level by level.')} />
          <ValueCard icon={Gauge} title={t('Chiffrer', 'Quantify')} body={t('Score de risque explicable et impact financier en devise locale.', 'Explainable risk score and financial impact in local currency.')} />
          <ValueCard icon={CheckCircle2} title={t('Prioriser', 'Prioritize')} body={t('Des recommandations classées, suivies jusqu’à la clôture.', 'Ranked recommendations, tracked to closure.')} />
        </div>
      </Section>

      {/* ══════════════ 03 — CAS D’USAGE ══════════════ */}
      <Section id="cas" alt>
        <SectionHead n="03" kicker={t('Cas d’usage', 'Use cases')}
          title={t('Pensé pour ceux qui portent le risque', 'Built for those who carry the risk')} />
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          <Persona icon={Shield} role={t('RSSI / Sécurité', 'CISO / Security')}
            punch={t('Chiffrez le risque cyber en dollars.', 'Quantify cyber risk in dollars.')}
            body={t('Identifiez les points uniques de défaillance, mesurez le rayon d’impact d’une compromission et priorisez les remédiations par valeur exposée.', 'Identify single points of failure, measure the blast radius of a compromise and prioritize fixes by exposed value.')} />
          <Persona icon={Server} role={t('DSI / IT', 'CIO / IT')}
            punch={t('Cartographiez sans projet à rallonge.', 'Map without an endless project.')}
            body={t('Importez vos données, l’IA en déduit la structure. Un graphe vivant de vos systèmes, infra et fournisseurs, sans accès privilégié requis.', 'Import your data, the AI infers the structure. A living graph of your systems, infra and suppliers, no privileged access required.')} />
          <Persona icon={AlertTriangle} role={t('Risque & continuité', 'Risk & continuity')}
            punch={t('Passez d’un PRA théorique à testé.', 'Go from a theoretical DRP to a tested one.')}
            body={t('Simulez une panne ou une attaque, observez la cascade, obtenez RTO et impact financier — et documentez des scénarios comparables.', 'Simulate an outage or attack, watch the cascade, get RTO and financial impact — and document comparable scenarios.')} />
          <Persona icon={Activity} role={t('Direction / Opérations', 'Leadership / Operations')}
            punch={t('Décidez avec des chiffres, pas des intuitions.', 'Decide with figures, not hunches.')}
            body={t('Testez des décisions concrètes, mesurez leur effet, et générez un rapport exécutif clair pour arbitrer en comité.', 'Test concrete decisions, measure their effect, and generate a clear executive report to arbitrate in committee.')} />
        </div>
      </Section>

      {/* ══════════════ 04 — EN DÉTAIL ══════════════ */}
      <Section id="detail">
        <SectionHead n="04" kicker={t('En détail', 'In depth')}
          title={t('Quatre capacités, une chaîne continue', 'Four capabilities, one continuous chain')} />
        <div className="mt-16 flex flex-col gap-20 md:gap-28">
          <DeepFeature
            tag={t('Cartographie', 'Mapping')} icon={Network}
            title={t('Un graphe de dépendances vivant', 'A living dependency graph')}
            body={t('Systèmes, applications, infrastructures, fournisseurs et personnes dans une seule carte navigable. Recherche instantanée, détail par nœud, mise à jour continue.', 'Systems, applications, infrastructure, suppliers and people in a single navigable map. Instant search, per-node detail, continuous updates.')}
            points={[
              t('Exploration visuelle 2D et 3D', 'Visual 2D and 3D exploration'),
              t('Détection automatique des SPOF', 'Automatic SPOF detection'),
              t('Concentration fournisseurs', 'Supplier concentration'),
            ]}
            visual={<MiniGraph />} />
          <DeepFeature reverse
            tag={t('Risque', 'Risk')} icon={Gauge}
            title={t('Un moteur de risque explicable', 'An explainable risk engine')}
            body={t('Chaque actif reçoit un score de 0 à 100, décomposé en six facteurs. Aucune boîte noire : vous voyez exactement pourquoi un élément est critique.', 'Every asset gets a 0–100 score, broken into six factors. No black box: you see exactly why an element is critical.')}
            points={[
              t('Criticité, propagation, concentration…', 'Criticality, propagation, concentration…'),
              t('Décomposition facteur par facteur', 'Factor-by-factor breakdown'),
              t('Indice de confiance des données', 'Data confidence index'),
            ]}
            visual={<RiskBars />} />
          <DeepFeature
            tag={t('Simulation', 'Simulation')} icon={FlaskConical}
            title={t('Une simulation What-If réaliste', 'A realistic What-If simulation')}
            body={t('Rejouez une panne, une cyberattaque ou une décision. NEXUS calcule la cascade, la probabilité, le RTO par actif et l’impact financier — puis l’IA l’explique.', 'Replay an outage, a cyberattack or a decision. NEXUS computes the cascade, probability, per-asset RTO and financial impact — then the AI explains it.')}
            points={[
              t('Propagation multi-niveaux', 'Multi-level propagation'),
              t('Impact financier chiffré', 'Quantified financial impact'),
              t('Comparaison de scénarios', 'Scenario comparison'),
            ]}
            visual={<ImpactBars />} />
          <DeepFeature reverse
            tag={t('Intelligence', 'Intelligence')} icon={Bot}
            title={t('Un analyste IA ancré sur vos données', 'An AI analyst grounded in your data')}
            body={t('Posez vos questions en langage naturel. L’IA interprète et explique — mais ne calcule jamais les chiffres : ils viennent du graphe, jamais inventés.', 'Ask questions in natural language. The AI interprets and explains — but never computes the numbers: they come from the graph, never invented.')}
            points={[
              t('Questions en français ou anglais', 'Questions in French or English'),
              t('Chiffres dérivés du moteur', 'Figures derived from the engine'),
              t('Bascule automatique vers les règles', 'Automatic fallback to rules'),
            ]}
            visual={<AnalystCard t={t} />} />
        </div>
      </Section>

      {/* ══════════════ 05 — FONCTIONNEMENT ══════════════ */}
      <Section id="fonctionnement" alt>
        <SectionHead n="05" kicker={t('Comment ça marche', 'How it works')}
          title={t('Trois étapes', 'Three steps')} />
        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border md:grid-cols-3" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-border)' }}>
          <StepCard n="01" title={t('Importez', 'Import')} body={t('Fichier, JSON, ou collez des données en vrac : l’IA en déduit la structure. Aucun accès privilégié requis.', 'File, JSON, or paste messy data: the AI infers the structure. No privileged access required.')} />
          <StepCard n="02" title={t('Analysez', 'Analyze')} body={t('NEXUS révèle les points uniques de défaillance, la concentration fournisseurs et le rayon d’impact.', 'NEXUS reveals single points of failure, supplier concentration and blast radius.')} />
          <StepCard n="03" title={t('Décidez', 'Decide')} body={t('Simulez, chiffrez l’impact, et générez un plan d’action et un rapport exécutif.', 'Simulate, quantify impact, and generate an action plan and an executive report.')} />
        </div>
      </Section>

      {/* ══════════════ 06 — CAPACITÉS ══════════════ */}
      <Section>
        <SectionHead n="06" kicker={t('Capacités', 'Capabilities')}
          title={t('Ce que vous obtenez', 'What you get')} />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureRow icon={Network} title={t('Graphe de dépendances', 'Dependency graph')} body={t('Exploration visuelle, recherche et détail par nœud.', 'Visual exploration, search and per-node detail.')} />
          <FeatureRow icon={Gauge} title={t('Moteur de risque explicable', 'Explainable risk engine')} body={t('Score 0–100 décomposé en six facteurs. Pas de boîte noire.', '0–100 score broken into six factors. No black box.')} />
          <FeatureRow icon={FlaskConical} title={t('Simulation What-If', 'What-If simulation')} body={t('Cascade, probabilité, RTO et impact financier.', 'Cascade, probability, RTO and financial impact.')} />
          <FeatureRow icon={Users} title={t('Dépendance humaine', 'Human dependency')} body={t('Facteur de bus et savoir non documenté.', 'Bus factor and undocumented knowledge.')} />
          <FeatureRow icon={FileText} title={t('Intelligence documentaire', 'Document intelligence')} body={t('Extrayez des dépendances depuis vos documents.', 'Extract dependencies from your documents.')} />
          <FeatureRow icon={Bot} title={t('Assistant IA ancré', 'Grounded AI analyst')} body={t('Questions en langage naturel, chiffres jamais inventés.', 'Natural-language questions, numbers never invented.')} />
        </div>
      </Section>

      {/* ══════════════ 07 — SECTEURS ══════════════ */}
      <Section id="secteurs" alt>
        <SectionHead n="07" kicker={t('Secteurs', 'Industries')}
          title={t('Partout où une panne coûte cher', 'Wherever downtime is expensive')} />
        <p className="mt-5 max-w-2xl text-lg" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>
          {t('NEXUS s’adapte à toute organisation dont l’activité dépend d’une chaîne de systèmes, de fournisseurs et de personnes interconnectés.', 'NEXUS fits any organization whose activity depends on a chain of interconnected systems, suppliers and people.')}
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Sector icon={Briefcase} label={t('Services professionnels & TI', 'Professional & IT services')} />
          <Sector icon={Landmark} label={t('Finance & assurance', 'Finance & insurance')} />
          <Sector icon={HeartPulse} label={t('Santé & sciences de la vie', 'Health & life sciences')} />
          <Sector icon={Building2} label={t('Secteur public', 'Public sector')} />
          <Sector icon={Factory} label={t('Manufacture & logistique', 'Manufacturing & logistics')} />
          <Sector icon={Zap} label={t('Énergie & utilities', 'Energy & utilities')} />
        </div>
      </Section>

      {/* ══════════════ 08 — SÉCURITÉ & CONFIANCE ══════════════ */}
      <Section id="securite">
        <SectionHead n="08" kicker={t('Sécurité & conformité', 'Security & compliance')}
          title={t('Vos données, votre contrôle', 'Your data, your control')} />
        <div className="mt-14 grid items-start gap-10 md:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <SecurityItem icon={Plug} title={t('Par import', 'By import')} body={t('Vous n’exposez que ce que vous choisissez de partager.', 'You only expose what you choose to share.')} />
            <SecurityItem icon={Lock} title={t('Espaces isolés', 'Isolated workspaces')} body={t('Un tenant par client, cloisonné de bout en bout.', 'One tenant per client, fully partitioned.')} />
            <SecurityItem icon={KeyRound} title={t('Authentification', 'Authentication')} body={t('Jetons signés, mots de passe hachés, jamais en clair.', 'Signed tokens, hashed passwords, never in clear text.')} />
            <SecurityItem icon={ShieldCheck} title={t('SSO entreprise', 'Enterprise SSO')} body={t('Microsoft Entra ID disponible pour la connexion.', 'Microsoft Entra ID available for sign-in.')} />
            <SecurityItem icon={Gauge} title={t('IA ancrée', 'Grounded AI')} body={t('Les chiffres viennent du graphe, jamais inventés.', 'Figures come from the graph, never invented.')} />
            <SecurityItem icon={Scale} title={t('Loi 25 / RGPD', 'Law 25 / GDPR')} body={t('Conçu pour la souveraineté et la protection des données.', 'Built for data sovereignty and protection.')} />
          </div>
          <div className="rounded-xl border p-6" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--nx-border)' }}>
              <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-outline)' }}>{t('Analyse d’impact', 'Impact analysis')}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: '#e0554b' }}>SEV_CRIT</span>
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

      {/* ══════════════ 09 — FAQ ══════════════ */}
      <Section id="faq" alt>
        <SectionHead n="09" kicker={t('FAQ', 'FAQ')}
          title={t('Questions fréquentes', 'Frequent questions')} />
        <div className="mt-12 mx-auto max-w-3xl">
          <Faq q={t('Faut-il connecter NEXUS à nos systèmes ?', 'Do we need to connect NEXUS to our systems?')}
            a={t('Non. NEXUS fonctionne par import : un fichier, du JSON, ou des données collées en vrac que l’IA structure. Aucun accès privilégié ni intégration profonde n’est requis pour démarrer.', 'No. NEXUS works by import: a file, JSON, or pasted messy data that the AI structures. No privileged access or deep integration is required to start.')} />
          <Faq q={t('L’IA invente-t-elle des chiffres ?', 'Does the AI make up numbers?')}
            a={t('Jamais. Le moteur déterministe calcule les scores et l’impact ; l’IA se contente d’interpréter et d’expliquer. Sans clé IA, NEXUS bascule sur des règles et reste pleinement fonctionnel.', 'Never. The deterministic engine computes scores and impact; the AI only interprets and explains. Without an AI key, NEXUS falls back to rules and stays fully functional.')} />
          <Faq q={t('Nos données sont-elles isolées ?', 'Is our data isolated?')}
            a={t('Oui. Chaque client dispose d’un espace de travail (tenant) cloisonné. Les mots de passe sont hachés, l’authentification repose sur des jetons signés, et le SSO Microsoft Entra ID est disponible.', 'Yes. Each client has a partitioned workspace (tenant). Passwords are hashed, authentication uses signed tokens, and Microsoft Entra ID SSO is available.')} />
          <Faq q={t('Combien de temps pour un premier résultat ?', 'How long to a first result?')}
            a={t('Quelques minutes. Importez un jeu de données, et le graphe, les points de défaillance et les premiers scores de risque apparaissent immédiatement. Un jeu de démo est disponible en un clic.', 'A few minutes. Import a dataset, and the graph, failure points and first risk scores appear immediately. A demo dataset is available in one click.')} />
          <Faq q={t('NEXUS est-il bilingue ?', 'Is NEXUS bilingual?')}
            a={t('Oui, toute l’interface et l’analyse IA fonctionnent en français et en anglais, avec bascule instantanée.', 'Yes, the entire interface and AI analysis work in French and English, with instant switching.')} />
          <Faq q={t('Comment obtenir un prix ?', 'How do we get pricing?')}
            a={t('Créez un espace gratuit pour évaluer NEXUS, ou contactez-nous pour un devis adapté à votre organisation et votre volume de données.', 'Create a free workspace to evaluate NEXUS, or contact us for a quote tailored to your organization and data volume.')} />
        </div>
      </Section>

      {/* ══════════════ CTA FINAL ══════════════ */}
      <section className="nx-cta" style={{ background: INK }}>
        <div className="nx-cta-beam" aria-hidden />
        <div className="relative z-10 mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-4xl font-light tracking-tight md:text-6xl" style={{ fontFamily: geist, color: '#f2f5fa' }}>
            {t('Voyez vos angles morts', 'See your blind spots')}<br />
            <span className="nx-hero-accent">{t('dès aujourd’hui', 'today')}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg" style={{ color: '#aab4c5' }}>
            {t('Créez un espace de travail gratuit, ou explorez le jeu de démo en un clic.', 'Create a free workspace, or explore the demo dataset in one click.')}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate('/login?signup=1')} className="nx-btn-primary">
              {t('Créer un compte', 'Create an account')} <ArrowRight size={17} />
            </button>
            <button onClick={tryDemo} disabled={busy} className="nx-btn-ghost">
              <PlayCircle size={17} /> {t('Explorer la démo', 'Explore the demo')}
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════ PIED ══════════════ */}
      <footer className="border-t px-5 py-10 md:px-10" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-bg)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-sm" style={{ background: CYAN }}>
              <Share2 size={13} strokeWidth={2.4} style={{ color: 'var(--nx-on-cyan)' }} />
            </div>
            <span style={{ fontFamily: geist, fontSize: 14 }}>NEXUS</span>
          </div>
          <p style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-outline)' }}>
            {t('Savoir ce qui casse avant que l’activité n’en pâtisse.', 'Know what breaks before the business does.')}
          </p>
          <button onClick={() => navigate('/login')} className="flex items-center gap-1" style={{ fontSize: 13, color: 'var(--nx-cyan-text)' }}>
            {t('Se connecter', 'Sign in')} <ArrowUpRight size={14} />
          </button>
        </div>
      </footer>
    </div>
  )
}

// ── Primitives locales ───────────────────────────────────────────────────────
function Section({ children, alt, id }: { children: React.ReactNode; alt?: boolean; id?: string }) {
  return (
    <section id={id} className="px-5 py-20 md:px-10 md:py-28" style={{ background: alt ? 'var(--nx-surface)' : 'var(--nx-bg)' }}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  )
}
function SectionHead({ n, kicker, title }: { n: string; kicker: string; title: string }) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--nx-cyan-text)' }}>
        <span style={{ color: 'var(--nx-outline)' }}>{n}</span>
        <span className="h-px w-8" style={{ background: 'var(--nx-border)' }} />
        {kicker}
      </div>
      <h2 className="mt-5 text-3xl font-light tracking-tight md:text-5xl" style={{ fontFamily: geist }}>{title}</h2>
    </div>
  )
}
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-xl font-medium md:text-2xl" style={{ fontFamily: geist, color: 'var(--nx-cyan-text)' }}>{value}</div>
      <div className="mt-1" style={{ fontSize: 12.5, color: 'var(--nx-text-muted)', lineHeight: 1.4 }}>{label}</div>
    </div>
  )
}
function PainCard({ icon: Icon, title, body }: { icon: typeof Network; title: string; body: string }) {
  return (
    <div className="group rounded-xl border p-6 transition-all hover:-translate-y-0.5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, #e0554b 12%, transparent)' }}>
        <Icon size={20} style={{ color: '#e0554b' }} />
      </div>
      <h3 className="mt-4 text-lg font-medium" style={{ fontFamily: geist }}>{title}</h3>
      <p className="mt-1.5" style={{ fontSize: 14, color: 'var(--nx-text-muted)', lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}
function ValueCard({ icon: Icon, title, body }: { icon: typeof Boxes; title: string; body: string }) {
  return (
    <div className="group rounded-xl border p-6 transition-all hover:-translate-y-0.5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: 'var(--nx-cyan)', color: 'var(--nx-on-cyan)' }}>
        <Icon size={21} />
      </div>
      <h3 className="mt-5 text-lg font-medium" style={{ fontFamily: geist }}>{title}</h3>
      <p className="mt-1.5" style={{ fontSize: 14, color: 'var(--nx-text-muted)', lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}
function Persona({ icon: Icon, role, punch, body }: { icon: typeof Shield; role: string; punch: string; body: string }) {
  return (
    <div className="rounded-xl border p-7 transition-all hover:-translate-y-0.5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 14%, transparent)' }}>
          <Icon size={20} style={{ color: 'var(--nx-cyan-text)' }} />
        </div>
        <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--nx-outline)' }}>{role}</span>
      </div>
      <h3 className="mt-5 text-xl font-medium" style={{ fontFamily: geist }}>{punch}</h3>
      <p className="mt-2" style={{ fontSize: 14.5, color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>{body}</p>
    </div>
  )
}
function DeepFeature({ tag, icon: Icon, title, body, points, visual, reverse }:
  { tag: string; icon: typeof Network; title: string; body: string; points: string[]; visual: React.ReactNode; reverse?: boolean }) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
      <div className={reverse ? 'md:order-2' : ''}>
        <div className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-cyan-text)' }}>
          <Icon size={15} /> {tag}
        </div>
        <h3 className="mt-4 text-2xl font-medium tracking-tight md:text-3xl" style={{ fontFamily: geist }}>{title}</h3>
        <p className="mt-3 text-lg" style={{ color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>{body}</p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-2.5" style={{ fontSize: 14.5, color: 'var(--nx-text)' }}>
              <CheckCircle2 size={17} style={{ color: CYAN, flexShrink: 0 }} /> {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? 'md:order-1' : ''}>
        <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)', boxShadow: '0 20px 50px -30px rgba(0,0,0,0.4)' }}>
          {visual}
        </div>
      </div>
    </div>
  )
}
function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="p-8" style={{ background: 'var(--nx-panel)' }}>
      <div className="text-5xl font-extralight tracking-tight md:text-6xl" style={{ fontFamily: geist, color: 'color-mix(in srgb, var(--nx-cyan) 55%, transparent)' }}>{n}</div>
      <h3 className="mt-5 text-xl font-medium" style={{ fontFamily: geist }}>{title}</h3>
      <p className="mt-2" style={{ fontSize: 14, color: 'var(--nx-text-muted)', lineHeight: 1.6 }}>{body}</p>
    </div>
  )
}
function FeatureRow({ icon: Icon, title, body }: { icon: typeof Network; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-xl border p-5 transition-all hover:-translate-y-0.5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <Icon size={20} style={{ color: CYAN, flexShrink: 0, marginTop: 2 }} />
      <div>
        <h3 className="font-medium" style={{ fontFamily: geist, fontSize: 15 }}>{title}</h3>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{body}</p>
      </div>
    </div>
  )
}
function Sector({ icon: Icon, label }: { icon: typeof Briefcase; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-5 transition-all hover:-translate-y-0.5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 12%, transparent)' }}>
        <Icon size={19} style={{ color: 'var(--nx-cyan-text)' }} />
      </div>
      <span className="font-medium" style={{ fontFamily: geist, fontSize: 15.5 }}>{label}</span>
    </div>
  )
}
function SecurityItem({ icon: Icon, title, body }: { icon: typeof Lock; title: string; body: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      <Icon size={19} style={{ color: CYAN }} />
      <h3 className="mt-3 font-medium" style={{ fontFamily: geist, fontSize: 15 }}>{title}</h3>
      <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)', lineHeight: 1.5 }}>{body}</p>
    </div>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5 text-center" style={{ borderColor: 'var(--nx-border)' }}>
      <div style={{ fontFamily: geist, fontSize: 18, color: 'var(--nx-text)' }}>{value}</div>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--nx-outline)' }}>{label}</div>
    </div>
  )
}
function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="nx-faq group border-b" style={{ borderColor: 'var(--nx-border)' }}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5">
        <span className="font-medium" style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{q}</span>
        <ChevronDown size={18} className="nx-faq-chev shrink-0" style={{ color: 'var(--nx-cyan-text)' }} />
      </summary>
      <p className="pb-5 pr-8" style={{ fontSize: 15, color: 'var(--nx-text-muted)', lineHeight: 1.65 }}>{a}</p>
    </details>
  )
}

// ── Visuels des blocs « En détail » ──────────────────────────────────────────
function MiniGraph() {
  return (
    <svg viewBox="0 0 320 200" className="w-full" style={{ height: 'auto' }} role="img" aria-label="Graphe">
      <g stroke="var(--nx-border)" strokeWidth="1.5">
        <line x1="160" y1="100" x2="70" y2="50" /><line x1="160" y1="100" x2="60" y2="150" />
        <line x1="160" y1="100" x2="250" y2="55" /><line x1="160" y1="100" x2="255" y2="150" />
        <line x1="250" y1="55" x2="255" y2="150" />
      </g>
      <g>
        <circle cx="70" cy="50" r="9" fill="var(--nx-surface-high)" stroke="var(--nx-outline)" strokeWidth="1.5" />
        <circle cx="60" cy="150" r="9" fill="var(--nx-surface-high)" stroke="var(--nx-outline)" strokeWidth="1.5" />
        <circle cx="250" cy="55" r="9" fill="var(--nx-surface-high)" stroke="var(--nx-outline)" strokeWidth="1.5" />
        <circle cx="255" cy="150" r="9" fill="var(--nx-surface-high)" stroke="var(--nx-outline)" strokeWidth="1.5" />
        <circle cx="160" cy="100" r="15" fill="var(--nx-cyan)" />
        <circle className="nx-node-pulse" cx="160" cy="100" r="15" fill="none" stroke="var(--nx-cyan)" strokeWidth="2" />
      </g>
      <text x="160" y="138" textAnchor="middle" style={{ fontFamily: mono, fontSize: 10, fill: 'var(--nx-outline)' }}>SPOF</text>
    </svg>
  )
}
function RiskBars() {
  const factors = [['Criticité', 96], ['Propagation', 80], ['Concentration', 80], ['Redondance', 28], ['Détection', 62], ['Confiance', 94]] as const
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--nx-outline)' }}>Score de risque</span>
        <span style={{ fontFamily: geist, fontSize: 30, color: '#e0554b' }}>79<span style={{ fontSize: 14, color: 'var(--nx-outline)' }}>/100</span></span>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {factors.map(([name, v]) => (
          <div key={name} className="flex items-center gap-3">
            <span className="w-24 shrink-0" style={{ fontSize: 12, color: 'var(--nx-text-muted)' }}>{name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--nx-surface-high)' }}>
              <div style={{ width: `${v}%`, height: '100%', borderRadius: 999, background: v > 75 ? '#e0554b' : v > 50 ? '#d9772e' : 'var(--nx-cyan)' }} />
            </div>
            <span className="w-7 text-right" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function ImpactBars() {
  const rows = [['Revenu', 100, 100], ['EBITDA', 100, 64], ['Net', 100, 43], ['Trésor.', 100, 55]] as const
  return (
    <div>
      <div className="mb-3 flex items-center gap-4" style={{ fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--nx-outline)' }} />Actuel</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--nx-cyan)' }} />Simulé</span>
      </div>
      <div className="flex items-end justify-around gap-3" style={{ height: 130 }}>
        {rows.map(([label, a, b]) => (
          <div key={label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex items-end gap-1.5" style={{ height: 100 }}>
              <div style={{ width: 14, height: `${a}%`, borderRadius: '3px 3px 0 0', background: 'var(--nx-surface-highest)' }} />
              <div style={{ width: 14, height: `${b}%`, borderRadius: '3px 3px 0 0', background: 'var(--nx-cyan)' }} />
            </div>
            <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--nx-outline)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function AnalystCard({ t }: { t: (fr: string, en: string) => string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="self-end rounded-2xl rounded-br-sm px-4 py-2.5" style={{ maxWidth: '80%', background: 'var(--nx-cyan)', color: 'var(--nx-on-cyan)', fontSize: 14 }}>
        {t('Quel est l’impact si Entra ID tombe ?', 'What’s the impact if Entra ID goes down?')}
      </div>
      <div className="self-start rounded-2xl rounded-bl-sm border px-4 py-3" style={{ maxWidth: '88%', borderColor: 'var(--nx-border)', background: 'var(--nx-surface)', fontSize: 14, color: 'var(--nx-text)', lineHeight: 1.55 }}>
        <div className="mb-1.5 flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--nx-cyan-text)' }}>
          <Bot size={12} /> {t('Analyste IA', 'AI analyst')}
          <span className="ml-1 rounded px-1.5 py-0.5" style={{ background: 'color-mix(in srgb, var(--nx-cyan) 15%, transparent)', color: 'var(--nx-cyan-text)', fontSize: 9 }}>{t('ANCRÉ', 'GROUNDED')}</span>
        </div>
        {t('8 actifs en dépendent sans redondance. Impact attendu ', '8 assets depend on it without redundancy. Expected impact ')}
        <strong style={{ color: 'var(--nx-text)' }}>1,70 M$</strong>{t(', récupération ', ', recovery ')}<strong style={{ color: 'var(--nx-text)' }}>4,9 h</strong>.
      </div>
    </div>
  )
}

// ── CSS bespoke du hero (injecté, portée locale à la landing) ─────────────────
const HERO_CSS = `
.nx-hero { position: relative; overflow: hidden; min-height: 100svh; display: flex; flex-direction: column; }
.nx-hero-beams { position: absolute; inset: 0; z-index: 0; }
.nx-beam { position: absolute; border-radius: 50%; filter: blur(70px); opacity: .55; mix-blend-mode: screen; will-change: transform; }
.nx-beam-a { width: 90vw; height: 42vh; left: -12vw; top: 8vh;
  background: linear-gradient(115deg, rgba(0,229,255,0) 10%, rgba(0,140,255,.55) 42%, rgba(120,90,255,.65) 60%, rgba(0,229,255,0) 88%);
  transform: rotate(28deg); animation: nxBeamA 18s ease-in-out infinite; }
.nx-beam-b { width: 96vw; height: 40vh; right: -14vw; top: 30vh;
  background: linear-gradient(65deg, rgba(0,229,255,0) 12%, rgba(139,92,246,.5) 44%, rgba(0,180,255,.6) 64%, rgba(0,229,255,0) 90%);
  transform: rotate(-32deg); animation: nxBeamB 22s ease-in-out infinite; }
.nx-beam-c { width: 60vw; height: 26vh; left: 22vw; top: 40vh;
  background: radial-gradient(closest-side, rgba(0,229,255,.35), rgba(0,229,255,0) 72%);
  animation: nxBeamC 12s ease-in-out infinite; }
@keyframes nxBeamA { 0%,100% { transform: translate(-4%,-3%) rotate(26deg) scale(1); } 50% { transform: translate(5%,4%) rotate(32deg) scale(1.12); } }
@keyframes nxBeamB { 0%,100% { transform: translate(3%,2%) rotate(-34deg) scale(1.05); } 50% { transform: translate(-5%,-4%) rotate(-28deg) scale(1.16); } }
@keyframes nxBeamC { 0%,100% { transform: translate(0,0) scale(1); opacity:.5; } 50% { transform: translate(6%,-4%) scale(1.2); opacity:.75; } }

.nx-hero-grid { position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
  background-size: 46px 46px; mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 78%); }
.nx-hero-vignette { position: absolute; inset: 0;
  background: radial-gradient(ellipse 90% 70% at 50% 30%, transparent 40%, rgba(6,7,12,.55) 78%, #06070c 100%); }
.nx-hero-net { position: absolute; inset: 0; width: 100%; height: 100%; }
.nx-hero-net line { stroke: rgba(120,160,200,.22); stroke-width: 1; }
.nx-dot { fill: #9fb2c9; animation: nxDot 4s ease-in-out infinite; }
.nx-dot-hot { fill: #00e5ff; filter: drop-shadow(0 0 6px rgba(0,229,255,.9)); }
@keyframes nxDot { 0%,100% { opacity: .35; } 50% { opacity: 1; } }

.nx-hero-nav { position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 22px 20px; gap: 16px; }
@media (min-width: 768px) { .nx-hero-nav { padding: 26px 40px; } }
.nx-hero-links { display: none; gap: 26px; }
@media (min-width: 900px) { .nx-hero-links { display: flex; } }
.nx-hero-links a { display: inline-flex; align-items: baseline; gap: 7px; font-size: 13.5px; color: #c3ccd8; letter-spacing: .01em; transition: color .18s; }
.nx-hero-links a:hover { color: #fff; }
.nx-hero-linknum { font-family: var(--font-mono); font-size: 10px; color: #00e5ff; opacity: .8; }

.nx-hero-body { position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column; justify-content: center; max-width: 1100px; margin: 0 auto; width: 100%; padding: 40px 24px; }
@media (min-width: 768px) { .nx-hero-body { padding: 40px 40px; } }
.nx-hero-eyebrow { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; border: 1px solid rgba(0,229,255,.28); background: rgba(0,229,255,.07); border-radius: 999px; padding: 6px 13px; font-family: var(--font-mono); font-size: 12px; color: #8fe9f7; margin-bottom: 26px; }
.nx-hero-pulse { width: 6px; height: 6px; border-radius: 50%; background: #00e5ff; box-shadow: 0 0 8px #00e5ff; animation: nxDot 1.8s ease-in-out infinite; }
.nx-hero-title { font-weight: 300; letter-spacing: -.02em; line-height: 1.02; color: #f5f8fc; font-size: clamp(2.6rem, 7.2vw, 6.2rem); }
.nx-hero-accent { background: linear-gradient(100deg, #00e5ff 0%, #7aa2ff 50%, #b18cff 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; font-weight: 400; }
.nx-hero-sub { max-width: 620px; margin-top: 28px; font-size: clamp(1rem, 1.4vw, 1.2rem); line-height: 1.6; color: #aeb9c8; }
.nx-hero-cta { display: flex; flex-direction: column; gap: 12px; margin-top: 40px; }
@media (min-width: 560px) { .nx-hero-cta { flex-direction: row; } }

.nx-btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(100deg, #00e5ff, #5ad4ff); color: #04252b; border-radius: 8px; padding: 13px 24px; font-family: var(--font-mono); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; font-weight: 600; box-shadow: 0 8px 30px rgba(0,229,255,.28); transition: transform .16s, box-shadow .16s; }
.nx-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 12px 40px rgba(0,229,255,.42); }
.nx-btn-primary:active { transform: translateY(0) scale(.99); }
.nx-btn-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid rgba(255,255,255,.2); color: #e6ebf2; border-radius: 8px; padding: 13px 24px; font-family: var(--font-mono); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; background: rgba(255,255,255,.03); transition: background .16s, border-color .16s; }
.nx-btn-ghost:hover { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.34); }
.nx-btn-ghost:disabled { opacity: .6; }

.nx-hero-footer { position: relative; z-index: 10; display: flex; justify-content: space-between; gap: 12px; padding: 18px 24px 26px; font-family: var(--font-mono); font-size: 11px; letter-spacing: .08em; color: #5f6b7d; border-top: 1px solid rgba(255,255,255,.06); flex-wrap: wrap; }
@media (min-width: 768px) { .nx-hero-footer { padding: 18px 40px 30px; } }
.nx-hero-scroll { color: #8b97a8; }

.nx-cta { position: relative; overflow: hidden; padding: 110px 0; }
.nx-cta-beam { position: absolute; inset: 0; background: radial-gradient(ellipse 50% 60% at 50% 120%, rgba(0,229,255,.28), transparent 70%), radial-gradient(ellipse 60% 50% at 20% -10%, rgba(139,92,246,.22), transparent 70%); }

.nx-faq summary::-webkit-details-marker { display: none; }
.nx-faq[open] .nx-faq-chev { transform: rotate(180deg); }
.nx-faq-chev { transition: transform .2s ease; }

@media (prefers-reduced-motion: reduce) {
  .nx-beam-a, .nx-beam-b, .nx-beam-c, .nx-dot, .nx-hero-pulse { animation: none; }
}
`
