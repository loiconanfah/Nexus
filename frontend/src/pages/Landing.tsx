import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Share2, ArrowRight, ArrowUpRight, PlayCircle, ShieldCheck,
  Plug, Bot, CheckCircle2, Lock, Shield, Server, AlertTriangle,
  Activity, Briefcase, Landmark, HeartPulse, Building2, Factory, Zap, ChevronDown, KeyRound,
  Scale, Menu, Network, LineChart, Radar, Users, Workflow, Upload, Boxes, EyeOff,
} from 'lucide-react'
import { useLang } from '../lib/i18n'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'

// Palette SOMBRE fixe (style « Silber AI ») — indépendante du thème de l'app.
// On règle les tokens --nx-* en sombre sur la racine pour que les visuels
// (graphe, barres) rendent correctement en fond noir.
const DARK_VARS: React.CSSProperties = {
  ['--nx-bg' as string]: '#050506',
  ['--nx-panel' as string]: '#0d0d11',
  ['--nx-surface' as string]: '#0a0a0d',
  ['--nx-surface-container' as string]: '#121216',
  ['--nx-surface-high' as string]: '#1b1b21',
  ['--nx-surface-highest' as string]: '#26262e',
  ['--nx-border' as string]: '#26262e',
  ['--nx-outline' as string]: '#6b6b78',
  ['--nx-text' as string]: '#f3f3f6',
  ['--nx-text-muted' as string]: '#a2a2b0',
  ['--nx-cyan' as string]: '#22d3ee',
  ['--nx-cyan-text' as string]: '#7fe8f7',
  ['--nx-on-cyan' as string]: '#070714',
}

export function Landing() {
  const navigate = useNavigate()
  const { lang, setLang, t } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="slb h-full overflow-y-auto" style={{ ...DARK_VARS, background: '#050506', color: '#f3f3f6', fontFamily: 'var(--font-inter)' }}>
      <style>{SILBER_CSS}</style>

      {/* ══════════ NAV ══════════ */}
      <header className="slb-nav">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center" style={{ background: '#22d3ee', clipPath: 'polygon(0 0,100% 0,100% 70%,70% 100%,0 100%)' }}>
            <Share2 size={16} strokeWidth={2.4} style={{ color: '#070714' }} />
          </div>
          <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: geist }}>Lenexus</span>
        </div>
        <nav className="slb-nav-links">
          <a href="#probleme">{t('Le problème', 'Problem')}</a>
          <a href="#fonctionnement">{t('Fonctionnement', 'How it works')}</a>
          <a href="#plateforme">{t('Plateforme', 'Platform')}</a>
          <a href="#secteurs">{t('Secteurs', 'Industries')}</a>
          <a href="/docs" onClick={(e) => { e.preventDefault(); navigate('/docs') }}>Documentation</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <div className="flex items-center border" style={{ borderColor: '#2a2a33' }}>
            {(['fr', 'en'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className="px-2 py-1"
                style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', color: lang === l ? '#070714' : '#a2a2b0', background: lang === l ? '#22d3ee' : 'transparent' }}>{l}</button>
            ))}
          </div>
          <BoxBtn onClick={() => navigate('/login')} label={t('Se connecter', 'Sign in')} small />
          <button className="slb-burger" aria-label="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}><Menu size={18} /></button>
        </div>

        {/* Menu mobile (déroulant sous l'en-tête, < 900px) */}
        {menuOpen && (
          <div className="slb-mobile-menu">
            <a href="#probleme" onClick={() => setMenuOpen(false)}>{t('Le problème', 'Problem')}</a>
            <a href="#fonctionnement" onClick={() => setMenuOpen(false)}>{t('Fonctionnement', 'How it works')}</a>
            <a href="#plateforme" onClick={() => setMenuOpen(false)}>{t('Plateforme', 'Platform')}</a>
            <a href="#secteurs" onClick={() => setMenuOpen(false)}>{t('Secteurs', 'Industries')}</a>
            <a href="/docs" onClick={(e) => { e.preventDefault(); setMenuOpen(false); navigate('/docs') }}>Documentation</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          </div>
        )}
      </header>

      {/* ══════════ HERO ══════════ */}
      <section className="slb-hero">
        <div className="slb-light" aria-hidden>
          <span className="slb-silk slb-silk-1" />
          <span className="slb-silk slb-silk-2" />
          <span className="slb-silk slb-silk-3" />
        </div>
        <div className="slb-grid" aria-hidden />
        <div className="slb-hero-inner">
          <Eyebrow>{t('Intelligence des dépendances opérationnelles', 'Operational Dependency Intelligence')}</Eyebrow>
          <h1 className="slb-h1" style={{ fontFamily: geist }}>
            {t('Sachez ce qui casse', 'Know what breaks')}<br />
            <span className="slb-accent">{t('avant', 'before')}</span> {t('que l’activité n’en pâtisse.', 'the business does.')}
          </h1>
          <p className="slb-sub">
            {t('Lenexus cartographie vos systèmes, fournisseurs et personnes en un graphe vivant, révèle vos points uniques de défaillance, simule les pannes et en chiffre l’impact.',
               'Lenexus maps your systems, suppliers and people into a living graph, reveals your single points of failure, simulates outages and quantifies their impact.')}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <BoxBtn onClick={() => navigate('/login?signup=1')} label={t('Créer un compte', 'Create an account')} primary />
            <BoxBtn onClick={() => navigate('/demo')} label={t('Explorer la démo', 'Explore the demo')} icon={<PlayCircle size={15} />} />
          </div>
        </div>
      </section>

      {/* ══════════ LE PROBLÈME ══════════ */}
      <Section id="probleme" alt>
        <Label>{t('Le problème', 'The problem')}</Label>
        <SectionH>{t('Chaque outil voit son silo. Personne ne voit l’ensemble.', 'Each tool sees its silo. No one sees the whole.')}</SectionH>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: '#a2a2b0', lineHeight: 1.65 }}>
          {t('Votre ERP connaît les fournisseurs, l’ITSM les serveurs, le RH les personnes, votre plateforme IA les modèles et agents. Mais quand un fournisseur tombe, qu’un employé clé part ou qu’un service cloud est compromis, la question — « qu’est-ce qui casse, jusqu’où, et combien ça coûte ? » — traverse tous ces silos. Aucun outil, seul, n’y répond.',
                'Your ERP knows suppliers, your ITSM knows servers, HR knows people, your AI platform knows models and agents. But when a supplier fails, a key person leaves or a cloud service is compromised, the question — “what breaks, how far, and how much does it cost?” — cuts across all those silos. No single tool answers it.')}
        </p>
        <div className="mt-12 grid gap-px sm:grid-cols-3" style={{ background: '#1c1c22' }}>
          <Persona icon={EyeOff} role={t('Angles morts', 'Blind spots')} body={t('Les dépendances transversales (systèmes ↔ fournisseurs ↔ personnes ↔ IA) ne vivent dans aucun outil.', 'Cross-cutting dependencies (systems ↔ suppliers ↔ people ↔ AI) live in no single tool.')} />
          <Persona icon={AlertTriangle} role={t('Surprises coûteuses', 'Costly surprises')} body={t('On découvre un point unique de défaillance le jour où il tombe — pas avant.', 'You discover a single point of failure the day it fails — not before.')} />
          <Persona icon={LineChart} role={t('Décisions à l’aveugle', 'Decisions in the dark')} body={t('Impossible de chiffrer l’impact d’une panne ou d’une décision sans un modèle relié au réel.', 'Impossible to quantify the impact of an outage or a decision without a model tied to reality.')} />
        </div>
      </Section>

      {/* ══════════ L'ESSENTIEL — 3 numéros ══════════ */}
      <Section id="essentiel">
        <Label>{t('L’essentiel', 'The essentials')}</Label>
        <SectionH>{t('Comment Lenexus révèle vos angles morts.', 'How Lenexus reveals your blind spots.')}</SectionH>
        <div className="mt-14 grid gap-px md:grid-cols-3" style={{ background: '#1c1c22' }}>
          <NumCard n="01" tag={t('Cartographie', 'Mapping')} title={t('Cartographier', 'Map')}
            body={t('Systèmes, fournisseurs et personnes dans un graphe unique et navigable.', 'Systems, suppliers and people in a single, navigable graph.')} />
          <NumCard n="02" tag={t('Analyse', 'Analysis')} title={t('Révéler', 'Reveal')}
            body={t('Points uniques de défaillance, concentration fournisseurs et rayon d’impact.', 'Single points of failure, supplier concentration and blast radius.')} />
          <NumCard n="03" tag={t('Décision', 'Decision')} title={t('Chiffrer', 'Quantify')}
            body={t('Impact financier des pannes et décisions, avec un score de risque explicable.', 'Financial impact of outages and decisions, with an explainable risk score.')} />
        </div>
      </Section>

      {/* ══════════ COMMENT ÇA MARCHE ══════════ */}
      <Section id="fonctionnement" alt>
        <Label>{t('Comment ça marche', 'How it works')}</Label>
        <SectionH>{t('Du fichier brut à la décision chiffrée, en cinq temps.', 'From raw file to quantified decision, in five steps.')}</SectionH>
        <div className="mt-14 grid gap-px sm:grid-cols-2 lg:grid-cols-5" style={{ background: '#1c1c22' }}>
          <Step n="1" icon={Upload} title={t('Importer', 'Import')} body={t('CSV, Excel, API REST en direct, ou données collées structurées par l’IA. Aucun accès privilégié.', 'CSV, Excel, live REST API, or pasted data structured by AI. No privileged access.')} />
          <Step n="2" icon={Network} title={t('Cartographier', 'Map')} body={t('Systèmes, fournisseurs, personnes et IA deviennent un graphe unique et navigable.', 'Systems, suppliers, people and AI become a single, navigable graph.')} />
          <Step n="3" icon={Radar} title={t('Révéler', 'Reveal')} body={t('Points uniques de défaillance, concentration et rayon d’impact, avec un score expliqué.', 'Single points of failure, concentration and blast radius, with an explained score.')} />
          <Step n="4" icon={Activity} title={t('Simuler', 'Simulate')} body={t('Rejouez une panne, une cyberattaque ou une décision ; l’impact se propage et se chiffre.', 'Replay an outage, a cyberattack or a decision; the impact propagates and is quantified.')} />
          <Step n="5" icon={LineChart} title={t('Décider', 'Decide')} body={t('Mitigations priorisées et rapport exécutif — des chiffres déterministes, jamais inventés.', 'Prioritized mitigations and an executive report — deterministic figures, never invented.')} />
        </div>
        <div className="mt-10 border p-6 sm:p-8" style={{ borderColor: '#26262e', background: '#0d0d11' }}>
          <div className="flex items-center gap-2" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7fe8f7' }}>
            <PlayCircle size={14} /> {t('Un exemple concret', 'A concrete example')}
          </div>
          <p className="mt-4 text-lg" style={{ color: '#f3f3f6', lineHeight: 1.6 }}>
            {t('« Que se passe-t-il si nous perdons le fournisseur d’identité ? »', '“What happens if we lose the identity provider?”')}
          </p>
          <p className="mt-2 max-w-3xl" style={{ color: '#a2a2b0', fontSize: 15, lineHeight: 1.6 }}>
            {t('Lenexus résout la cible dans le graphe, suit la cascade sur plusieurs niveaux, identifie les 8 actifs qui en dépendent sans redondance, chiffre l’impact à 1,70 M$ avec une reprise de 4,9 h, puis propose les mitigations — et l’IA explique le tout en langage clair.',
                'Lenexus resolves the target in the graph, follows the multi-level cascade, identifies the 8 assets that depend on it without redundancy, quantifies impact at $1.70M with a 4.9 h recovery, then proposes mitigations — and the AI explains it all in plain language.')}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['8 actifs exposés', '1,70 M$', 'RTO 4,9 h', '0 redondance'].map((c) => <Chip key={c}>{c}</Chip>)}
          </div>
        </div>
      </Section>

      {/* ══════════ 01 · SOUS LE CAPOT — risque ══════════ */}
      <Section id="detail">
        <DeepRow tag="01 · " kicker={t('Sous le capot', 'Under the hood')}
          title={t('Un moteur de risque explicable.', 'An explainable risk engine.')}
          body={t('Chaque actif reçoit un score de 0 à 100, décomposé en six facteurs mesurables. Aucune boîte noire : vous voyez exactement pourquoi un élément est critique — et pouvez le justifier en comité.',
                  'Every asset gets a 0–100 score, broken into six measurable factors. No black box: you see exactly why an element is critical — and can justify it in committee.')}
          points={[t('Six facteurs mesurables', 'Six measurable factors'), t('Indice de confiance des données', 'Data confidence index'), t('Zéro chiffre inventé', 'Zero invented numbers')]}
          visual={<RiskBars />} />
      </Section>

      {/* ══════════ 02 · SIMULATION — impact ══════════ */}
      <Section>
        <DeepRow reverse tag="02 · " kicker={t('Simulation', 'Simulation')}
          title={t('Rejouez une panne, mesurez l’impact.', 'Replay an outage, measure the impact.')}
          body={t('Coupez virtuellement un élément ou testez une décision : Lenexus calcule la cascade, le délai de reprise et l’impact financier, puis l’IA l’explique en langage clair.',
                  'Virtually cut an element or test a decision: Lenexus computes the cascade, the recovery time and the financial impact, then the AI explains it in plain language.')}
          points={[t('Propagation multi-niveaux', 'Multi-level propagation'), t('RTO et impact chiffré', 'RTO and quantified impact'), t('Comparaison de scénarios', 'Scenario comparison')]}
          visual={<ImpactBars />} />
        <div className="mt-10 flex flex-wrap gap-2">
          {['Graphe', 'SPOF', 'What-If', 'Kill-chain', 'RTO', 'Impact $', 'Dépendances IA', 'Analyste IA', 'FR · EN'].map((c) => <Chip key={c}>{c}</Chip>)}
        </div>
      </Section>

      {/* ══════════ 03 · CYBER & IA ══════════ */}
      <Section alt>
        <DeepRow tag="03 · " kicker={t('Cyberattaque & IA', 'Cyberattack & AI')}
          title={t('Suivez une attaque — et vos dépendances à l’IA.', 'Trace an attack — and your AI dependencies.')}
          body={t('Rejouez une intrusion qui se propage d’un employé ou d’un outil externe jusqu’à vos agents IA : Lenexus révèle la chaîne de compromission, chiffre l’impact par nœud et évalue chaque contre-mesure. Modèles, agents et fournisseurs d’IA sont des dépendances de premier plan.',
                  'Replay an intrusion spreading from an employee or external tool to your AI agents: Lenexus reveals the compromise chain, quantifies impact per node and scores each countermeasure. AI models, agents and providers are first-class dependencies.')}
          points={[t('Kill-chain expliquée par l’IA', 'AI-explained kill-chain'), t('Impact et contre-mesure par nœud', 'Per-node impact and countermeasure'), t('« OpenAI tombe » → cascade chiffrée', '“OpenAI goes down” → quantified cascade')]}
          visual={<KillChain />} />
      </Section>

      {/* ══════════ LA PLATEFORME COMPLÈTE ══════════ */}
      <Section id="plateforme">
        <Label>{t('La plateforme', 'The platform')}</Label>
        <SectionH>{t('Tout ce que Lenexus fait, en un seul endroit.', 'Everything Lenexus does, in one place.')}</SectionH>
        <p className="mt-6 max-w-3xl text-lg" style={{ color: '#a2a2b0', lineHeight: 1.6 }}>
          {t('Une couche d’intelligence au-dessus de vos systèmes — pas un remplaçant. Voici les capacités, du graphe à la décision.',
              'An intelligence layer above your systems — not a replacement. Here are the capabilities, from graph to decision.')}
        </p>
        <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <CapCard icon={Network} title={t('Cartographie & graphe', 'Mapping & graph')} items={[
            t('Graphe de dépendances 2D et hologramme 3D', '2D dependency graph and 3D hologram'),
            t('Exploration des dépendances directes & transitives', 'Direct & transitive dependency exploration'),
            t('Résolution d’entités entre sources', 'Cross-source entity resolution'),
          ]} />
          <CapCard icon={AlertTriangle} title={t('Analyse de risque', 'Risk analysis')} items={[
            t('Score de risque 0–100 en six facteurs', '0–100 risk score across six factors'),
            t('Points uniques de défaillance (SPOF)', 'Single points of failure (SPOF)'),
            t('Alerte anticipée & impact de changement', 'Early warning & change impact'),
          ]} />
          <CapCard icon={Activity} title={t('Impact & simulation', 'Impact & simulation')} items={[
            t('Impact transversal en langage naturel', 'Cross-cutting impact in natural language'),
            t('Simulation holographique — 10 types de panne', 'Holographic simulation — 10 outage types'),
            t('Cyberattaque : kill-chain & contre-mesures', 'Cyberattack: kill-chain & countermeasures'),
          ]} />
          <CapCard icon={Building2} title={t('Décision & finance', 'Decision & finance')} items={[
            t('Modèle d’entreprise éditable (P&L, trésorerie, KPIs)', 'Editable enterprise model (P&L, cash, KPIs)'),
            t('Décision en langage naturel → impact chiffré', 'Natural-language decision → quantified impact'),
            t('Historique versionné & rapports exécutifs', 'Versioned history & executive reports'),
          ]} />
          <CapCard icon={Users} title={t('Résilience', 'Resilience')} items={[
            t('Concentration & criticité des fournisseurs', 'Supplier concentration & criticality'),
            t('Dépendances humaines (« bus factor »)', 'Human dependencies (“bus factor”)'),
            t('Plan d’action priorisé', 'Prioritized action plan'),
          ]} />
          <CapCard icon={Bot} title={t('IA & connaissance', 'AI & knowledge')} items={[
            t('Analyste IA ancré sur le graphe', 'Graph-grounded AI analyst'),
            t('Dépendances inférées à valider (le moat)', 'Inferred dependencies to validate (the moat)'),
            t('Extraction depuis documents · dépendances IA', 'Document extraction · AI dependencies'),
          ]} />
          <CapCard icon={Plug} title={t('Données & intégration', 'Data & integration')} items={[
            t('CSV / Excel · API REST JSON en direct', 'CSV / Excel · live REST JSON API'),
            t('Import assisté par IA · webhook / MCP', 'AI-assisted import · webhook / MCP'),
            t('Lecture seule par défaut, anti-SSRF', 'Read-only by default, anti-SSRF'),
          ]} />
          <CapCard icon={Shield} title={t('Sécurité & isolation', 'Security & isolation')} items={[
            t('Espaces clients isolés (multi-tenant)', 'Isolated client workspaces (multi-tenant)'),
            t('SSO Entra ID · jetons signés · mots de passe hachés', 'Entra ID SSO · signed tokens · hashed passwords'),
            t('Quota IA par tenant · Loi 25 / RGPD', 'Per-tenant AI quota · Law 25 / GDPR'),
          ]} />
          <CapCard icon={Workflow} title={t('Déterministe + IA', 'Deterministic + AI')} items={[
            t('Tous les chiffres calculés, traçables', 'All figures computed, traceable'),
            t('L’IA résout, reformule, explique — jamais n’invente', 'AI resolves, rephrases, explains — never invents'),
            t('Sans clé IA, tout reste fonctionnel', 'Without an AI key, everything still works'),
          ]} />
        </div>
        <div className="mt-8 flex justify-center">
          <BoxBtn onClick={() => navigate('/docs')} label={t('Lire la documentation complète', 'Read the full documentation')} icon={<Boxes size={15} />} />
        </div>
      </Section>

      {/* ══════════ STAT ══════════ */}
      <section className="slb-stat">
        <div className="slb-light slb-light-soft" aria-hidden><span className="slb-silk slb-silk-2" /></div>
        <div className="relative z-10 mx-auto max-w-6xl px-6 text-center">
          <Label center>{t('Chiffrez l’impact', 'Quantify the impact')}</Label>
          <div className="slb-stat-num" style={{ fontFamily: geist }}>1,70 M$</div>
          <p className="mx-auto mt-3 max-w-xl" style={{ color: '#a2a2b0', fontSize: 15 }}>
            {t('Impact attendu d’une compromission du fournisseur d’identité (jeu de démo CGI) : 8 actifs en dépendent sans redondance, reprise 4,9 h.',
               'Expected impact of an identity-provider compromise (CGI demo dataset): 8 assets depend on it without redundancy, 4.9 h recovery.')}
          </p>
        </div>
      </section>

      {/* ══════════ POUR QUI (remplace témoignages) ══════════ */}
      <Section alt>
        <Label>{t('Pour qui', 'Who it’s for')}</Label>
        <SectionH>{t('Pensé pour ceux qui portent le risque.', 'Built for those who carry the risk.')}</SectionH>
        <div className="mt-14 grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: '#1c1c22' }}>
          <Persona icon={Shield} role={t('RSSI / Sécurité', 'CISO / Security')} body={t('Chiffrez le risque cyber en dollars et priorisez par valeur exposée.', 'Quantify cyber risk in dollars and prioritize by exposed value.')} />
          <Persona icon={Server} role={t('DSI / IT', 'CIO / IT')} body={t('Cartographiez sans projet à rallonge, par simple import.', 'Map without an endless project, by simple import.')} />
          <Persona icon={AlertTriangle} role={t('Risque & continuité', 'Risk & continuity')} body={t('Passez d’un PRA théorique à testé : cascade, RTO, scénarios.', 'Go from a theoretical DRP to a tested one: cascade, RTO, scenarios.')} />
          <Persona icon={Activity} role={t('Direction / Ops', 'Leadership / Ops')} body={t('Décidez avec des chiffres et un rapport exécutif clair.', 'Decide with figures and a clear executive report.')} />
        </div>
      </Section>

      {/* ══════════ SÉCURITÉ (remplace blog) ══════════ */}
      <Section id="secteurs">
        <Label>{t('Secteurs & sécurité', 'Industries & security')}</Label>
        <SectionH>{t('Partout où une panne coûte cher — et vos données restent chez vous.', 'Wherever downtime is costly — and your data stays yours.')}</SectionH>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Sector icon={Briefcase} label={t('Services professionnels & TI', 'Professional & IT services')} />
          <Sector icon={Landmark} label={t('Finance & assurance', 'Finance & insurance')} />
          <Sector icon={HeartPulse} label={t('Santé & sciences de la vie', 'Health & life sciences')} />
          <Sector icon={Building2} label={t('Secteur public', 'Public sector')} />
          <Sector icon={Factory} label={t('Manufacture & logistique', 'Manufacturing & logistics')} />
          <Sector icon={Zap} label={t('Énergie & utilities', 'Energy & utilities')} />
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Sec icon={Plug} title={t('Par import', 'By import')} body={t('Vous n’exposez que ce que vous choisissez.', 'You only expose what you choose.')} />
          <Sec icon={Lock} title={t('Espaces isolés', 'Isolated workspaces')} body={t('Un tenant cloisonné par client.', 'One partitioned tenant per client.')} />
          <Sec icon={KeyRound} title={t('Authentification', 'Authentication')} body={t('Jetons signés, mots de passe hachés.', 'Signed tokens, hashed passwords.')} />
          <Sec icon={ShieldCheck} title={t('SSO entreprise', 'Enterprise SSO')} body={t('Microsoft Entra ID disponible.', 'Microsoft Entra ID available.')} />
          <Sec icon={Bot} title={t('IA ancrée', 'Grounded AI')} body={t('Les chiffres viennent du graphe.', 'Figures come from the graph.')} />
          <Sec icon={Scale} title={t('Loi 25 / RGPD', 'Law 25 / GDPR')} body={t('Souveraineté et protection des données.', 'Data sovereignty and protection.')} />
        </div>
      </Section>

      {/* ══════════ FAQ ══════════ */}
      <Section id="faq" alt>
        <Label>FAQ</Label>
        <SectionH>{t('Questions fréquentes.', 'Frequent questions.')}</SectionH>
        <div className="mt-10 mx-auto max-w-3xl">
          <Faq q={t('Faut-il connecter Lenexus à nos systèmes ?', 'Do we need to connect Lenexus to our systems?')}
            a={t('Non. Lenexus fonctionne par import : fichier, JSON ou données collées que l’IA structure. Aucun accès privilégié requis.', 'No. Lenexus works by import: file, JSON or pasted data the AI structures. No privileged access required.')} />
          <Faq q={t('L’IA invente-t-elle des chiffres ?', 'Does the AI make up numbers?')}
            a={t('Jamais. Le moteur déterministe calcule ; l’IA interprète et explique. Sans clé, Lenexus bascule sur des règles et reste fonctionnel.', 'Never. The deterministic engine computes; the AI interprets and explains. Without a key, Lenexus falls back to rules and stays functional.')} />
          <Faq q={t('Nos données sont-elles isolées ?', 'Is our data isolated?')}
            a={t('Oui. Un espace de travail cloisonné par client, mots de passe hachés, SSO Entra ID disponible.', 'Yes. A partitioned workspace per client, hashed passwords, Entra ID SSO available.')} />
          <Faq q={t('Peut-on modéliser nos dépendances à l’IA et rejouer une cyberattaque ?', 'Can we model our AI dependencies and replay a cyberattack?')}
            a={t('Oui. Modèles, agents et fournisseurs d’IA sont des dépendances de premier plan ; et la simulation de cyberattaque suit une chaîne de compromission avec impact et contre-mesure par nœud.', 'Yes. AI models, agents and providers are first-class dependencies; and the cyberattack simulation traces a compromise chain with per-node impact and countermeasure.')} />
          <Faq q={t('Combien de temps pour un premier résultat ?', 'How long to a first result?')}
            a={t('Quelques minutes : importez un jeu de données et le graphe, les points de défaillance et les scores apparaissent. Un jeu de démo est disponible en un clic.', 'A few minutes: import a dataset and the graph, failure points and scores appear. A demo dataset is available in one click.')} />
        </div>
      </Section>

      {/* ══════════ CTA FINAL ══════════ */}
      <section className="slb-cta">
        <div className="slb-light" aria-hidden><span className="slb-silk slb-silk-1" /><span className="slb-silk slb-silk-3" /></div>
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <h2 className="slb-h1" style={{ fontFamily: geist, fontSize: 'clamp(2.2rem,5vw,4.2rem)' }}>
            {t('Voyez vos angles morts', 'See your blind spots')}<br /><span className="slb-accent">{t('dès aujourd’hui.', 'today.')}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl" style={{ color: '#a2a2b0', fontSize: 16 }}>
            {t('Créez un espace gratuit, ou explorez le jeu de démo en un clic.', 'Create a free workspace, or explore the demo dataset in one click.')}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <BoxBtn onClick={() => navigate('/login?signup=1')} label={t('Créer un compte', 'Create an account')} primary />
            <BoxBtn onClick={() => navigate('/demo')} label={t('Explorer la démo', 'Explore the demo')} icon={<PlayCircle size={15} />} />
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="border-t px-6 py-10" style={{ borderColor: '#1c1c22' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Share2 size={15} style={{ color: '#22d3ee' }} />
            <span style={{ fontFamily: geist, fontSize: 14 }}>Lenexus</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: '#6b6b78' }}>· MJ Corp</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ fontFamily: mono, fontSize: 11 }}>
            <a href="/docs" onClick={(e) => { e.preventDefault(); navigate('/docs') }} style={{ color: '#8a8a98' }}>Documentation</a>
            <a href="/legal?doc=terms" onClick={(e) => { e.preventDefault(); navigate('/legal?doc=terms') }} style={{ color: '#8a8a98' }}>{t('Conditions', 'Terms')}</a>
            <a href="/legal?doc=privacy" onClick={(e) => { e.preventDefault(); navigate('/legal?doc=privacy') }} style={{ color: '#8a8a98' }}>{t('Confidentialité', 'Privacy')}</a>
            <a href="/legal?doc=dpa" onClick={(e) => { e.preventDefault(); navigate('/legal?doc=dpa') }} style={{ color: '#8a8a98' }}>DPA</a>
            <button onClick={() => navigate('/login')} className="flex items-center gap-1" style={{ color: '#7fe8f7' }}>{t('Se connecter', 'Sign in')} <ArrowUpRight size={14} /></button>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Primitives « Silber » ─────────────────────────────────────────────────────
function BoxBtn({ label, onClick, primary, small, icon }: { label: string; onClick?: () => void; primary?: boolean; small?: boolean; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`slb-btn ${primary ? 'slb-btn-primary' : ''} ${small ? 'slb-btn-sm' : ''}`}>
      <span className="slb-btn-label">{icon}{label}</span>
      <span className="slb-btn-arrow"><ArrowRight size={small ? 13 : 15} /></span>
    </button>
  )
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="slb-eyebrow"><span className="slb-eyebrow-mark">▸</span>{children}</div>
}
function Section({ children, alt, id }: { children: React.ReactNode; alt?: boolean; id?: string }) {
  return <section id={id} className="px-6 py-20 md:py-28" style={{ background: alt ? '#08080b' : '#050506' }}><div className="mx-auto max-w-6xl">{children}</div></section>
}
function Label({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <div className={`slb-label ${center ? 'mx-auto' : ''}`}>{children}</div>
}
function SectionH({ children }: { children: React.ReactNode }) {
  return <h2 className="slb-h2" style={{ fontFamily: geist }}>{children}</h2>
}
function NumCard({ n, tag, title, body }: { n: string; tag: string; title: string; body: string }) {
  return (
    <div className="slb-numcard">
      <div className="flex items-start justify-between">
        <span className="slb-numcard-tag">{tag}</span>
        <span className="slb-numcard-n" style={{ fontFamily: geist }}>{n}</span>
      </div>
      <h3 className="mt-8 text-2xl font-medium" style={{ fontFamily: geist }}>{title}</h3>
      <p className="mt-2" style={{ fontSize: 14, color: '#a2a2b0', lineHeight: 1.6 }}>{body}</p>
    </div>
  )
}
function DeepRow({ tag, kicker, title, body, points, visual, reverse }:
  { tag: string; kicker: string; title: string; body: string; points: string[]; visual: React.ReactNode; reverse?: boolean }) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div className={reverse ? 'md:order-2' : ''}>
        <Label><span style={{ color: '#22d3ee' }}>{tag}</span>{kicker}</Label>
        <h3 className="slb-h2" style={{ fontFamily: geist }}>{title}</h3>
        <p className="mt-4 text-lg" style={{ color: '#a2a2b0', lineHeight: 1.6 }}>{body}</p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {points.map((p) => <li key={p} className="flex items-center gap-2.5" style={{ fontSize: 14.5, color: '#f3f3f6' }}><CheckCircle2 size={16} style={{ color: '#22d3ee', flexShrink: 0 }} /> {p}</li>)}
        </ul>
      </div>
      <div className={reverse ? 'md:order-1' : ''}>
        <div className="border p-5" style={{ borderColor: '#1c1c22', background: '#0d0d11' }}>{visual}</div>
      </div>
    </div>
  )
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="slb-chip">{children}</span>
}
function Persona({ icon: Icon, role, body }: { icon: typeof Shield; role: string; body: string }) {
  return (
    <div className="slb-cell">
      <Icon size={22} style={{ color: '#22d3ee' }} />
      <h3 className="mt-4 text-lg font-medium" style={{ fontFamily: geist }}>{role}</h3>
      <p className="mt-1.5" style={{ fontSize: 13.5, color: '#a2a2b0', lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}
function Sector({ icon: Icon, label }: { icon: typeof Briefcase; label: string }) {
  return (
    <div className="flex items-center gap-3 border p-5" style={{ borderColor: '#1c1c22', background: '#0d0d11' }}>
      <Icon size={19} style={{ color: '#7fe8f7' }} />
      <span className="font-medium" style={{ fontFamily: geist, fontSize: 15 }}>{label}</span>
    </div>
  )
}
function Sec({ icon: Icon, title, body }: { icon: typeof Lock; title: string; body: string }) {
  return (
    <div className="border p-5" style={{ borderColor: '#1c1c22', background: '#0d0d11' }}>
      <Icon size={18} style={{ color: '#22d3ee' }} />
      <h3 className="mt-3 font-medium" style={{ fontFamily: geist, fontSize: 15 }}>{title}</h3>
      <p className="mt-1" style={{ fontSize: 13, color: '#a2a2b0', lineHeight: 1.5 }}>{body}</p>
    </div>
  )
}
function Step({ n, icon: Icon, title, body }: { n: string; icon: typeof Network; title: string; body: string }) {
  return (
    <div className="slb-cell">
      <div className="flex items-center justify-between">
        <Icon size={20} style={{ color: '#22d3ee' }} />
        <span style={{ fontFamily: geist, fontSize: 26, fontWeight: 300, color: '#2f2f3a' }}>{n}</span>
      </div>
      <h3 className="mt-5 text-lg font-medium" style={{ fontFamily: geist }}>{title}</h3>
      <p className="mt-1.5" style={{ fontSize: 13, color: '#a2a2b0', lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}
function CapCard({ icon: Icon, title, items }: { icon: typeof Network; title: string; items: string[] }) {
  return (
    <div className="border p-5" style={{ borderColor: '#1c1c22', background: '#0d0d11' }}>
      <div className="flex items-center gap-2.5">
        <Icon size={19} style={{ color: '#22d3ee' }} />
        <h3 className="font-medium" style={{ fontFamily: geist, fontSize: 16 }}>{title}</h3>
      </div>
      <ul className="mt-3.5 flex flex-col gap-2">
        {items.map((it) => (
          <li key={it} className="flex gap-2" style={{ fontSize: 13, color: '#a2a2b0', lineHeight: 1.5 }}>
            <CheckCircle2 size={14} style={{ color: '#22d3ee', flexShrink: 0, marginTop: 2 }} /> <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="slb-faq border-b" style={{ borderColor: '#1c1c22' }}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5">
        <span className="font-medium" style={{ fontFamily: geist, fontSize: 17 }}>{q}</span>
        <ChevronDown size={18} className="slb-faq-chev shrink-0" style={{ color: '#22d3ee' }} />
      </summary>
      <p className="pb-5 pr-8" style={{ fontSize: 15, color: '#a2a2b0', lineHeight: 1.65 }}>{a}</p>
    </details>
  )
}

// ── Visuels réutilisés (tokens --nx-* réglés en sombre sur la racine) ─────────
function RiskBars() {
  const factors = [['Criticité', 96], ['Propagation', 80], ['Concentration', 80], ['Redondance', 28], ['Détection', 62], ['Confiance', 94]] as const
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b6b78' }}>Score de risque</span>
        <span style={{ fontFamily: geist, fontSize: 30, color: '#d15b54' }}>79<span style={{ fontSize: 14, color: '#6b6b78' }}>/100</span></span>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {factors.map(([name, v]) => (
          <div key={name} className="flex items-center gap-3">
            <span className="w-24 shrink-0" style={{ fontSize: 12, color: '#a2a2b0' }}>{name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: '#1b1b21' }}>
              <div style={{ width: `${v}%`, height: '100%', borderRadius: 999, background: v > 75 ? '#d15b54' : v > 50 ? '#e0a458' : '#22d3ee' }} />
            </div>
            <span className="w-7 text-right" style={{ fontFamily: mono, fontSize: 11, color: '#6b6b78' }}>{v}</span>
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
      <div className="mb-3 flex items-center gap-4" style={{ fontFamily: mono, fontSize: 11, color: '#6b6b78' }}>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#3a3a44' }} />Actuel</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#22d3ee' }} />Simulé</span>
      </div>
      <div className="flex items-end justify-around gap-3" style={{ height: 130 }}>
        {rows.map(([label, a, b]) => (
          <div key={label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex items-end gap-1.5" style={{ height: 100 }}>
              <div style={{ width: 14, height: `${a}%`, borderRadius: '3px 3px 0 0', background: '#2a2a33' }} />
              <div style={{ width: 14, height: `${b}%`, borderRadius: '3px 3px 0 0', background: '#22d3ee' }} />
            </div>
            <span style={{ fontFamily: mono, fontSize: 10, color: '#6b6b78' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function KillChain() {
  const steps = [
    ['Employé', 'Hameçonnage', '#e0a458'],
    ['Outil externe', 'Jeton volé', '#e0a458'],
    ['Partage cloud', 'Accès latéral', '#d15b54'],
    ['Agent IA', 'Exfiltration', '#d15b54'],
  ] as const
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b6b78' }}>Chaîne de compromission</span>
        <span style={{ fontFamily: geist, fontSize: 22, color: '#d15b54' }}>4,75 M$</span>
      </div>
      <div className="flex flex-col gap-2">
        {steps.map(([node, act, col], i) => (
          <div key={node}>
            <div className="flex items-center gap-3 border px-3 py-2.5" style={{ borderColor: '#26262e', background: '#0a0a0d' }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ fontFamily: mono, fontSize: 11, color: '#070714', background: col }}>{i + 1}</span>
              <span className="flex-1" style={{ fontSize: 13.5, color: '#f3f3f6' }}>{node}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: col }}>{act}</span>
            </div>
            {i < steps.length - 1 && <div className="ml-3 h-3 w-px" style={{ background: '#3a3a44' }} />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2" style={{ fontFamily: mono, fontSize: 11, color: '#6b6b78' }}>
        <ShieldCheck size={13} style={{ color: '#22d3ee' }} /> Isoler le partage cloud → ~4 M$ évités
      </div>
    </div>
  )
}

// ── CSS bespoke (style Silber AI) ─────────────────────────────────────────────
const SILBER_CSS = `
.slb { scroll-behavior: smooth; }
.slb a { color: inherit; }

.slb-nav { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px; gap: 16px; background: rgba(5,5,6,.72); backdrop-filter: blur(10px); border-bottom: 1px solid #14141a; }
.slb-nav-links { display: none; gap: 28px; font-size: 13.5px; color: #c8c8d2; }
@media (min-width: 900px) { .slb-nav-links { display: flex; } }
.slb-nav-links a:hover { color: #fff; }
.slb-burger { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid #2a2a33; color: #c8c8d2; }
@media (min-width: 900px) { .slb-burger { display: none; } }
.slb-mobile-menu { position: absolute; top: 100%; left: 0; right: 0; display: flex; flex-direction: column; padding: 8px 20px 16px; background: #0b0b12; border-bottom: 1px solid #2a2a33; box-shadow: 0 12px 24px rgba(0,0,0,0.4); }
.slb-mobile-menu a { padding: 11px 2px; font-size: 15px; color: #d5d5df; border-bottom: 1px solid #17171f; }
.slb-mobile-menu a:hover { color: #fff; }
@media (min-width: 900px) { .slb-mobile-menu { display: none; } }

/* Boutons encadres a deux parties (label | fleche) facon Silber */
.slb-btn { display: inline-flex; align-items: stretch; border: 1px solid #2e2e38; background: #0f0f14; color: #f3f3f6; }
.slb-btn-label { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; font-family: var(--font-mono); font-size: 12.5px; letter-spacing: .04em; text-transform: uppercase; }
.slb-btn-arrow { display: inline-flex; align-items: center; padding: 0 12px; border-left: 1px solid #2e2e38; color: #7fe8f7; transition: background .16s; }
.slb-btn:hover .slb-btn-arrow { background: #17171f; }
.slb-btn-primary { background: #22d3ee; border-color: #22d3ee; color: #070714; }
.slb-btn-primary .slb-btn-arrow { border-left-color: rgba(7,7,20,.25); color: #070714; }
.slb-btn-primary:hover .slb-btn-arrow { background: rgba(7,7,20,.12); }
.slb-btn-sm .slb-btn-label { padding: 8px 12px; font-size: 11px; }
.slb-btn-sm .slb-btn-arrow { padding: 0 8px; }

/* Eyebrow encadre */
.slb-eyebrow { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; border: 1px solid #2a2a33;
  padding: 6px 12px; font-family: var(--font-mono); font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: #b9b9c6; margin-bottom: 26px; }
.slb-eyebrow-mark { color: #8a6bff; }

/* Label de section */
.slb-label { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #2a2a33; padding: 5px 11px;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #7fe8f7; }

.slb-h1 { font-weight: 600; letter-spacing: -.03em; line-height: 1.02; color: #fbfbfe; font-size: clamp(2.6rem, 7.4vw, 6.4rem); }
.slb-accent { background: linear-gradient(100deg, #22d3ee 0%, #0aa5bd 60%, #7fe8f7 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.slb-h2 { margin-top: 20px; font-weight: 600; letter-spacing: -.02em; line-height: 1.06; color: #f7f7fb; font-size: clamp(1.9rem, 3.6vw, 3.2rem); max-width: 22ch; }
.slb-sub { max-width: 620px; margin-top: 26px; font-size: clamp(1rem, 1.3vw, 1.18rem); line-height: 1.6; color: #a2a2b0; }

/* HERO */
.slb-hero { position: relative; overflow: hidden; min-height: 92vh; display: flex; align-items: center; background: #050506; }
.slb-hero-inner { position: relative; z-index: 10; width: 100%; max-width: 1180px; margin: 0 auto; padding: 40px 24px; display: flex; flex-direction: column; }
.slb-grid { position: absolute; inset: 0; z-index: 1;
  background-image: linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 12.5% 100%;
  mask-image: linear-gradient(180deg, #000 0%, transparent 85%); }

/* Vague de lumiere liquide bleu/violet */
.slb-light { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
.slb-silk { position: absolute; border-radius: 50%; filter: blur(80px); mix-blend-mode: screen; will-change: transform; opacity: .8; }
.slb-silk-1 { width: 120vw; height: 60vh; left: -10vw; bottom: -22vh;
  background: linear-gradient(120deg, rgba(34,211,238,0) 8%, rgba(34,211,238,.5) 38%, rgba(10,165,189,.6) 62%, rgba(34,211,238,0) 92%);
  transform: rotate(-8deg); animation: slbSilk1 20s ease-in-out infinite; }
.slb-silk-2 { width: 90vw; height: 50vh; right: -12vw; bottom: -10vh;
  background: radial-gradient(closest-side, rgba(34,211,238,.42), rgba(34,211,238,0) 72%); animation: slbSilk2 16s ease-in-out infinite; }
.slb-silk-3 { width: 70vw; height: 40vh; left: 30vw; bottom: -18vh;
  background: linear-gradient(80deg, rgba(127,232,247,0) 12%, rgba(34,211,238,.4) 50%, rgba(127,232,247,0) 88%); animation: slbSilk3 24s ease-in-out infinite; }
@keyframes slbSilk1 { 0%,100% { transform: translate(0,0) rotate(-8deg) scale(1); } 50% { transform: translate(4%,-4%) rotate(-4deg) scale(1.12); } }
@keyframes slbSilk2 { 0%,100% { transform: translate(0,0) scale(1); opacity:.7; } 50% { transform: translate(-6%,-3%) scale(1.18); opacity:.9; } }
@keyframes slbSilk3 { 0%,100% { transform: translate(0,0) scale(1.05); } 50% { transform: translate(6%,-5%) scale(1.2); } }
.slb-light-soft .slb-silk { opacity: .45; }

/* Cartes numerotees */
.slb-numcard { background: #050506; padding: 34px 26px; }
.slb-numcard-tag { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #6b6b78; }
.slb-numcard-n { font-size: 46px; font-weight: 300; color: #2f2f3a; line-height: 1; }

/* Cellule (persona) */
.slb-cell { background: #050506; padding: 30px 24px; }

/* Chips */
.slb-chip { border: 1px solid #26262e; padding: 6px 12px; font-family: var(--font-mono); font-size: 11.5px; color: #b9b9c6; }

/* STAT */
.slb-stat { position: relative; overflow: hidden; padding: 120px 0; background: #050506; }
.slb-stat-num { margin-top: 14px; font-weight: 600; letter-spacing: -.03em; line-height: 1; font-size: clamp(3.4rem, 9vw, 8rem);
  background: linear-gradient(100deg, #22d3ee, #0aa5bd 55%, #7fe8f7); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

/* CTA */
.slb-cta { position: relative; overflow: hidden; padding: 130px 0; background: #050506; border-top: 1px solid #14141a; }

.slb-faq summary::-webkit-details-marker { display: none; }
.slb-faq[open] .slb-faq-chev { transform: rotate(180deg); }
.slb-faq-chev { transition: transform .2s ease; }

@media (prefers-reduced-motion: reduce) { .slb-silk { animation: none; } }
`
