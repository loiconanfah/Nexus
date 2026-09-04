import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const geist = 'var(--font-geist)'
const mono = 'var(--font-mono)'
const CYAN = 'var(--nx-cyan-text)'

type Item = { id: string; label: string }
type Group = { group: string; items: Item[] }
const TOC: Group[] = [
  { group: 'Introduction', items: [
    { id: 'presentation', label: 'Présentation' },
    { id: 'concepts', label: 'Concepts clés' },
    { id: 'ontologie', label: 'Ontologie' },
    { id: 'demarrage', label: 'Prise en main' },
  ] },
  { group: 'Intelligence', items: [
    { id: 'dashboard', label: 'Vue d’ensemble' },
    { id: 'graphe', label: 'Graphe de dépendances' },
    { id: 'impact', label: 'Impact transversal' },
    { id: 'simulation', label: 'Simulation holographique' },
    { id: 'attaques', label: 'Simulation de cyberattaque' },
    { id: 'ai-deps', label: 'Dépendances IA' },
    { id: 'modele', label: 'Modèle d’entreprise' },
    { id: 'decision', label: 'Décision & simulation' },
    { id: 'twin', label: 'Jumeau numérique' },
  ] },
  { group: 'Analyse', items: [
    { id: 'dependances', label: 'Dépendances' },
    { id: 'risques', label: 'Risques & SPOF' },
    { id: 'incidents', label: 'Alerte anticipée' },
    { id: 'change', label: 'Impact de changement' },
    { id: 'audit', label: 'Confiance & audit' },
  ] },
  { group: 'Résilience', items: [
    { id: 'suppliers', label: 'Fournisseurs' },
    { id: 'human', label: 'Dépendances humaines' },
    { id: 'actions', label: 'Plan d’action' },
  ] },
  { group: 'Connaissance', items: [
    { id: 'ai', label: 'Analyste IA' },
    { id: 'inference', label: 'Dépendances inférées' },
    { id: 'documents', label: 'Documents' },
    { id: 'reports', label: 'Rapports' },
  ] },
  { group: 'Données', items: [
    { id: 'onboarding', label: 'Import & intégration' },
    { id: 'connecteurs', label: 'Connecteurs' },
  ] },
  { group: 'Administration', items: [
    { id: 'admin', label: 'Administration' },
    { id: 'api', label: 'Référence API' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'deploiement', label: 'Déploiement' },
    { id: 'securite', label: 'Sécurité' },
    { id: 'operations', label: 'Exploitation' },
    { id: 'depannage', label: 'Dépannage' },
    { id: 'faq', label: 'FAQ' },
  ] },
]

export function Docs() {
  const nav = useNavigate()
  const [active, setActive] = useState('presentation')
  const go = (id: string) => { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return (
    <div className="min-h-screen" style={{ background: 'var(--nx-bg)', color: 'var(--nx-text)' }}>
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
        <nav className="sticky top-16 hidden h-max w-60 shrink-0 flex-col gap-3 self-start lg:flex" style={{ maxHeight: 'calc(100vh - 5rem)', overflowY: 'auto' }}>
          {TOC.map((g) => (
            <div key={g.group} className="flex flex-col gap-0.5">
              <div className="px-2 py-1" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-outline)' }}>{g.group}</div>
              {g.items.map((s) => (
                <button key={s.id} onClick={() => go(s.id)} className="rounded px-2 py-1 text-left"
                  style={{ fontSize: 13, color: active === s.id ? CYAN : 'var(--nx-text-muted)', background: active === s.id ? 'color-mix(in srgb, var(--nx-cyan) 8%, transparent)' : 'transparent' }}>
                  {s.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <main className="flex min-w-0 flex-1 flex-col gap-10" style={{ lineHeight: 1.6 }}>
          {/* ── INTRODUCTION ── */}
          <Sec id="presentation" title="Présentation">
            <P><b>Lenexus</b> est une plateforme d’<b>intelligence des dépendances et d’impact</b>. Elle cartographie systèmes, fournisseurs et personnes clés d’une organisation en un <b>graphe vivant</b>, révèle les points uniques de défaillance, simule des incidents et chiffre leur impact — au-delà des frontières des outils (ERP, ITSM, CRM).</P>
            <P>Positionnement : une <b>couche au-dessus</b> des systèmes existants (pas un remplaçant de SAP), qui répond à des questions d’impact <b>transversales</b> que chaque outil, cantonné à son silo, ne voit que partiellement. Tous les chiffres sont <b>déterministes et traçables</b> ; l’IA sert à résoudre, reformuler et proposer — jamais à inventer les chiffres.</P>
          </Sec>

          <Sec id="concepts" title="Concepts clés">
            <Bullets items={[
              'Entité : un élément du graphe (serveur, application, fournisseur, personne, processus…).',
              'Dépendance (relation) : « A dépend de B ». La panne de B remonte vers ses dépendants A.',
              'Criticité (0–100) : importance d’une entité ; alimente l’impact et le coût d’arrêt.',
              'Confiance (0–1) : degré de certitude d’une relation (source, IA suggérée, validée).',
              'Impact direct vs indirect : direct = dépend immédiatement de la cible (profondeur 1) ; indirect = touché par la cascade (profondeur ≥ 2).',
              'SPOF : point unique de défaillance — entité sans redondance dont dépendent beaucoup d’autres.',
              'Propagation de compromission : en cyberattaque, un attaquant se déplace le long des relations d’accès et de données (latéralement), distincte de la propagation de panne.',
              'Dépendance IA : un modèle, agent ou fournisseur d’IA est une dépendance comme une autre — sa défaillance se propage et se chiffre par le même moteur.',
              'Tenant : espace client isolé. Chaque organisation a ses données, invisibles des autres.',
            ]} />
          </Sec>

          <Sec id="ontologie" title="Ontologie (vocabulaire contrôlé)">
            <P>Lenexus normalise toutes les données vers une ontologie propriétaire, ce qui permet de relier des sources hétérogènes. <b>Types d’entités</b> par catégorie :</P>
            <Tbl rows={[
              ['Organisation & humains', 'Organization, BusinessUnit, Location, Person, Role, Team'],
              ['Fournisseurs & contrats', 'Supplier, Contract'],
              ['Technique (actifs)', 'Asset, Infrastructure, Server, Device, Network, CloudResource'],
              ['Logiciel & données', 'Application, Service, System, Database, DataStore'],
              ['Processus & métier', 'Process, BusinessProcess, BusinessService'],
              ['Intelligence (IA)', 'AiModel, AiAgent, AiWorkflow, ModelEndpoint, AiService, AiProvider, Dataset'],
              ['Sécurité', 'Identity, Credential, Control, Policy, Vulnerability'],
              ['Gouvernance', 'Document, Incident, Change, Risk, Event'],
            ]} />
            <P className="mt-2"><b>Types de relations</b> : DEPENDS_ON, RUNS_ON, HOSTS, USES, SUPPLIED_BY, AUTHENTICATES, MAINTAINS, CONNECTS_TO, STORES, PROTECTS, PART_OF, LOCATED_IN. La résolution est tolérante (synonymes, casse), avec repli sûr.</P>
          </Sec>

          <Sec id="demarrage" title="Prise en main">
            <Bullets items={[
              'Démo : page d’accueil → « Explorer la démo » → choisir un jeu (CGI ou Bell Telecom). Espaces complets et indépendants.',
              'Compte : « Se connecter ». Chaque inscription crée un espace de travail vide (à alimenter via « Import & intégration »).',
              'Étapes typiques : importer/inférer les dépendances → explorer le graphe → analyser risques & impact → simuler → planifier les actions.',
            ]} />
            <Figure src="demo.png" caption="Choix de la démonstration (CGI ou Bell Telecom)." />
          </Sec>

          {/* ── INTELLIGENCE ── */}
          <Sec id="dashboard" title="Vue d’ensemble">
            <P>Le tableau de bord synthétise l’état de l’organisation : actifs, relations, risques majeurs et fragilités. Point d’entrée vers chaque centre d’analyse.</P>
            <Figure src="dashboard.png" caption="Tableau de bord (démo Bell Telecom)." />
          </Sec>

          <Sec id="graphe" title="Graphe de dépendances">
            <P>Deux vues : un <b>plan 2D</b> (ReactFlow) pour la lecture structurée et un <b>hologramme 3D</b> (Three.js) pour l’exploration. Sélectionner un élément met en avant ses relations et atténue le reste ; recherche, plein écran, déplacement des nœuds, clic pour les détails.</P>
            <Figure src="graph.png" caption="Graphe de dépendances — exploration." />
          </Sec>

          <Sec id="impact" title="Impact transversal">
            <P>Posez une question métier en langage naturel — <i>« que se passe-t-il si nous perdons le fournisseur X ? »</i>. Lenexus résout la cible dans le graphe, calcule la cascade, l’impact financier (pondéré par la probabilité), les éléments critiques et les points uniques de défaillance, puis propose des mitigations.</P>
            <Figure src="impact.png" caption="Impact transversal — entrée en langage naturel." />
          </Sec>

          <Sec id="simulation" title="Simulation holographique (« ET SI ? »)">
            <P>L’hologramme complet est vivant : on clique un nœud puis on applique l’une des <b>10 perturbations</b> (panne, erreur logicielle, suppression, cyberattaque, panne électrique, coupure réseau, perte de données, défaillance fournisseur, panne région cloud, perte d’employé clé). La cascade se propage en animation, distinguant liens <b>directs</b> (vifs) et <b>indirects</b> (atténués).</P>
            <P>Chaque incident a un impact <b>logique</b> et différent (une coupure réseau n’affecte pas un contrat ; une perte d’employé n’éteint pas un serveur). Le panneau <b>« Impact par élément »</b> est déplaçable et détaille chaque élément (direct/indirect, coût/h, RTO, probabilité), avec une <b>analyse IA</b> (risques + mitigations). Mode plein écran complet.</P>
            <Figure src="simulation.png" caption="Simulation holographique interactive." />
          </Sec>

          <Sec id="attaques" title="Simulation de cyberattaque (kill-chain)">
            <P>Au-delà de la panne, Lenexus rejoue une <b>attaque</b> qui se <b>propage</b> d’un élément à l’autre. On choisit un <b>point d’entrée</b> (employé, outil externe, partage cloud, agent IA…) et un <b>sens de propagation</b> ; le moteur suit les relations d’<b>accès et de données</b> pour révéler la chaîne de compromission — pas seulement les liens visibles, mais le cheminement <b>logique</b> d’un attaquant.</P>
            <P>Quatre scénarios prêts à l’emploi (ex. <i>« un partage cloud est piraté et les agents IA qui en tirent leurs données se mettent à exfiltrer »</i>, <i>« un agent IA effectue un piratage interne parti d’un employé ayant utilisé un outil externe »</i>) et un <b>constructeur libre</b> bilingue (libellés lisibles, pas des codes bruts). Pour <b>chaque nœud compromis</b> : l’impact financier (€), la probabilité, une <b>recommandation</b> ciblée, et le gain d’une <b>isolation</b> (contre-mesure). Une <b>analyse IA</b> narre la kill-chain, les risques et les contre-mesures.</P>
            <Figure src="attacks.png" caption="Simulation de cyberattaque — chaîne de compromission et contre-mesures." />
          </Sec>

          <Sec id="ai-deps" title="Dépendances IA (modèles, agents, fournisseurs)">
            <P>L’IA opérationnelle est devenue une dépendance à part entière. Lenexus modélise <b>modèles</b>, <b>agents</b>, <b>workflows</b>, <b>points d’accès</b>, <b>jeux de données</b> et <b>fournisseurs IA</b> (OpenAI, Anthropic…) comme des entités de première classe, reliées au reste du graphe. Le même moteur de propagation, <b>indépendant du type</b>, chiffre donc l’impact d’une défaillance IA sans aucune adaptation.</P>
            <Bullets items={[
              '« OpenAI tombe » → tous les agents et services qui en dépendent, l’impact financier et le RTO.',
              '« Un modèle est indisponible » → les workflows métier touchés en cascade.',
              'Une donnée d’entraînement compromise → les agents qui la consomment (cf. simulation de cyberattaque).',
            ]} />
            <P>Les RTO par type d’élément IA sont alignés sur le moteur d’impact (modèle/service/point d’accès, agent/workflow, fournisseur, jeu de données), pour un chiffrage cohérent avec le reste de la plateforme.</P>
          </Sec>

          <Sec id="modele" title="Modèle d’entreprise (jumeau décisionnel)">
            <P>Un jumeau financier dérivé de leviers déterministes (clients/abonnés, prix, coûts, effectif, marketing, R&D, trésorerie…). S’il n’existe pas, un <b>assistant guidé</b> le crée ; le compte de résultat, la trésorerie et les KPIs sont ensuite calculés automatiquement.</P>
            <Bullets items={[
              'Édition libre : le bouton « Modifier les données » ouvre tous les leviers (finances) et la « Structure de l’organisation » (divisions, sites, fournisseurs, projets) — tout l’en-tête est modifiable.',
              'Sauvegarde & historique : chaque enregistrement crée une version datée (note optionnelle) ; le panneau « Historique » liste les versions et permet de restaurer l’une d’elles en un clic (la restauration crée elle-même une version).',
              'Ratios & santé financière : marge brute / EBITDA / nette, marketing/revenu, R&D/revenu, autonomie de trésorerie, revenu/employé, attrition — avec code couleur de santé.',
              '« Où va chaque dollar de revenu » : ventilation lisible des coûts (livraison, salaires, R&D, marketing, amortissements).',
            ]} />
            <Figure src="enterprise.png" caption="Modèle d’entreprise — édition, historique et ratios (démo Bell)." />
          </Sec>

          <Sec id="decision" title="Décision & simulation">
            <P>Exprimez une décision en langage naturel (« recruter 50 ingénieurs », « ouvrir un bureau », « campagne marketing »). L’IA la traduit en effets structurés sur les leviers (ou un nouvel élément), et le moteur déterministe calcule l’impact financier — conservateur et explicable.</P>
            <Figure src="decision.png" caption="Décision & simulation." />
          </Sec>

          <Sec id="twin" title="Jumeau numérique & historique">
            <P>Vue temps réel de l’état opérationnel et de son évolution. L’historique conserve les états successifs pour comparer avant/après un changement.</P>
            <Figure src="twin.png" caption="Jumeau numérique." />
          </Sec>

          {/* ── ANALYSE ── */}
          <Sec id="dependances" title="Dépendances">
            <P>Exploration détaillée des dépendances directes et transitives d’un élément, avec la confiance de chaque relation. Base du moteur de propagation.</P>
            <Figure src="dependencies.png" caption="Intelligence des dépendances." />
          </Sec>

          <Sec id="risques" title="Risques & points uniques de défaillance">
            <P>Classe les actifs par criticité et met en évidence les <b>SPOF</b> sans redondance dont dépendent de nombreux éléments. Score de risque, exposition financière globale.</P>
            <Figure src="risks.png" caption="Centre de risques." />
          </Sec>

          <Sec id="incidents" title="Alerte anticipée">
            <P>Détecte en amont les configurations à risque (dépendances fragiles, absence de reprise) avant qu’un incident ne survienne.</P>
            <Figure src="incidents.png" caption="Alerte anticipée." />
          </Sec>

          <Sec id="change" title="Impact de changement">
            <P>Évalue l’impact d’un changement planifié (migration, mise hors service, remplacement) sur les dépendants avant de l’exécuter.</P>
            <Figure src="change.png" caption="Impact de changement." />
          </Sec>

          <Sec id="audit" title="Confiance & audit">
            <P>Centre de gouvernance de l’ontologie : relations « suggérées par IA » à valider, niveau de confiance, traçabilité (lineage) des données importées.</P>
            <Figure src="audit.png" caption="Confiance & audit." />
          </Sec>

          {/* ── RÉSILIENCE ── */}
          <Sec id="suppliers" title="Fournisseurs">
            <P>Concentration et criticité des fournisseurs, contrats associés et services dépendants — pour anticiper une défaillance externe.</P>
            <Figure src="suppliers.png" caption="Intelligence fournisseurs." />
          </Sec>

          <Sec id="human" title="Dépendances humaines">
            <P>Identifie les personnes clés dont dépendent des processus critiques (risque de « bus factor ») et les points à documenter/déléguer.</P>
            <Figure src="human.png" caption="Dépendances humaines." />
          </Sec>

          <Sec id="actions" title="Plan d’action">
            <P>Consolide les mitigations issues des analyses (redondance, bascule, SLA) en un plan priorisé.</P>
            <Figure src="actions.png" caption="Plan d’action." />
          </Sec>

          {/* ── CONNAISSANCE ── */}
          <Sec id="ai" title="Analyste IA">
            <P>Interrogez votre organisation en langage naturel. L’IA raisonne sur un contexte structuré issu du graphe et du déterministe ; sans clé IA, l’analyste reste fonctionnel avec des réponses déterministes.</P>
            <Figure src="ai.png" caption="Analyste IA." />
          </Sec>

          <Sec id="inference" title="Dépendances inférées (le moat)">
            <P>Un graphe rempli à la main a peu de valeur. Lenexus <b>lit les entités existantes</b> et <b>propose les dépendances manquantes</b> plausibles (avec justification et confiance) ; vous validez. Rien n’est écrit sans confirmation (statut « suggéré par IA »).</P>
            <Figure src="inference.png" caption="Dépendances inférées." />
          </Sec>

          <Sec id="documents" title="Documents (extraction)">
            <P>Extrait un graphe de dépendances depuis un document (texte). L’IA propose entités et relations, que vous ingérez après validation.</P>
            <Figure src="documents.png" caption="Document Intelligence." />
          </Sec>

          <Sec id="reports" title="Rapports">
            <P>Génère des rapports exécutifs (risques, exposition, points critiques) exportables.</P>
            <Figure src="reports.png" caption="Rapports." />
          </Sec>

          {/* ── DONNÉES ── */}
          <Sec id="onboarding" title="Import & intégration">
            <P>Alimentez le graphe en minutes. Trois modes : <b>Systèmes & actifs</b> (entités), <b>Dépendances</b> (relations), <b>Auto/IA</b> (colonnes libres détectées). Déposez un CSV, ou pointez une API.</P>
            <P>Format CSV d’entités (exemple) :</P>
            <Code>{`name,type,criticality
HSS,System,96
BD Abonnés,Database,95
Ericsson,Supplier,88`}</Code>
            <P>Format CSV de relations (source → cible) :</P>
            <Code>{`source,sourceType,target,targetType,relation,confidence
Service Mobile Voix,BusinessService,HSS,System,DEPENDS_ON,0.9`}</Code>
            <Figure src="onboarding.png" caption="Import des données (fichier + source REST live)." />
          </Sec>

          <Sec id="connecteurs" title="Connecteurs">
            <Bullets items={[
              'CSV / Excel : tout tableur d’actifs ou de dépendances.',
              'REST / API JSON (live) : pointez une API renvoyant un tableau JSON — pull en direct, détection des colonnes, ingestion via le pipeline. Garde anti-SSRF (refuse les adresses internes) et redirections désactivées.',
              'Import assisté par IA : collez des données brutes, l’IA déduit le mapping vers l’ontologie.',
              'Webhook / MCP : réception d’événements, exposition de Lenexus comme serveur MCP (roadmap pour les connecteurs natifs par éditeur).',
            ]} />
            <P>Connecteurs <b>lecture seule</b> par défaut. La <b>résolution d’entités</b> rapproche automatiquement une même ressource décrite différemment par plusieurs sources (ex. « SQL01 » ≈ « database-server-001 »).</P>
            <Figure src="integrations.png" caption="Catalogue de connecteurs." />
          </Sec>

          {/* ── ADMINISTRATION ── */}
          <Sec id="admin" title="Administration">
            <Bullets items={[
              'Comptes & rôles : gestion des utilisateurs de l’espace (rôle admin).',
              'Configuration IA : par tenant, choix du fournisseur (Anthropic, Gemini, OpenAI, Azure) et du modèle ; la clé est stockée côté serveur et n’est jamais renvoyée.',
              'Quota LLM : plafond mensuel par tenant (appels + caractères), repli déterministe au-delà. Consommation via GET /api/v1/ai/usage.',
              'Inscriptions : ouvrables/fermables (NEXUS_ALLOW_REGISTRATION).',
            ]} />
            <Figure src="admin.png" caption="Administration & système." />
          </Sec>

          <Sec id="api" title="Référence API (extrait)">
            <P>API REST versionnée sous <code>/api/v1</code>. Authentification par jeton JWT (en-tête <code>Authorization: Bearer …</code>). Principaux points d’entrée :</P>
            <Tbl rows={[
              ['Auth', 'POST /auth/login · POST /auth/register · GET /auth/config'],
              ['Graphe', 'GET /graph · GET /entities'],
              ['Impact', 'POST /impact/analyze'],
              ['Simulation', 'POST /simulations · POST /simulations/explain'],
              ['Cyberattaque', 'POST /attacks/explain'],
              ['Inférence', 'POST /inference/relations · POST /inference/relations/ingest'],
              ['Import', 'POST /imports/csv · /imports/excel · /imports/rest(/preview) · /imports/analyze'],
              ['Entreprise', 'GET/PUT /enterprise/model · GET /enterprise/model/history · POST /enterprise/model/restore/{id} · POST /enterprise/decision · /enterprise/scenarios'],
              ['IA', 'GET/PUT /ai/config · GET /ai/usage'],
              ['Santé', 'GET /health · GET /health/ready'],
            ]} />
          </Sec>

          <Sec id="architecture" title="Architecture">
            <Bullets items={[
              'Backend : .NET 10 (API REST), moteurs déterministes (propagation, risque, impact financier, modèle d’entreprise).',
              'Graphe : Neo4j (entités + relations, filtré par tenant).',
              'Plan de contrôle : PostgreSQL (comptes, config IA par tenant, usage LLM, modèles, scénarios).',
              'Frontend : React + Vite ; graphe 2D (ReactFlow) et 3D (Three.js).',
              'IA : fournisseur choisi à l’exécution par tenant ; sans clé, tout reste déterministe.',
            ]} />
          </Sec>

          <Sec id="deploiement" title="Déploiement">
            <P>Déploiement en un clic sur <b>Render</b> via le blueprint <code>render.yaml</code> : web statique (SPA) + API (Docker) + PostgreSQL managé + Neo4j privé, HTTPS automatique. Secrets à définir : <code>NEXUS_JWT_KEY</code>, <code>NEXUS_ADMIN_PASSWORD</code>, mot de passe Neo4j, clé IA. En production, l’API refuse de démarrer sans les secrets obligatoires.</P>
          </Sec>

          <Sec id="securite" title="Sécurité">
            <P>Isolation multi-tenant (requêtes filtrées par tenant, header-tenant interdit en production), authentification requise par défaut, mots de passe PBKDF2 salés, requêtes SQL/Cypher paramétrées, en-têtes de sécurité (HSTS, nosniff, DENY), garde anti-SSRF sur les connecteurs, rate limiting, refus de démarrer en production sans secrets. Détails dans <code>SECURITY.md</code>. Un pentest indépendant est prévu avant la mise en marché générale.</P>
          </Sec>

          <Sec id="operations" title="Exploitation (backups, DR, supervision)">
            <Bullets items={[
              'Sauvegardes : PostgreSQL (plan managé) + procédure de dump Neo4j (OPERATIONS.md).',
              'Reprise (DR) : ordre de rétablissement documenté, RPO/RTO cibles.',
              'Supervision : /health (liveness) et /health/ready (Postgres + Neo4j), traces/métriques OpenTelemetry.',
              'Coûts IA : quota LLM mensuel par tenant, repli déterministe au-delà du plafond.',
            ]} />
          </Sec>

          <Sec id="depannage" title="Dépannage">
            <Qa q="L’analyse IA affiche « repli » / aucun narratif." a="Aucune clé IA configurée pour le tenant, quota mensuel atteint, ou modèle indisponible. Vérifiez Admin → Configuration IA (clé + modèle), et GET /ai/usage." />
            <Qa q="Un import REST échoue avec « cible interdite »." a="La garde anti-SSRF refuse les adresses internes/privées (localhost, 10.x, 169.254…). Utilisez une API accessible publiquement." />
            <Qa q="Impact « 0 partout » sur un élément." a="Corrigé : l’origine est toujours comptée. Si un incident épargne tout, c’est logique (ex. « perte d’employé » sur une infrastructure)." />
            <Qa q="Un lien de la vitrine n’apparaît pas en ligne." a="Le site déployé se met à jour après un nouveau déploiement (git push). Forcez le rechargement (Ctrl+F5) en cas de cache." />
          </Sec>

          <Sec id="faq" title="FAQ">
            <Qa q="Mes données servent-elles à entraîner des modèles ?" a="Non. Les données client ne servent jamais à entraîner de modèles d’IA." />
            <Qa q="L’IA est-elle obligatoire ?" a="Non. Sans clé IA, l’application reste pleinement fonctionnelle avec ses réponses déterministes." />
            <Qa q="Les espaces clients sont-ils isolés ?" a="Oui. Chaque tenant a ses données ; toutes les requêtes filtrent par tenant et le header-tenant est interdit en production." />
            <Qa q="Puis-je connecter mes systèmes existants ?" a="Oui : CSV/Excel, API REST/JSON en direct, ou import assisté par IA. Des connecteurs natifs (ex. CMDB) peuvent être ajoutés à la demande." />
            <Qa q="Lenexus remplace-t-il mon ERP/ITSM ?" a="Non. C’est une couche au-dessus qui relie les silos pour répondre aux questions d’impact transversales." />
          <Qa q="Peut-on modéliser nos dépendances à l’IA ?" a="Oui. Modèles, agents, workflows, fournisseurs et jeux de données IA sont des entités de première classe ; l’impact d’une défaillance IA (ex. « OpenAI tombe ») se chiffre par le même moteur." />
          <Qa q="En quoi la simulation de cyberattaque diffère de la simulation de panne ?" a="La panne se propage des dépendances vers leurs dépendants ; l’attaque propage une compromission latéralement le long des accès et des données, avec kill-chain, impact et contre-mesures par nœud." />
          <Qa q="Peut-on éditer le modèle d’entreprise et revenir en arrière ?" a="Oui. Toutes les données sont éditables ; chaque sauvegarde crée une version datée et l’on peut restaurer n’importe quelle version depuis l’historique." />
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
function P({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <p className={className} style={{ color: 'var(--nx-text-muted)', fontSize: 14, ...style }}>{children}</p>
}
function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2" style={{ color: 'var(--nx-text-muted)', fontSize: 14 }}>
          <span style={{ color: CYAN }}>•</span> <span>{it}</span>
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
function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border p-3" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)', fontFamily: mono, fontSize: 12, color: 'var(--nx-text)' }}>{children}</pre>
  )
}
function Tbl({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--nx-border)' }}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex flex-col gap-0.5 border-b px-3 py-2 sm:flex-row sm:gap-4" style={{ borderColor: 'var(--nx-border)', background: i % 2 ? 'transparent' : 'color-mix(in srgb, var(--nx-panel) 60%, transparent)' }}>
          <div className="sm:w-52 sm:shrink-0" style={{ fontSize: 13, color: 'var(--nx-text)' }}>{k}</div>
          <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--nx-text-muted)' }}>{v}</div>
        </div>
      ))}
    </div>
  )
}
function Figure({ src, caption }: { src: string; caption: string }) {
  const [ok, setOk] = useState(true)
  return (
    <figure className="my-1 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-panel)' }}>
      {ok ? (
        <img src={`/docs/${src}`} alt={caption} loading="lazy" onError={() => setOk(false)} style={{ display: 'block', width: '100%' }} />
      ) : (
        <div className="flex items-center justify-center" style={{ height: 220, fontFamily: mono, fontSize: 12, color: 'var(--nx-outline)' }}>[ capture : {src} ]</div>
      )}
      <figcaption className="border-t px-3 py-2" style={{ borderColor: 'var(--nx-border)', fontFamily: mono, fontSize: 11, color: 'var(--nx-text-muted)' }}>{caption}</figcaption>
    </figure>
  )
}
