import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Bot, Building2, ChevronDown, ClipboardList, FileSearch,
  GitBranch, LayoutDashboard, Network, PlayCircle, Radar, ShieldAlert, Sparkles,
  Truck, Upload, Users, Video, Waypoints, Zap, Eye, Lightbulb, Compass,
} from 'lucide-react'
import { useLang } from '../lib/i18n'
import { startGuidedTour } from '../components/GuidedTour'

const mono = 'var(--font-mono)'
const geist = 'var(--font-geist)'
const CYAN = 'var(--nx-cyan)'
const CYAN_T = 'var(--nx-cyan-text)'

/* ══════════════════════════════════════════════════════════════════════════════
   VIDÉOS DE DÉMONSTRATION

   Déposez les fichiers dans `frontend/public/videos/` puis décrivez-les ici.
   `src` est le chemin SERVI (public/ est la racine du site) : un fichier
   `frontend/public/videos/tour.mp4` se référence donc par `/videos/tour.mp4`.
   `poster` est facultatif — une image d'aperçu, même emplacement.
   Tant que cette liste est vide, l'Accueil affiche un espace d'attente explicite
   au lieu d'un lecteur vide.
   ══════════════════════════════════════════════════════════════════════════ */
type DemoVideo = { src: string; poster?: string; title: [string, string]; body: [string, string]; duration?: string }

const DEMO_VIDEOS: DemoVideo[] = []

/* ══════════════════════════════════════════════════════════════════════════════
   LES 8 FONCTIONS PHARES

   Pour chacune : à quoi elle sert, COMMENT on s'en sert (les gestes, dans
   l'ordre), et ce qu'on obtient. C'est le tutoriel — pas une liste de features.
   ══════════════════════════════════════════════════════════════════════════ */
type Feature = {
  to: string
  icon: typeof Network
  n: string
  name: [string, string]
  why: [string, string]
  steps: [string, string][]
  result: [string, string]
  /** Un cas nommé, pris sur un jeu de données réel — pas une paraphrase. */
  example: [string, string]
  /** Le piège dans lequel on tombe la première fois. */
  tip: [string, string]
}

const FEATURES: Feature[] = [
  {
    to: '/graph', icon: Network, n: '01',
    name: ['Le graphe de dépendances', 'The dependency graph'],
    why: [
      'Tout part de là. Vos systèmes, fournisseurs, personnes et IA cessent d’être des listes dans des outils séparés : ils deviennent une seule carte où chaque lien dit « ceci dépend de cela ».',
      'Everything starts here. Your systems, suppliers, people and AI stop being lists in separate tools: they become a single map where each link says “this depends on that”.',
    ],
    steps: [
      ['Ouvrez le graphe : chaque point est un actif, sa taille et sa couleur suivent sa criticité.', 'Open the graph: each dot is an asset; size and colour follow its criticality.'],
      ['Cliquez un actif pour n’afficher que son voisinage — ce dont il dépend, et ce qui dépend de lui.', 'Click an asset to show only its neighbourhood — what it depends on, and what depends on it.'],
      ['Utilisez la recherche en haut de l’écran pour sauter directement à un actif par son nom.', 'Use the search at the top of the screen to jump straight to an asset by name.'],
    ],
    result: [
      'Une carte navigable où vous voyez enfin les chaînes de dépendance complètes, y compris celles qui traversent l’IT, les achats et les RH.',
      'A navigable map where you finally see complete dependency chains, including those crossing IT, procurement and HR.',
    ],
    example: [
      'Sur la démo Bell, « Data Center Montréal » paraît n’être qu’un site. En cliquant dessus, on découvre que 11 actifs en dépendent sans aucune solution de repli — dont la facturation.',
      'On the Bell demo, “Data Center Montréal” looks like just a site. Click it and you find 11 assets depending on it with no fallback — billing among them.',
    ],
    tip: [
      'Ne cherchez pas à tout cartographier d’emblée. Commencez par les dix systèmes dont l’arrêt se verrait le jour même : le reste viendra en s’y raccrochant.',
      'Do not try to map everything at once. Start with the ten systems whose outage would be noticed the same day: the rest will attach itself to those.',
    ],
  },
  {
    to: '/risks', icon: AlertTriangle, n: '02',
    name: ['Les risques et les points uniques de défaillance', 'Risks and single points of failure'],
    why: [
      'Un point unique de défaillance, c’est un actif dont plusieurs choses dépendent sans aucune solution de repli. C’est précisément ce qu’on découvre d’habitude le jour de la panne.',
      'A single point of failure is an asset several things depend on with no fallback. It is exactly what you usually discover on the day it fails.',
    ],
    steps: [
      ['Ouvrez le centre de risques : tous vos actifs sont classés de 0 à 100.', 'Open the risk center: all your assets are ranked from 0 to 100.'],
      ['Lisez la décomposition du score — criticité, nombre de dépendants, rayon d’impact, redondance. Aucun chiffre n’est une boîte noire.', 'Read the score breakdown — criticality, dependents, blast radius, redundancy. No figure is a black box.'],
      ['Traitez d’abord les actifs signalés « sans redondance » : ce sont vos points uniques de défaillance.', 'Start with assets flagged “no redundancy”: those are your single points of failure.'],
    ],
    result: [
      'Une liste priorisée, justifiable en comité, de ce qu’il faut sécuriser en premier — et pourquoi.',
      'A prioritized list, defensible in committee, of what to secure first — and why.',
    ],
    example: [
      '« HSS — Home Subscriber Server » sort à 98 % de confiance : 10 actifs en dépendent, aucune redondance. Il n’était dans aucun registre de risques.',
      '“HSS — Home Subscriber Server” comes out at 98 % confidence: 10 assets depend on it, no redundancy. It was in no risk register.',
    ],
    tip: [
      'Un score élevé ne veut pas dire « à remplacer ». Il veut dire « rien ne prend le relais ». Souvent la réponse est un contrat de secours, pas un projet.',
      'A high score does not mean “replace it”. It means “nothing takes over”. Often the answer is a standby contract, not a project.',
    ],
  },
  {
    to: '/impact', icon: Waypoints, n: '03',
    name: ['L’impact transversal, en langage courant', 'Cross-cutting impact, in plain language'],
    why: [
      'La vraie question d’un dirigeant n’est pas « quel serveur est critique » mais « si nous perdons ceci, qu’est-ce qui casse, jusqu’où, et combien ça coûte ». C’est là qu’on y répond.',
      'A leader’s real question is not “which server is critical” but “if we lose this, what breaks, how far, and how much does it cost”. This is where that is answered.',
    ],
    steps: [
      ['Écrivez la question en français ou en anglais : « et si nous perdons notre fournisseur d’identité ? »', 'Write the question in plain language: “what if we lose our identity provider?”'],
      ['Le moteur retrouve la cible dans le graphe, suit la cascade niveau par niveau et chiffre l’impact.', 'The engine resolves the target in the graph, follows the cascade level by level and quantifies impact.'],
      ['Lisez le bandeau de base probante : il dit sur quelles preuves ce chiffrage repose, et nomme les maillons les plus faibles.', 'Read the evidence banner: it says what evidence the estimate rests on, and names the weakest links.'],
    ],
    result: [
      'Un montant, un délai de reprise et la liste des éléments touchés — avec le niveau de confiance affiché honnêtement.',
      'An amount, a recovery time and the list of affected elements — with the confidence level honestly displayed.',
    ],
    example: [
      '« Et si nous perdons Entra ID ? » donne 1,70 M$, 16 éléments touchés, reprise 4,9 h — et nomme le maillon le moins sûr du calcul.',
      '“What if we lose Entra ID?” returns $1.70M, 16 affected elements, 4.9 h recovery — and names the least reliable link in the calculation.',
    ],
    tip: [
      'Regardez toujours la confiance moyenne avant de citer le montant en comité. Sous 70 %, allez d’abord valider les maillons faibles.',
      'Always check the average confidence before quoting the amount in committee. Below 70 %, go validate the weak links first.',
    ],
  },
  {
    to: '/simulations', icon: Zap, n: '04',
    name: ['Simuler une panne', 'Simulate an outage'],
    why: [
      'Un plan de continuité sur papier n’a jamais été testé. Ici vous coupez virtuellement un élément et vous observez ce qui se passe réellement, sans rien casser.',
      'A continuity plan on paper has never been tested. Here you virtually cut an element and watch what actually happens, breaking nothing.',
    ],
    steps: [
      ['Choisissez l’actif à faire tomber — depuis cette page, ou en cliquant un point sur le tableau de bord.', 'Pick the asset to take down — from this page, or by clicking a dot on the dashboard.'],
      ['Choisissez le type de panne (arrêt serveur, perte de fournisseur, indisponibilité d’un site…).', 'Pick the outage type (server failure, supplier loss, site unavailability…).'],
      ['Comparez plusieurs scénarios entre eux avant de trancher.', 'Compare several scenarios against each other before deciding.'],
    ],
    result: [
      'La cascade complète, le temps de reprise et le coût — de quoi transformer un plan théorique en plan éprouvé.',
      'The full cascade, recovery time and cost — enough to turn a theoretical plan into a tested one.',
    ],
    example: [
      'Couper un seul serveur d’authentification arrête les outils de 9 équipes : la cascade traverse trois niveaux avant d’atteindre le client.',
      'Cutting a single authentication server stops the tools of 9 teams: the cascade crosses three levels before reaching the customer.',
    ],
    tip: [
      'Comparez toujours deux scénarios. Un chiffre seul ne se juge pas ; deux chiffres côte à côte, si.',
      'Always compare two scenarios. A single number cannot be judged; two side by side can.',
    ],
  },
  {
    to: '/attacks', icon: ShieldAlert, n: '05',
    name: ['Rejouer une cyberattaque', 'Replay a cyberattack'],
    why: [
      'Une intrusion ne s’arrête pas au premier poste compromis : elle progresse. Cette simulation suit la progression, d’un employé hameçonné jusqu’à vos agents IA.',
      'An intrusion does not stop at the first compromised machine: it progresses. This simulation follows that progression, from a phished employee to your AI agents.',
    ],
    steps: [
      ['Choisissez le point d’entrée : une personne, un outil externe, un fournisseur.', 'Pick the entry point: a person, an external tool, a supplier.'],
      ['Suivez la chaîne de compromission étape par étape — chaque nœud porte son impact propre.', 'Follow the compromise chain step by step — each node carries its own impact.'],
      ['Évaluez les contre-mesures proposées : chacune indique ce qu’elle évite, en dollars.', 'Weigh the proposed countermeasures: each states what it avoids, in dollars.'],
    ],
    result: [
      'Un scénario d’attaque chiffré et la contre-mesure qui rapporte le plus — pas une liste d’alertes.',
      'A quantified attack scenario and the countermeasure with the best return — not a list of alerts.',
    ],
    example: [
      'Un employé hameçonné mène, en quatre bonds, à l’exfiltration par un agent IA : 4,75 M$. Isoler le partage cloud en évite l’essentiel.',
      'A phished employee leads, in four hops, to exfiltration through an AI agent: $4.75M. Isolating the cloud share avoids most of it.',
    ],
    tip: [
      'Le point d’entrée le plus coûteux est rarement le plus technique : c’est souvent une personne ou un outil externe oublié de l’inventaire.',
      'The costliest entry point is rarely the most technical: it is often a person, or an external tool missing from the inventory.',
    ],
  },
  {
    to: '/decision', icon: Sparkles, n: '06',
    name: ['Tester une décision d’affaires', 'Test a business decision'],
    why: [
      'Externaliser, changer de fournisseur, fermer un site : ces décisions ont des conséquences opérationnelles que le tableur ne voit pas. Le modèle d’entreprise les relie à vos chiffres réels.',
      'Outsourcing, switching suppliers, closing a site: these decisions have operational consequences a spreadsheet cannot see. The enterprise model ties them to your real figures.',
    ],
    steps: [
      ['Renseignez d’abord votre modèle d’entreprise — revenus, coûts, trésorerie, effectifs, sites. Il est éditable et versionné.', 'First fill in your enterprise model — revenue, costs, cash, headcount, sites. It is editable and versioned.'],
      ['Décrivez la décision en une phrase, en langage courant.', 'Describe the decision in one sentence, in plain language.'],
      ['Comparez l’avant et l’après sur le compte de résultat et la trésorerie.', 'Compare before and after on the P&L and cash position.'],
    ],
    result: [
      'L’effet chiffré d’une décision, opérationnel ET financier, dans le même écran.',
      'The quantified effect of a decision, operational AND financial, on the same screen.',
    ],
    example: [
      'Remplacer un fournisseur unique par deux prestataires coûte 240 k$ par an — et supprime une exposition chiffrée à 1,2 M$.',
      'Replacing a sole supplier with two providers costs $240k a year — and removes an exposure quantified at $1.2M.',
    ],
    tip: [
      'Renseignez le modèle d’entreprise AVANT de tester une décision. Sans chiffre d’affaires ni coûts, Lenexux vous le dira plutôt que d’inventer un montant.',
      'Fill in the enterprise model BEFORE testing a decision. Without revenue and costs, Lenexux will say so rather than invent an amount.',
    ],
  },
  {
    to: '/audit', icon: FileSearch, n: '07',
    name: ['Savoir à quel point vos données sont sûres', 'Know how trustworthy your data is'],
    why: [
      'Un chiffrage ne vaut que ce que valent les dépendances sur lesquelles il repose. Chaque lien porte donc une confiance calculée à partir de preuves — et cette confiance décote avec le temps.',
      'An estimate is only worth the dependencies it rests on. Every link therefore carries a confidence computed from evidence — and that confidence decays over time.',
    ],
    steps: [
      ['Ouvrez « Confiance & audit » : les dépendances les moins sûres remontent en tête.', 'Open “Trust & audit”: the least reliable dependencies rise to the top.'],
      ['Cliquez « Pourquoi ce score ? » pour voir la décomposition, preuve par preuve.', 'Click “Why this score?” to see the breakdown, evidence by evidence.'],
      ['Validez ce que vous savez vrai : votre validation s’AJOUTE aux sources, elle ne les efface jamais.', 'Validate what you know to be true: your validation is ADDED to the sources, it never erases them.'],
    ],
    result: [
      'Une cartographie dont vous connaissez la solidité, maillon par maillon — et qui se renforce à l’usage.',
      'A map whose solidity you know, link by link — and which strengthens as you use it.',
    ],
    example: [
      'Valider une seule dépendance faible — « CGI Advantage → Microsoft 365 » — fait passer sa confiance de 45 % à 98 %, et la base du chiffrage de « correcte » à « solide ».',
      'Validating one weak dependency — “CGI Advantage → Microsoft 365” — takes its confidence from 45 % to 98 %, and the estimate’s basis from “moderate” to “solid”.',
    ],
    tip: [
      'Validez ce que vous savez, pas ce qui vous arrange. Une confiance honnêtement basse vaut mieux qu’un chiffre faussement rassurant.',
      'Validate what you know, not what suits you. Honestly low confidence beats a falsely reassuring figure.',
    ],
  },
  {
    to: '/onboarding', icon: Upload, n: '08',
    name: ['Faire entrer vos données', 'Bring your data in'],
    why: [
      'Aucun accès privilégié n’est demandé à vos systèmes. Vous n’exposez que ce que vous choisissez, par import — et si vos systèmes ne sont pas joignables depuis Internet, une sonde installée chez vous s’en charge.',
      'No privileged access to your systems is required. You only expose what you choose, by import — and if your systems are unreachable from the internet, a probe installed on your side handles it.',
    ],
    steps: [
      ['Commencez par un fichier : CSV ou Excel. Vous pouvez aussi coller des données brutes, l’IA les structure.', 'Start with a file: CSV or Excel. You can also paste raw data and let the AI structure it.'],
      ['Pour une source vivante, branchez une API REST en lecture seule depuis les connecteurs.', 'For a live source, connect a read-only REST API from the integrations page.'],
      ['Pour un système interne non exposé, déclarez une sonde dans Admin → Collectors : elle sort en HTTPS, aucun port à ouvrir.', 'For an internal, non-exposed system, declare a probe in Admin → Collectors: it dials out over HTTPS, no inbound port to open.'],
    ],
    result: [
      'Un graphe alimenté par vos sources réelles, rafraîchi automatiquement — et donc une confiance qui ne vieillit pas en silence.',
      'A graph fed by your real sources, refreshed automatically — so confidence never ages silently.',
    ],
    example: [
      'Un export CSV de l’inventaire — nom, type, criticité — suffit à faire apparaître le graphe, les scores et les premiers points de défaillance.',
      'A CSV export of the inventory — name, type, criticality — is enough to surface the graph, the scores and the first failure points.',
    ],
    tip: [
      'Réimporter ne détruit rien : vos validations humaines sont conservées et fusionnées avec les nouvelles données.',
      'Re-importing destroys nothing: your human validations are kept and merged with the incoming data.',
    ],
  },
]

/* Raccourcis : les pages qu'on rouvre tous les jours. */
const SHORTCUTS: { to: string; icon: typeof Network; label: [string, string] }[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: ['Tableau de bord', 'Dashboard'] },
  { to: '/graph', icon: Network, label: ['Graphe', 'Graph'] },
  { to: '/risks', icon: AlertTriangle, label: ['Risques', 'Risks'] },
  { to: '/impact', icon: Waypoints, label: ['Impact transversal', 'Cross-system impact'] },
  { to: '/simulations', icon: Zap, label: ['Simulations', 'Simulations'] },
  { to: '/attacks', icon: ShieldAlert, label: ['Simulation d’attaque', 'Attack simulation'] },
  { to: '/enterprise', icon: Building2, label: ['Modèle d’entreprise', 'Enterprise model'] },
  { to: '/audit', icon: FileSearch, label: ['Confiance & audit', 'Trust & audit'] },
  { to: '/suppliers', icon: Truck, label: ['Fournisseurs', 'Suppliers'] },
  { to: '/human', icon: Users, label: ['Dépendances humaines', 'Human dependencies'] },
  { to: '/dependencies', icon: GitBranch, label: ['Dépendances', 'Dependencies'] },
  { to: '/incidents', icon: Radar, label: ['Alerte anticipée', 'Early warning'] },
  { to: '/actions', icon: ClipboardList, label: ['Plan d’action', 'Action plan'] },
  { to: '/ai', icon: Bot, label: ['Analyste IA', 'AI analyst'] },
  { to: '/onboarding', icon: Upload, label: ['Import & intégration', 'Import & onboarding'] },
]

export function Home() {
  const { t } = useLang()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-8">
      <Intro t={t} />
      <VideoSection t={t} />
      <Tutorial t={t} onGo={navigate} />
      <Glossary t={t} />
      <Shortcuts t={t} onGo={navigate} />
    </div>
  )
}

/* ---------- Ce qu'est le produit ---------- */

function Intro({ t }: { t: (fr: string, en: string) => string }) {
  return (
    <section className="rounded-sm border p-6 sm:p-8" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: CYAN_T }}>
          {t('Intelligence des dépendances et d’impact', 'Dependency & impact intelligence')}
        </span>
      </div>
      <h2 className="mt-4 max-w-3xl" style={{ fontFamily: geist, fontSize: 26, lineHeight: 1.2, color: 'var(--nx-text)' }}>
        {t('Savoir ce qui casse, jusqu’où, et combien ça coûte.', 'Know what breaks, how far, and what it costs.')}
      </h2>
      <p className="mt-4 max-w-3xl" style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--nx-text-muted)' }}>
        {t('Vos outils voient chacun leur silo : l’ERP les fournisseurs, l’ITSM les serveurs, le RH les personnes. Lenexux relie ces silos en une seule carte de dépendances, y révèle vos points de fragilité, rejoue les pannes et les attaques, et en chiffre l’impact sur votre compte de résultat.',
           'Each of your tools sees its own silo: the ERP sees suppliers, the ITSM sees servers, HR sees people. Lenexux links those silos into a single dependency map, reveals your weak points, replays outages and attacks, and quantifies the impact on your P&L.')}
      </p>
      {/* La visite guidée n'existait que dans Assistance, dernière entrée d'un
          menu de 25 : personne ne l'y trouvait. Sa place est ici, sur la page
          qui explique le produit. */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={startGuidedTour} className="flex items-center gap-2 rounded-sm px-4 py-2.5"
          style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <Compass size={15} /> {t('Lancer la visite guidée', 'Start the guided tour')}
        </button>
        <span style={{ fontSize: 12.5, color: 'var(--nx-text-muted)' }}>
          {t('Quinze étapes à travers l’interface, en quelques minutes.', 'Fifteen steps through the interface, in a few minutes.')}
        </span>
      </div>

      <div className="mt-6 grid gap-px sm:grid-cols-3" style={{ background: 'var(--nx-border)' }}>
        <Pillar t={t}
          title={['Déterministe', 'Deterministic']}
          body={['Tous les chiffres sont calculés et traçables. L’IA reformule et explique — elle n’invente jamais un montant.',
                 'Every figure is computed and traceable. The AI rephrases and explains — it never invents an amount.']} />
        <Pillar t={t}
          title={['Honnête sur ses limites', 'Honest about its limits']}
          body={['Chaque dépendance affiche la confiance qu’on peut lui accorder, et sur quelles preuves elle repose.',
                 'Every dependency shows how much confidence it deserves, and what evidence it rests on.']} />
        <Pillar t={t}
          title={['Sans accès privilégié', 'No privileged access']}
          body={['Vous n’exposez que ce que vous choisissez d’importer. Vos données restent dans votre espace, cloisonné.',
                 'You only expose what you choose to import. Your data stays in your own partitioned workspace.']} />
      </div>
    </section>
  )
}

function Pillar({ t, title, body }: { t: (fr: string, en: string) => string; title: [string, string]; body: [string, string] }) {
  return (
    <div className="p-5" style={{ background: 'var(--nx-surface-container)' }}>
      <h3 style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: CYAN_T }}>{t(...title)}</h3>
      <p className="mt-2" style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--nx-text-muted)' }}>{t(...body)}</p>
    </div>
  )
}

/* ---------- Vidéos de démonstration ---------- */

function VideoSection({ t }: { t: (fr: string, en: string) => string }) {
  const [active, setActive] = useState(0)
  const has = DEMO_VIDEOS.length > 0
  const v = DEMO_VIDEOS[active]

  return (
    <section className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
      <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--nx-border)' }}>
        <Video size={15} style={{ color: CYAN }} />
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: CYAN_T }}>
          {t('Démonstration en vidéo', 'Video walkthrough')}
        </span>
      </div>

      {!has ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <PlayCircle size={30} style={{ color: 'var(--nx-outline)' }} />
          <p style={{ fontSize: 14, color: 'var(--nx-text)' }}>
            {t('Les vidéos de démonstration arrivent ici.', 'The demo videos will appear here.')}
          </p>
          <p className="max-w-md" style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--nx-text-muted)' }}>
            {t('En attendant, le tutoriel ci-dessous couvre les huit fonctions phares, étape par étape.',
               'In the meantime, the tutorial below covers the eight flagship features, step by step.')}
          </p>
        </div>
      ) : (
        <div className="p-5">
          {DEMO_VIDEOS.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {DEMO_VIDEOS.map((d, k) => (
                <button key={d.src} onClick={() => setActive(k)} aria-pressed={k === active}
                  className="rounded-sm px-3 py-1.5"
                  style={{
                    fontFamily: mono, fontSize: 11, letterSpacing: '0.04em',
                    border: `1px solid ${k === active ? CYAN : 'var(--nx-border)'}`,
                    background: k === active ? 'rgba(0,229,255,0.10)' : 'transparent',
                    color: k === active ? CYAN_T : 'var(--nx-text-muted)',
                  }}>
                  {t(...d.title)}{d.duration ? ` · ${d.duration}` : ''}
                </button>
              ))}
            </div>
          )}
          <video key={v.src} src={v.src} poster={v.poster} controls preload="metadata"
            className="w-full rounded-sm" style={{ border: '1px solid var(--nx-border)', background: '#000' }} />
          <h3 className="mt-4" style={{ fontFamily: geist, fontSize: 17, color: 'var(--nx-text)' }}>{t(...v.title)}</h3>
          <p className="mt-1.5 max-w-3xl" style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--nx-text-muted)' }}>{t(...v.body)}</p>
        </div>
      )}
    </section>
  )
}

/* ---------- Tutoriel ---------- */

function Tutorial({ t, onGo }: { t: (fr: string, en: string) => string; onGo: (to: string) => void }) {
  const [open, setOpen] = useState<string | null>(FEATURES[0].to)

  return (
    <section data-tour="tutorial">
      <div className="mb-4">
        <h2 style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>
          {t('Comment utiliser la plateforme', 'How to use the platform')}
        </h2>
        <p className="mt-1.5 max-w-3xl" style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--nx-text-muted)' }}>
          {t('Les huit fonctions phares, dans l’ordre où elles se tiennent : on cartographie, on révèle, on chiffre, on éprouve, puis on consolide. Dépliez une fonction pour voir à quoi elle sert et les gestes à faire.',
             'The eight flagship features, in the order they build on one another: map, reveal, quantify, stress-test, then consolidate. Expand a feature to see what it is for and the steps to follow.')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {FEATURES.map((f) => (
          <FeatureBlock key={f.to} f={f} t={t} open={open === f.to}
            onToggle={() => setOpen((o) => (o === f.to ? null : f.to))} onGo={onGo} />
        ))}
      </div>
    </section>
  )
}

function FeatureBlock({ f, t, open, onToggle, onGo }:
  { f: Feature; t: (fr: string, en: string) => string; open: boolean; onToggle: () => void; onGo: (to: string) => void }) {
  const Icon = f.icon
  return (
    <div className="rounded-sm border" style={{ background: 'var(--nx-surface-container)', borderColor: open ? 'rgba(0,229,255,0.35)' : 'var(--nx-border)' }}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 px-5 py-4 text-left">
        <span style={{ fontFamily: geist, fontSize: 20, fontWeight: 300, color: 'var(--nx-outline)', minWidth: 32 }}>{f.n}</span>
        <Icon size={18} className="shrink-0" style={{ color: CYAN }} />
        <span className="flex-1" style={{ fontSize: 15, fontWeight: 500, color: 'var(--nx-text)' }}>{t(...f.name)}</span>
        <ChevronDown size={16} className="shrink-0" style={{ color: 'var(--nx-text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div className="border-t px-5 py-5" style={{ borderColor: 'var(--nx-border)' }}>
          <p className="max-w-3xl" style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--nx-text)' }}>{t(...f.why)}</p>

          <p className="mt-5" style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>
            {t('Les gestes, dans l’ordre', 'The steps, in order')}
          </p>
          <ol className="mt-2.5 flex flex-col gap-2.5">
            {f.steps.map((s, k) => (
              <li key={s[1]} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ fontFamily: mono, fontSize: 10, background: 'rgba(0,229,255,0.12)', color: CYAN_T, border: '1px solid rgba(0,229,255,0.3)' }}>{k + 1}</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--nx-text-muted)' }}>{t(...s)}</span>
              </li>
            ))}
          </ol>

          <div className="mt-5 rounded-sm border-l-2 py-2 pl-4" style={{ borderColor: CYAN }}>
            <p style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>
              {t('Ce que vous obtenez', 'What you get')}
            </p>
            <p className="mt-1 max-w-3xl" style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--nx-text)' }}>{t(...f.result)}</p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-sm border p-4" style={{ borderColor: 'var(--nx-border)', background: 'var(--nx-surface)' }}>
              <p className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-muted)' }}>
                <Eye size={12} /> {t('Un cas réel', 'A real case')}
              </p>
              <p className="mt-1.5" style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--nx-text-muted)' }}>{t(...f.example)}</p>
            </div>
            <div className="rounded-sm border p-4" style={{ borderColor: 'rgba(200,176,64,0.3)', background: 'rgba(200,176,64,0.06)' }}>
              <p className="flex items-center gap-1.5" style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8b040' }}>
                <Lightbulb size={12} /> {t('Le piège à éviter', 'The trap to avoid')}
              </p>
              <p className="mt-1.5" style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--nx-text-muted)' }}>{t(...f.tip)}</p>
            </div>
          </div>

          <button onClick={() => onGo(f.to)} className="mt-5 flex items-center gap-2 rounded-sm px-4 py-2"
            style={{ background: CYAN, color: 'var(--nx-on-cyan)', fontFamily: mono, fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('Ouvrir', 'Open')} <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- Vocabulaire ---------- */

/**
 * Les mots que la plateforme emploie partout. Ils sont ici, à portée de clic,
 * parce qu'un écran de risque perd son lecteur dès la première fois qu'il dit
 * « rayon d'impact » sans jamais l'avoir défini.
 */
const TERMS: { term: [string, string]; def: [string, string] }[] = [
  {
    term: ['Dépendance', 'Dependency'],
    def: ['« Ceci a besoin de cela pour fonctionner. » Votre facturation dépend de sa base de données, qui dépend d’un serveur, qui dépend d’un hébergeur.',
          '“This needs that in order to work.” Your billing depends on its database, which depends on a server, which depends on a host.'],
  },
  {
    term: ['Point unique de défaillance', 'Single point of failure'],
    def: ['Un élément dont plusieurs choses dépendent et qui n’a aucun remplaçant. S’il tombe, tout ce qui est derrière tombe avec lui.',
          'An element several things depend on, with no stand-in. If it fails, everything behind it fails with it.'],
  },
  {
    term: ['Rayon d’impact', 'Blast radius'],
    def: ['Le nombre de choses qui s’arrêtent quand un élément tombe — pas seulement ses voisins directs, mais toute la chaîne derrière.',
          'How many things stop when one element fails — not just its direct neighbours, but the whole chain behind it.'],
  },
  {
    term: ['Criticité', 'Criticality'],
    def: ['L’importance qu’on accorde à un actif, de 0 à 100. Elle vient de vous ; le score de risque, lui, est calculé à partir d’elle et du reste du graphe.',
          'How important an asset is, from 0 to 100. It comes from you; the risk score is computed from it and from the rest of the graph.'],
  },
  {
    term: ['Temps de reprise (RTO)', 'Recovery time (RTO)'],
    def: ['Combien de temps il faut pour tout remettre en service. Ce délai, multiplié par ce que vous perdez chaque heure, donne le coût.',
          'How long it takes to bring everything back. That delay, times what you lose per hour, gives the cost.'],
  },
  {
    term: ['Confiance & preuve', 'Confidence & evidence'],
    def: ['À quel point on est sûr qu’une dépendance existe vraiment, et d’où vient cette information : fichier importé, système interrogé, déduction, ou quelqu’un qui l’a confirmée. Toute information vieillit, donc la confiance décote.',
          'How sure we are a dependency really exists, and where that came from: imported file, queried system, deduction, or someone who confirmed it. All information ages, so confidence decays.'],
  },
]

function Glossary({ t }: { t: (fr: string, en: string) => string }) {
  return (
    <section>
      <h2 className="mb-1" style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>
        {t('Le vocabulaire de la plateforme', 'The platform’s vocabulary')}
      </h2>
      <p className="mb-4 max-w-3xl" style={{ fontSize: 13.5, color: 'var(--nx-text-muted)' }}>
        {t('Six mots reviennent sur tous les écrans. Les voici, définis sans autre terme technique.',
           'Six words come up on every screen. Here they are, defined without using another technical term.')}
      </p>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {TERMS.map((x) => (
          <div key={x.term[1]} className="rounded-sm border p-4"
            style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--nx-text)' }}>{t(...x.term)}</h3>
            <p className="mt-1.5" style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--nx-text-muted)' }}>{t(...x.def)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- Raccourcis ---------- */

function Shortcuts({ t, onGo }: { t: (fr: string, en: string) => string; onGo: (to: string) => void }) {
  return (
    <section>
      <h2 className="mb-1" style={{ fontFamily: geist, fontSize: 20, color: 'var(--nx-text)' }}>{t('Accès rapide', 'Quick access')}</h2>
      <p className="mb-4" style={{ fontSize: 13.5, color: 'var(--nx-text-muted)' }}>
        {t('Les écrans qu’on rouvre tous les jours.', 'The screens you reopen every day.')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {SHORTCUTS.map(({ to, icon: Icon, label }) => (
          <button key={to} onClick={() => onGo(to)}
            className="flex items-center gap-3 rounded-sm border px-4 py-3 text-left transition-colors hover:brightness-125"
            style={{ background: 'var(--nx-surface-container)', borderColor: 'var(--nx-border)' }}>
            <Icon size={17} className="shrink-0" style={{ color: CYAN }} />
            <span className="flex-1" style={{ fontSize: 13.5, color: 'var(--nx-text)' }}>{t(...label)}</span>
            <ArrowRight size={13} style={{ color: 'var(--nx-outline)' }} />
          </button>
        ))}
      </div>
    </section>
  )
}
