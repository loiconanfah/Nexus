import { useMemo, useState } from 'react'
import {
  BookOpen, Rocket, Boxes, LayoutGrid, Gauge, FlaskConical, Plug, FileText,
  Bot, ShieldCheck, HelpCircle, Search,
} from 'lucide-react'
import { useLang } from '../lib/i18n'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'

type Bi = readonly [string, string] // [fr, en]

type Block =
  | { kind: 'p'; text: Bi }
  | { kind: 'h'; text: Bi }
  | { kind: 'ul'; items: readonly Bi[] }
  | { kind: 'steps'; items: readonly Bi[] }

interface Doc {
  id: string
  icon: typeof BookOpen
  title: Bi
  blocks: readonly Block[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Contenu de la documentation (bilingue FR/EN). Chaque section est cherchable.
// ─────────────────────────────────────────────────────────────────────────────
const DOCS: readonly Doc[] = [
  {
    id: 'intro',
    icon: BookOpen,
    title: ['Qu’est-ce que NEXUS', 'What is NEXUS'],
    blocks: [
      { kind: 'p', text: [
        'NEXUS est une plateforme d’intelligence des dépendances opérationnelles. Elle modélise vos systèmes, applications, infrastructures, fournisseurs, personnes et processus sous forme d’un graphe de dépendances, puis analyse ce graphe pour révéler ce qui casse — avant que l’activité n’en souffre.',
        'NEXUS is an operational dependency intelligence platform. It models your systems, applications, infrastructure, suppliers, people and processes as a dependency graph, then analyzes that graph to reveal what breaks — before the business feels it.',
      ] },
      { kind: 'p', text: [
        'La devise résume la promesse : « Savoir ce qui casse avant que l’activité n’en pâtisse ». Concrètement, NEXUS répond à trois questions : où sont mes points uniques de défaillance ? que se passe-t-il si tel élément tombe ? combien ça coûte et combien de temps pour récupérer ?',
        'The tagline sums up the promise: “Know what breaks before the business does.” In practice, NEXUS answers three questions: where are my single points of failure? what happens if a given element fails? how much does it cost and how long to recover?',
      ] },
      { kind: 'h', text: ['À qui ça s’adresse', 'Who it is for'] },
      { kind: 'ul', items: [
        ['Direction IT / RSSI : cartographier le risque opérationnel et le concentrer en décisions.', 'IT leadership / CISO: map operational risk and turn it into decisions.'],
        ['Équipes d’exploitation : anticiper l’impact d’un changement ou d’un incident.', 'Operations teams: anticipate the impact of a change or an incident.'],
        ['Continuité d’activité : chiffrer l’impact et prioriser la résilience.', 'Business continuity: quantify impact and prioritize resilience.'],
      ] },
    ],
  },
  {
    id: 'start',
    icon: Rocket,
    title: ['Démarrage rapide', 'Quick start'],
    blocks: [
      { kind: 'steps', items: [
        ['Connectez-vous, ou créez un compte (« Pas de compte ? Créer un compte »). Chaque inscription ouvre un espace de travail vierge et isolé.', 'Sign in, or create an account (“No account? Create one”). Each sign-up opens a blank, isolated workspace.'],
        ['Pour explorer sans données à vous, utilisez « Accès démo (CGI Inc.) » : un jeu d’entreprise réaliste préchargé.', 'To explore without your own data, use “Demo access (CGI Inc.)”: a realistic pre-loaded enterprise dataset.'],
        ['Sur un espace vierge, cliquez « Charger le jeu de démo » depuis la Vue d’ensemble, ou importez vos données via Onboarding.', 'On a blank workspace, click “Load the demo dataset” from the Overview, or import your data via Onboarding.'],
        ['Ouvrez la Vue d’ensemble : score de résilience, points uniques de défaillance, renseignement prioritaire.', 'Open the Overview: resilience score, single points of failure, priority intelligence.'],
        ['Lancez une simulation What-If pour voir l’impact en cascade d’une panne.', 'Run a What-If simulation to see the cascading impact of an outage.'],
      ] },
      { kind: 'p', text: [
        'La langue se change à tout moment (bascule FR/EN en haut). Toute l’interface et les analyses s’adaptent instantanément.',
        'You can switch language anytime (FR/EN toggle at the top). The whole interface and the analyses adapt instantly.',
      ] },
    ],
  },
  {
    id: 'model',
    icon: Boxes,
    title: ['Modèle de données : le graphe', 'Data model: the graph'],
    blocks: [
      { kind: 'p', text: [
        'Tout dans NEXUS est soit une entité (un nœud), soit une relation (une arête orientée entre deux entités). C’est ce qui permet de suivre une dépendance de bout en bout.',
        'Everything in NEXUS is either an entity (a node) or a relation (a directed edge between two entities). That is what makes it possible to trace a dependency end to end.',
      ] },
      { kind: 'h', text: ['Entités', 'Entities'] },
      { kind: 'ul', items: [
        ['Types courants : Serveur, Base de données, Application, Fournisseur, Personne, Contrat, Processus métier, Ressource cloud…', 'Common types: Server, Database, Application, Supplier, Person, Contract, Business Process, Cloud Resource…'],
        ['Chaque entité porte une criticité (déclarée ou déduite de sa position dans le graphe).', 'Each entity carries a criticality (declared, or inferred from its position in the graph).'],
      ] },
      { kind: 'h', text: ['Relations', 'Relations'] },
      { kind: 'ul', items: [
        ['DEPENDS_ON (dépend de), RUNS_ON (s’exécute sur), SUPPLIED_BY (fourni par), USES (utilise), AUTHENTICATES (authentifie), KNOWS (connaît)…', 'DEPENDS_ON, RUNS_ON, SUPPLIED_BY, USES, AUTHENTICATES, KNOWS…'],
        ['Le sens compte : « A dépend de B » signifie que la panne de B se propage vers A.', 'Direction matters: “A depends on B” means a failure of B propagates toward A.'],
      ] },
      { kind: 'h', text: ['Confiance & provenance', 'Confidence & provenance'] },
      { kind: 'p', text: [
        'Chaque dépendance est étiquetée : Vérifiée, Importée, Déduite, ou Suggérée par IA. Vous séparez ainsi ce qui est certain de ce qui est supposé (voir le module Confiance & audit).',
        'Every dependency is labeled: Verified, Imported, Inferred, or AI-Suggested. This separates what is certain from what is assumed (see the Confidence & Audit module).',
      ] },
    ],
  },
  {
    id: 'modules',
    icon: LayoutGrid,
    title: ['Les modules, un par un', 'The modules, one by one'],
    blocks: [
      { kind: 'h', text: ['Intelligence', 'Intelligence'] },
      { kind: 'ul', items: [
        ['Vue d’ensemble — le tableau de bord : score de résilience, tuiles clés (actifs critiques, SPOF, concentration fournisseurs) et renseignement prioritaire.', 'Overview — the dashboard: resilience score, key tiles (critical assets, SPOFs, supplier concentration) and priority intelligence.'],
        ['Graphe — exploration visuelle du réseau de dépendances ; recherche, filtre, panneau de détail par nœud.', 'Graph — visual exploration of the dependency network; search, filter, per-node detail panel.'],
        ['Jumeau numérique — la réplique vivante de votre organisation à un instant donné.', 'Digital Twin — the living replica of your organization at a point in time.'],
        ['Historique du jumeau — l’évolution des métriques dans le temps (instantanés horodatés).', 'Digital Twin History — how the metrics evolve over time (timestamped snapshots).'],
      ] },
      { kind: 'h', text: ['Analyse', 'Analysis'] },
      { kind: 'ul', items: [
        ['Dépendances — qui dépend de quoi ; rayon d’impact (blast radius) transitif.', 'Dependencies — who depends on what; transitive blast radius.'],
        ['Risques — le classement explicable de chaque entité (voir Moteur de risque).', 'Risks — the explainable ranking of every entity (see Risk Engine).'],
        ['Alerte anticipée (Incidents) — signaux avant-coureurs et corrélations.', 'Incident Early-Warning — leading signals and correlations.'],
        ['Impact de changement — avant de modifier un élément, ce qu’il entraîne en aval.', 'Change Impact — before you modify an element, what it triggers downstream.'],
        ['Confiance & audit — la provenance et le niveau de confiance de chaque dépendance.', 'Confidence & Audit — the provenance and confidence of every dependency.'],
      ] },
      { kind: 'h', text: ['Résilience', 'Resilience'] },
      { kind: 'ul', items: [
        ['Fournisseurs — concentration, dépendance à un tiers, risque de chaîne d’approvisionnement.', 'Suppliers — concentration, third-party dependence, supply-chain risk.'],
        ['Dépendance humaine — les personnes indispensables (facteur de bus), savoir non documenté.', 'Human Dependency — indispensable people (bus factor), undocumented knowledge.'],
        ['Simulation What-If — l’impact en cascade d’une panne, chiffré.', 'What-If Simulation — the cascading impact of an outage, quantified.'],
        ['Plan d’action — les recommandations priorisées, suivies jusqu’à la clôture.', 'Action Plan — prioritized recommendations, tracked to closure.'],
      ] },
      { kind: 'h', text: ['Données & IA', 'Data & AI'] },
      { kind: 'ul', items: [
        ['Onboarding — importez vos données (fichier, IA, presets).', 'Onboarding — import your data (file, AI, presets).'],
        ['Intelligence documentaire — analysez un document et extrayez-en des dépendances.', 'Document Intelligence — analyze a document and extract dependencies from it.'],
        ['Place de marché des intégrations — le catalogue des connecteurs.', 'Integration Marketplace — the connector catalogue.'],
        ['Assistant IA — posez vos questions en langage naturel, ancrées sur vos données.', 'AI Analyst — ask questions in natural language, grounded on your data.'],
        ['Rapports — le rapport exécutif imprimable.', 'Reports — the printable executive report.'],
      ] },
    ],
  },
  {
    id: 'risk',
    icon: Gauge,
    title: ['Comment le risque est calculé', 'How risk is computed'],
    blocks: [
      { kind: 'p', text: [
        'Le score de risque va de 0 à 100 et il est entièrement explicable : c’est une moyenne pondérée de six facteurs normalisés. Aucune boîte noire — chaque score se décompose facteur par facteur.',
        'The risk score ranges 0–100 and is fully explainable: a weighted average of six normalized factors. No black box — every score breaks down factor by factor.',
      ] },
      { kind: 'ul', items: [
        ['Criticité (poids 0,30) — l’importance intrinsèque de l’élément.', 'Criticality (weight 0.30) — the intrinsic importance of the element.'],
        ['Potentiel de propagation (0,25) — combien d’éléments dépendent de lui.', 'Propagation potential (0.25) — how many elements depend on it.'],
        ['Concentration (0,15) — la dépendance à un petit nombre de fournisseurs/nœuds.', 'Concentration (0.15) — reliance on a small number of suppliers/nodes.'],
        ['Profondeur de dépendance (0,10) — la longueur des chaînes en amont.', 'Dependency depth (0.10) — the length of upstream chains.'],
        ['Manque de redondance (0,15) — l’absence d’alternative ou de secours.', 'Lack of redundancy (0.15) — the absence of an alternative or backup.'],
        ['Incertitude (0,05) — la part de dépendances non vérifiées.', 'Uncertainty (0.05) — the share of unverified dependencies.'],
      ] },
      { kind: 'h', text: ['Bandes de risque', 'Risk bands'] },
      { kind: 'ul', items: [
        ['≤ 20 Faible · ≤ 40 Modéré · ≤ 60 Élevé · ≤ 80 Haut · > 80 Critique.', '≤ 20 Low · ≤ 40 Moderate · ≤ 60 Elevated · ≤ 80 High · > 80 Critical.'],
      ] },
      { kind: 'p', text: [
        'Un point unique de défaillance (SPOF) est un élément dont beaucoup dépendent sans alternative : sa panne se propage largement. NEXUS les détecte structurellement et les met en tête.',
        'A single point of failure (SPOF) is an element that many depend on with no alternative: its failure propagates widely. NEXUS detects them structurally and surfaces them first.',
      ] },
    ],
  },
  {
    id: 'sim',
    icon: FlaskConical,
    title: ['La simulation What-If', 'The What-If simulation'],
    blocks: [
      { kind: 'p', text: [
        'La simulation prend un élément cible et un scénario (panne, cyberattaque, indisponibilité fournisseur…) et propage l’impact dans le graphe, niveau par niveau.',
        'The simulation takes a target element and a scenario (outage, cyberattack, supplier unavailability…) and propagates the impact through the graph, level by level.',
      ] },
      { kind: 'ul', items: [
        ['Cascade par profondeur — la liste des éléments affectés, à quelle distance de la source.', 'Cascade by depth — the list of affected elements, and how far from the source.'],
        ['Probabilité de défaillance — décroît avec la profondeur (une panne lointaine est moins certaine).', 'Failure probability — decreases with depth (a distant failure is less certain).'],
        ['Impact financier — pire cas et cas attendu (pondéré par la probabilité), en devise locale.', 'Financial impact — worst case and expected case (probability-weighted), in local currency.'],
        ['Temps de récupération (RTO) — l’estimation de retour à la normale.', 'Recovery time (RTO) — the estimated time to return to normal.'],
      ] },
      { kind: 'p', text: [
        'Exemple observé sur le jeu CGI : une compromission d’Entra ID donne un pire cas ≈ 1,94 M$ CAD, un cas attendu ≈ 1,70 M$ CAD et une récupération ≈ 4,9 h. Ces chiffres sont dérivés du graphe, pas inventés.',
        'Example observed on the CGI dataset: an Entra ID compromise yields a worst case ≈ CAD 1.94M, an expected case ≈ CAD 1.70M and a recovery ≈ 4.9h. These figures are derived from the graph, not invented.',
      ] },
    ],
  },
  {
    id: 'connect',
    icon: Plug,
    title: ['Connecteurs & import de données', 'Connectors & data import'],
    blocks: [
      { kind: 'p', text: [
        'NEXUS accepte les données par import — vous gardez le contrôle de ce que vous partagez, sans donner d’accès privilégié à vos systèmes. Le catalogue distingue quatre niveaux.',
        'NEXUS accepts data by import — you keep control of what you share, without granting privileged access to your systems. The catalogue has four tiers.',
      ] },
      { kind: 'ul', items: [
        ['Actif — fonctionne immédiatement : CSV/Excel, JSON (fichier ou URL), Import assisté par IA, Serveur MCP.', 'Active — works immediately: CSV/Excel, JSON (file or URL), AI-assisted import, MCP server.'],
        ['Assisté — vous exportez depuis la plateforme source (M365, ServiceNow, AWS…) puis importez ; NEXUS guide le mapping.', 'Assisted — you export from the source platform (M365, ServiceNow, AWS…) then import; NEXUS guides the mapping.'],
        ['Prêt pour clé — modèles IA qui s’activent dès qu’une clé est fournie.', 'Key-ready — AI models that activate as soon as a key is provided.'],
        ['Roadmap — annoncés, pas encore construits.', 'Roadmap — announced, not built yet.'],
      ] },
      { kind: 'h', text: ['Import assisté par IA', 'AI-assisted import'] },
      { kind: 'p', text: [
        'Collez des données brutes et désordonnées : l’IA déduit le mapping vers l’ontologie (quels champs sont des entités, lesquels des relations, la criticité…). Vous validez avant l’intégration.',
        'Paste messy raw data: the AI infers the mapping to the ontology (which fields are entities, which are relations, criticality…). You review before ingestion.',
      ] },
      { kind: 'h', text: ['Résolution tolérante', 'Tolerant resolution'] },
      { kind: 'p', text: [
        'À l’import, NEXUS reconnaît les synonymes et variantes de types (ex. « depends on », « DependsOn » → DEPENDS_ON) au lieu de rejeter la ligne. Les cas inconnus retombent sur des valeurs sûres.',
        'On import, NEXUS recognizes synonyms and type variants (e.g. “depends on”, “DependsOn” → DEPENDS_ON) instead of dropping the row. Unknown cases fall back to safe defaults.',
      ] },
    ],
  },
  {
    id: 'docs',
    icon: FileText,
    title: ['Intelligence documentaire', 'Document Intelligence'],
    blocks: [
      { kind: 'p', text: [
        'Déposez un document (runbook, contrat, schéma d’architecture décrit en texte…). L’IA en extrait des candidats — entités et relations — que vous pouvez ensuite intégrer au graphe.',
        'Drop a document (runbook, contract, architecture described in text…). The AI extracts candidates — entities and relations — that you can then ingest into the graph.',
      ] },
      { kind: 'steps', items: [
        ['Chargez le document et lancez l’analyse.', 'Upload the document and run the analysis.'],
        ['Passez en revue les dépendances candidates proposées par l’IA.', 'Review the candidate dependencies proposed by the AI.'],
        ['Intégrez : elles rejoignent le graphe étiquetées « Suggérée par IA », traçables dans Confiance & audit.', 'Ingest: they join the graph labeled “AI-Suggested”, traceable in Confidence & Audit.'],
      ] },
    ],
  },
  {
    id: 'ai',
    icon: Bot,
    title: ['L’assistant IA', 'The AI Analyst'],
    blocks: [
      { kind: 'p', text: [
        'L’Assistant IA répond en langage naturel, mais les chiffres viennent toujours des moteurs déterministes de NEXUS. L’IA ne fait que formuler la réponse — elle n’invente aucune donnée.',
        'The AI Analyst answers in natural language, but the numbers always come from NEXUS’s deterministic engines. The AI only phrases the answer — it invents no data.',
      ] },
      { kind: 'ul', items: [
        ['Fonctionne sans clé (réponses ancrées, non « naturalisées »).', 'Works without a key (grounded answers, not “naturalized”).'],
        ['Avec une clé (Google Gemini, Anthropic Claude, OpenAI, Azure OpenAI), les réponses sont reformulées plus naturellement.', 'With a key (Google Gemini, Anthropic Claude, OpenAI, Azure OpenAI), answers are phrased more naturally.'],
        ['Les clés se gèrent dans Admin & système, restent côté serveur, et ne sont jamais renvoyées au navigateur.', 'Keys are managed in Admin & System, stay server-side, and are never returned to the browser.'],
      ] },
      { kind: 'p', text: [
        'Google Gemini propose un palier gratuit, pratique pour activer la naturalisation sans coût. La réponse reste identique dans les chiffres : seule la formulation change.',
        'Google Gemini offers a free tier, handy to enable naturalization at no cost. The answer stays identical in its numbers: only the wording changes.',
      ] },
    ],
  },
  {
    id: 'security',
    icon: ShieldCheck,
    title: ['Sécurité & comptes', 'Security & accounts'],
    blocks: [
      { kind: 'ul', items: [
        ['Authentification par jeton (JWT) : sans jeton valide, l’API est fermée.', 'Token authentication (JWT): without a valid token, the API is closed.'],
        ['Chaque compte est rattaché à un espace de travail (tenant) ; le tenant est inscrit dans le jeton par le serveur, pas falsifiable côté client.', 'Each account is bound to a workspace (tenant); the tenant is stamped into the token by the server, not client-falsifiable.'],
        ['Inscription libre : chaque nouveau compte ouvre un espace vierge et isolé, dont il est administrateur.', 'Self-registration: each new account opens a blank, isolated workspace it administers.'],
        ['SSO Entra ID (Microsoft) disponible : connexion avec le compte professionnel, sans mot de passe NEXUS (activé par l’administrateur du déploiement).', 'Entra ID (Microsoft) SSO available: sign in with the corporate account, no NEXUS password (enabled by the deployment admin).'],
        ['Les mots de passe ne sont jamais stockés en clair (empreinte PBKDF2).', 'Passwords are never stored in clear text (PBKDF2 hash).'],
      ] },
      { kind: 'p', text: [
        'Bonnes pratiques : ne partagez jamais vos identifiants, ne collez jamais de clé d’API dans une conversation, et déconnectez-vous sur un poste partagé (bouton « logout »).',
        'Best practices: never share your credentials, never paste an API key into a conversation, and sign out on a shared machine (the “logout” button).',
      ] },
    ],
  },
  {
    id: 'faq',
    icon: HelpCircle,
    title: ['Questions fréquentes', 'FAQ'],
    blocks: [
      { kind: 'h', text: ['Je ne vois aucune donnée, pourquoi ?', 'I see no data, why?'] },
      { kind: 'p', text: [
        'Un espace fraîchement créé est vide. Cliquez « Charger le jeu de démo » sur la Vue d’ensemble, ou importez vos données via Onboarding.',
        'A freshly created workspace is empty. Click “Load the demo dataset” on the Overview, or import your data via Onboarding.',
      ] },
      { kind: 'h', text: ['Dois-je donner accès à mes systèmes ?', 'Do I have to grant access to my systems?'] },
      { kind: 'p', text: [
        'Non. NEXUS fonctionne par import : vous n’exposez que ce que vous choisissez de partager. Les connexions directes en lecture seule sont une étape ultérieure et optionnelle.',
        'No. NEXUS works by import: you only expose what you choose to share. Direct read-only connections are a later, optional step.',
      ] },
      { kind: 'h', text: ['Les chiffres de risque sont-ils fiables ?', 'Are the risk numbers trustworthy?'] },
      { kind: 'p', text: [
        'Ils sont déterministes et explicables : chaque score se décompose en six facteurs (voir « Comment le risque est calculé »). Ils reflètent le graphe que vous fournissez — meilleures données, meilleures conclusions.',
        'They are deterministic and explainable: each score breaks into six factors (see “How risk is computed”). They reflect the graph you provide — better data, better conclusions.',
      ] },
      { kind: 'h', text: ['Comment obtenir de l’aide ?', 'How do I get help?'] },
      { kind: 'p', text: [
        'Écrivez à support@nexus.io. Pour un déploiement (SSO, clés, connexions directes), contactez votre administrateur NEXUS.',
        'Email support@nexus.io. For a deployment (SSO, keys, direct connections), contact your NEXUS administrator.',
      ] },
    ],
  },
] as const

function blockText(b: Block, i: 0 | 1): string {
  if (b.kind === 'ul' || b.kind === 'steps') return b.items.map((it) => it[i]).join(' ')
  return b.text[i]
}

export function Help() {
  const { lang, t } = useLang()
  const i = lang === 'fr' ? 0 : 1
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const visible = useMemo(() => {
    if (!q) return DOCS
    return DOCS.filter((d) => {
      const hay = (d.title[i] + ' ' + d.blocks.map((b) => blockText(b, i)).join(' ')).toLowerCase()
      return hay.includes(q)
    })
  }, [q, i])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2" style={{ fontFamily: geist, fontSize: 24, color: 'var(--nx-text)' }}>
          <BookOpen size={22} style={{ color: CYAN }} /> {t('Documentation & guide d’usage', 'Documentation & usage guide')}
        </h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--nx-text-muted)' }}>
          {t('Tout ce qu’il faut savoir pour prendre NEXUS en main — concepts, modules, calcul du risque, sécurité.', 'Everything you need to get started with NEXUS — concepts, modules, risk computation, security.')}
        </p>
      </div>

      {/* Recherche */}
      <div className="flex items-center gap-2 rounded border px-3 py-2" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface-high)', maxWidth: 460 }}>
        <Search size={16} style={{ color: 'var(--nx-outline)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Rechercher dans la documentation…', 'Search the documentation…')}
          className="w-full bg-transparent outline-none"
          style={{ color: 'var(--nx-text)', fontSize: 14 }}
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sommaire */}
        <nav className="lg:sticky lg:top-2 lg:w-60 lg:shrink-0 lg:self-start">
          <div className="mb-2" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-outline)' }}>
            {t('Sommaire', 'Contents')}
          </div>
          <div className="flex flex-col gap-1">
            {DOCS.map((d) => {
              const Icon = d.icon
              const shown = visible.some((v) => v.id === d.id)
              return (
                <a
                  key={d.id}
                  href={`#doc-${d.id}`}
                  className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:brightness-125"
                  style={{ fontSize: 13, color: shown ? 'var(--nx-text-muted)' : 'var(--nx-outline)', opacity: shown ? 1 : 0.4 }}
                >
                  <Icon size={15} style={{ color: shown ? CYAN : 'var(--nx-outline)' }} />
                  {d.title[i]}
                </a>
              )
            })}
          </div>
        </nav>

        {/* Contenu */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {visible.length === 0 && (
            <div style={{ fontFamily: mono, color: 'var(--nx-text-muted)' }}>
              {t('Aucun résultat pour cette recherche.', 'No results for this search.')}
            </div>
          )}
          {visible.map((d) => {
            const Icon = d.icon
            return (
              <section
                key={d.id}
                id={`doc-${d.id}`}
                className="scroll-mt-4 rounded-lg border p-5"
                style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}
              >
                <h3 className="mb-3 flex items-center gap-2" style={{ fontFamily: geist, fontSize: 18, color: 'var(--nx-text)' }}>
                  <Icon size={18} style={{ color: CYAN }} /> {d.title[i]}
                </h3>
                <div className="flex flex-col gap-3">
                  {d.blocks.map((b, bi) => (
                    <BlockView key={bi} block={b} i={i} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function BlockView({ block, i }: { block: Block; i: 0 | 1 }) {
  if (block.kind === 'h') {
    return <h4 style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: CYAN }}>{block.text[i]}</h4>
  }
  if (block.kind === 'p') {
    return <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--nx-text-muted)' }}>{block.text[i]}</p>
  }
  if (block.kind === 'ul') {
    return (
      <ul className="flex flex-col gap-1.5">
        {block.items.map((it, k) => (
          <li key={k} className="flex gap-2" style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--nx-text-muted)' }}>
            <span style={{ color: CYAN }}>•</span>
            <span>{it[i]}</span>
          </li>
        ))}
      </ul>
    )
  }
  // steps
  return (
    <ol className="flex flex-col gap-2">
      {block.items.map((it, k) => (
        <li key={k} className="flex gap-3" style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--nx-text-muted)' }}>
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(0,229,255,0.12)', color: CYAN, fontFamily: mono, fontSize: 11 }}
          >
            {k + 1}
          </span>
          <span>{it[i]}</span>
        </li>
      ))}
    </ol>
  )
}
