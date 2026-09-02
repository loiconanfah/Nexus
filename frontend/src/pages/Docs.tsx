import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const geist = 'var(--font-geist)'
const mono = 'var(--font-mono)'
const CYAN = 'var(--nx-cyan-text)'

type Section = { id: string; label: string }
const TOC: Section[] = [
  { id: 'presentation', label: 'Présentation' },
  { id: 'demarrage', label: 'Prise en main' },
  { id: 'dashboard', label: 'Vue d’ensemble' },
  { id: 'graphe', label: 'Graphe de dépendances' },
  { id: 'impact', label: 'Impact transversal' },
  { id: 'simulation', label: 'Simulation holographique' },
  { id: 'inference', label: 'Dépendances inférées' },
  { id: 'risques', label: 'Risques & SPOF' },
  { id: 'dependances', label: 'Dépendances' },
  { id: 'modele', label: 'Modèle d’entreprise' },
  { id: 'connecteurs', label: 'Connecteurs & import' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'securite', label: 'Sécurité' },
  { id: 'operations', label: 'Exploitation' },
  { id: 'faq', label: 'FAQ' },
]

export function Docs() {
  const nav = useNavigate()
  const [active, setActive] = useState('presentation')
  const go = (id: string) => { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return (
    <div className="min-h-screen" style={{ background: 'var(--nx-bg)', color: 'var(--nx-text)' }}>
      {/* En-tête */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b px-6 py-3 backdrop-blur" style={{ borderColor: 'var(--nx-border)', background: 'color-mix(in srgb, var(--nx-bg) 88%, transparent)' }}>
        <button onClick={() => nav('/welcome')} className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 16 }}>
          <span style={{ color: CYAN }}>◈</span> Lenexus <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>· Documentation</span>
        </button>
        <div className="flex items-center gap-3" style={{ fontFamily: mono, fontSize: 12 }}>
          <button onClick={() => nav('/demo')} style={{ color: CYAN }}>Essayer la démo →</button>
          <button onClick={() => nav('/login')} style={{ color: 'var(--nx-text-muted)' }}>Se connecter</button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        {/* Sommaire */}
        <nav className="sticky top-16 hidden h-max w-56 shrink-0 flex-col gap-0.5 lg:flex">
          {TOC.map((s) => (
            <button key={s.id} onClick={() => go(s.id)} className="rounded px-2 py-1 text-left"
              style={{ fontSize: 13, color: active === s.id ? CYAN : 'var(--nx-text-muted)', background: active === s.id ? 'color-mix(in srgb, var(--nx-cyan) 8%, transparent)' : 'transparent' }}>
              {s.label}
            </button>
          ))}
        </nav>

        {/* Contenu */}
        <main className="flex min-w-0 flex-1 flex-col gap-10" style={{ lineHeight: 1.6 }}>
          <Sec id="presentation" title="Présentation">
            <P><b>Lenexus</b> est une plateforme d’<b>intelligence des dépendances et d’impact</b> : elle cartographie les systèmes, fournisseurs et personnes clés d’une organisation en un <b>graphe vivant</b>, révèle les points uniques de défaillance, simule des incidents et chiffre leur impact — au-delà des frontières des outils (ERP, ITSM, CRM).</P>
            <P>La promesse : <i>« comprendre ce qui dépend de quoi, et ce qui se passe quand ça change »</i>. Tous les calculs sont <b>déterministes et traçables</b> ; l’IA sert à résoudre, reformuler et proposer — jamais à inventer les chiffres.</P>
            <Bullets items={[
              'Graphe de dépendances multi-tenant (isolation par espace client)',
              'Impact transversal à partir d’une question en langage naturel',
              'Simulation holographique interactive (10 types d’incidents)',
              'Inférence IA des dépendances manquantes (le graphe qui apprend)',
              'Connecteurs (CSV/Excel, REST/JSON live, import assisté par IA)',
            ]} />
          </Sec>

          <Sec id="demarrage" title="Prise en main">
            <P>Deux façons de commencer :</P>
            <Bullets items={[
              'Démo : depuis la page d’accueil, « Explorer la démo » → choisir un jeu (CGI ou Bell Telecom). Chaque démo est un espace complet et indépendant.',
              'Compte : « Se connecter » avec vos identifiants. Chaque inscription crée un espace de travail vide, à alimenter via l’onglet « Intégration ».',
            ]} />
            <Figure src="demo.png" caption="Choix de la démonstration (CGI ou Bell Telecom)." />
          </Sec>

          <Sec id="dashboard" title="Vue d’ensemble">
            <P>Le tableau de bord synthétise l’état de l’organisation : nombre d’actifs, relations, risques majeurs et points de fragilité. C’est le point d’entrée vers chaque centre d’analyse.</P>
            <Figure src="dashboard.png" caption="Tableau de bord (démo Bell Telecom)." />
          </Sec>

          <Sec id="graphe" title="Graphe de dépendances">
            <P>Le graphe relie entités et dépendances. Deux vues : un <b>plan 2D</b> pour la lecture structurée, et un <b>hologramme 3D</b> pour l’exploration. Sélectionner un élément met en avant ses relations et atténue le reste ; un mode plein écran est disponible.</P>
            <Figure src="graph.png" caption="Graphe de dépendances — vue d’exploration." />
          </Sec>

          <Sec id="impact" title="Impact transversal">
            <P>Posez une question métier en langage naturel — <i>« que se passe-t-il si nous perdons le fournisseur X ? »</i>. Lenexus relie la question au graphe, calcule la cascade, l’impact financier, les éléments critiques et les mitigations, en traversant les silos.</P>
            <Figure src="impact.png" caption="Impact transversal — entrée en langage naturel." />
          </Sec>

          <Sec id="simulation" title="Simulation holographique">
            <P>Le terrain de jeu « ET SI ? » : l’hologramme complet est vivant. On clique un nœud, puis on applique l’une des <b>10 perturbations</b> (panne, cyberattaque, coupure réseau, perte d’employé clé…). La cascade se propage en animation, distinguant liens <b>directs</b> et <b>indirects</b>, et l’impact est détaillé <b>élément par élément</b> (coût/h, RTO, probabilité), avec une analyse IA.</P>
            <Figure src="simulation.png" caption="Simulation holographique interactive (démo Bell)." />
            <P>Chaque type d’incident produit un impact <b>logique</b> et différent : une coupure réseau n’affecte pas un contrat ; une perte d’employé n’éteint pas un serveur. Le panneau d’impact est déplaçable et un plein écran complet est disponible.</P>
          </Sec>

          <Sec id="inference" title="Dépendances inférées (le moat)">
            <P>Un graphe rempli à la main a peu de valeur. Lenexus <b>lit les entités existantes</b> et <b>propose les dépendances manquantes</b> les plus plausibles (avec justification et confiance) ; l’utilisateur valide. Rien n’est écrit sans confirmation.</P>
            <Figure src="inference.png" caption="Dépendances inférées — propositions à valider." />
          </Sec>

          <Sec id="risques" title="Risques & points uniques de défaillance">
            <P>Le centre Risques classe les actifs par criticité et met en évidence les <b>SPOF</b> (points uniques de défaillance) sans redondance dont dépendent de nombreux éléments.</P>
            <Figure src="risks.png" caption="Centre de risques." />
          </Sec>

          <Sec id="dependances" title="Dépendances">
            <P>Exploration détaillée des dépendances directes et transitives d’un élément, avec la confiance de chaque relation.</P>
            <Figure src="dependencies.png" caption="Intelligence des dépendances." />
          </Sec>

          <Sec id="modele" title="Modèle d’entreprise">
            <P>Un jumeau décisionnel financier dérivé de leviers déterministes (revenu, coûts, effectif…). S’il n’existe pas, un <b>formulaire en 5 étapes</b> permet de le créer ; le P&L, la trésorerie et les KPIs sont ensuite calculés automatiquement.</P>
            <Figure src="enterprise.png" caption="Modèle d’entreprise (démo Bell)." />
          </Sec>

          <Sec id="connecteurs" title="Connecteurs & import">
            <P>Alimentez le graphe par :</P>
            <Bullets items={[
              'CSV / Excel : import de tout tableur d’actifs ou de dépendances.',
              'REST / API JSON (live) : pointez une API renvoyant du JSON — pull en direct, détection des colonnes, ingestion via le pipeline (garde anti-SSRF).',
              'Import assisté par IA : collez des données brutes, l’IA propose le mapping vers l’ontologie.',
            ]} />
            <P>Les connecteurs sont <b>lecture seule</b> par défaut. La résolution d’entités rapproche automatiquement une même ressource décrite différemment par plusieurs sources.</P>
          </Sec>

          <Sec id="architecture" title="Architecture">
            <Bullets items={[
              'Backend : .NET 10 (API REST), moteurs déterministes (propagation, risque, impact financier, modèle d’entreprise).',
              'Graphe : Neo4j (entités + relations, filtré par tenant).',
              'Plan de contrôle : PostgreSQL (comptes, config IA par tenant, usage LLM, modèles, scénarios).',
              'Frontend : React + Vite ; graphe 2D (ReactFlow) et 3D (Three.js).',
              'Déploiement : Render (web statique + API Docker + Postgres managé + Neo4j privé), HTTPS automatique.',
            ]} />
          </Sec>

          <Sec id="securite" title="Sécurité">
            <P>Isolation multi-tenant (requêtes filtrées par tenant, header-tenant interdit en production), authentification requise par défaut, mots de passe PBKDF2 salés, requêtes SQL/Cypher paramétrées, en-têtes de sécurité (HSTS, nosniff, DENY), garde anti-SSRF sur les connecteurs, et refus de démarrer en production sans secrets. Détails dans <b>SECURITY.md</b> du dépôt.</P>
            <P style={{ fontSize: 13, color: 'var(--nx-outline)' }}>Un pentest indépendant est prévu avant la mise en marché générale.</P>
          </Sec>

          <Sec id="operations" title="Exploitation (backups, DR, supervision)">
            <Bullets items={[
              'Sauvegardes : PostgreSQL (plan managé) + procédure de dump Neo4j (voir OPERATIONS.md).',
              'Reprise (DR) : ordre de rétablissement documenté, RPO/RTO cibles.',
              'Supervision : /health (liveness) et /health/ready (Postgres + Neo4j), traces/métriques OpenTelemetry.',
              'Coûts IA : quota LLM mensuel par tenant, avec repli déterministe au-delà du plafond.',
            ]} />
          </Sec>

          <Sec id="faq" title="FAQ">
            <Qa q="Mes données servent-elles à entraîner des modèles ?" a="Non. Les données client ne servent jamais à entraîner de modèles d’IA." />
            <Qa q="L’IA est-elle obligatoire ?" a="Non. Sans clé IA, l’application reste pleinement fonctionnelle avec ses réponses déterministes." />
            <Qa q="Les espaces clients sont-ils isolés ?" a="Oui. Chaque tenant a ses données ; toutes les requêtes filtrent par tenant et le tenant par en-tête est interdit en production." />
            <Qa q="Puis-je connecter mes systèmes existants ?" a="Oui, via CSV/Excel, une API REST/JSON en direct, ou un import assisté par IA. Des connecteurs natifs (ex. CMDB) peuvent être ajoutés à la demande." />
          </Sec>

          <div className="mt-6 border-t pt-6" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: 'var(--nx-outline)' }}>
            Lenexus · Documentation. Voir aussi <a onClick={() => nav('/legal')} style={{ color: CYAN, cursor: 'pointer' }}>les mentions légales</a>.
          </div>
        </main>
      </div>
    </div>
  )
}

function Sec({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-3" style={{ fontFamily: geist, fontSize: 22, color: 'var(--nx-text)' }}>{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}
function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ color: 'var(--nx-text-muted)', fontSize: 14, ...style }}>{children}</p>
}
function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2" style={{ color: 'var(--nx-text-muted)', fontSize: 14 }}>
          <span style={{ color: CYAN }}>•</span> {it}
        </li>
      ))}
    </ul>
  )
}
function Qa({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--nx-text)' }}>{q}</div>
      <div style={{ fontSize: 14, color: 'var(--nx-text-muted)' }}>{a}</div>
    </div>
  )
}
function Figure({ src, caption }: { src: string; caption: string }) {
  const [ok, setOk] = useState(true)
  return (
    <figure className="my-1 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      {ok ? (
        <img src={`/docs/${src}`} alt={caption} onError={() => setOk(false)} style={{ display: 'block', width: '100%' }} />
      ) : (
        <div className="flex items-center justify-center" style={{ height: 220, fontFamily: mono, fontSize: 12, color: 'var(--nx-outline)' }}>
          [ capture : {src} ]
        </div>
      )}
      <figcaption className="border-t px-3 py-2" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{caption}</figcaption>
    </figure>
  )
}
