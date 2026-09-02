import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Share2, ArrowRight, ArrowUpRight, PlayCircle, ShieldCheck,
  Plug, Bot, CheckCircle2, Lock, Shield, Server, AlertTriangle,
  Activity, Briefcase, Landmark, HeartPulse, Building2, Factory, Zap, ChevronDown, KeyRound,
  Scale, Menu,
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
          <a href="#essentiel">{t('L’essentiel', 'Essentials')}</a>
          <a href="#detail">{t('Fonctionnalités', 'Features')}</a>
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
            <a href="#essentiel" onClick={() => setMenuOpen(false)}>{t('L’essentiel', 'Essentials')}</a>
            <a href="#detail" onClick={() => setMenuOpen(false)}>{t('Fonctionnalités', 'Features')}</a>
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

      {/* ══════════ 01 · SOUS LE CAPOT — risque ══════════ */}
      <Section id="detail" alt>
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
          {['Graphe', 'SPOF', 'What-If', 'RTO', 'Impact $', 'Analyste IA', 'FR · EN'].map((c) => <Chip key={c}>{c}</Chip>)}
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
