/* ══════════════════════════════════════════════════════════════════════════════
   BLOG — articles publiés sur le site vitrine.

   Ajouter un article : un objet de plus dans POSTS (le plus récent en premier).
   Le corps est une suite de blocs simples (paragraphe, intertitre, liste,
   citation) en français ET en anglais. Aucun chiffre ni client ne doit y
   figurer sans source vérifiable.
   ══════════════════════════════════════════════════════════════════════════ */

export type Block = { h: string } | { p: string } | { ul: string[] } | { quote: string }

export type Post = {
  slug: string
  date: string            // AAAA-MM-JJ
  readMinutes: number
  tag: [string, string]
  title: [string, string]
  summary: [string, string]
  body: { fr: Block[]; en: Block[] }
}

export const POSTS: Post[] = [
  {
    slug: 'decider-en-voyant-ce-que-la-decision-touche',
    date: '2026-09-18',
    readMinutes: 6,
    tag: ['Décision', 'Decision'],
    title: [
      'Recruter, remplacer, migrer : décider en voyant ce que la décision touche',
      'Hire, replace, migrate: deciding while seeing what the decision touches',
    ],
    summary: [
      'Une décision d’organisation n’est pas une ligne de budget. C’est une modification de l’entreprise réelle — et ses conséquences se lisent dans les dépendances.',
      'An organisational decision is not a budget line. It is a change to the real company — and its consequences can be read in the dependencies.',
    ],
    body: {
      fr: [
        { p: 'Remplacer une personne qui part à la retraite, recruter un expert, migrer un logiciel central : ces décisions sont souvent évaluées sur un tableau à deux colonnes — ce que ça coûte, ce que ça rapporte. Ce qui manque presque toujours, c’est la troisième colonne : ce que la décision touche.' },
        { h: 'Ce qu’un tableur ne voit pas' },
        { p: 'La personne qui part est peut-être la seule à savoir redémarrer un système dont dépend une activité critique. Le nouvel expert arrivera avec ses outils — et donc avec un nouveau fournisseur, des données qui sortiront peut-être du pays, et une nouvelle personne clé. Le logiciel migré est relié à d’autres systèmes qu’il faudra reconnecter le jour de la bascule.' },
        { p: 'Aucune de ces informations n’est dans le budget. Elles sont dans les dépendances de l’organisation.' },
        { h: 'Poser la décision sur le graphe' },
        { p: 'Dans Lenexux, une décision est appliquée sur une copie du graphe de dépendances : on ajoute le rôle recruté, on retire la personne qui part, on reconnecte ce qui dépendait de l’ancien outil. Le moteur mesure alors, avec les mêmes règles avant et après :' },
        { ul: [
          'le savoir détenu par une seule personne, et ce qui en dépend ;',
          'les liaisons à refaire et les personnes à former ;',
          'les fournisseurs ajoutés, et la concentration qui en résulte ;',
          'le risque de transition, chiffré avec le modèle d’impact de l’organisation ;',
          'la résilience avant et après : points uniques de défaillance, personnes clés.',
        ] },
        { h: 'Chaque montant dit d’où il vient' },
        { p: 'Un chiffrage de décision n’est utile que si on sait sur quoi il repose. Chaque ligne indique donc sa source : saisie par le décideur, comptée dans le graphe, calculée par le moteur d’impact, ou hypothèse à confirmer. Quand un assistant IA propose une valeur, elle reste marquée « suggérée » jusqu’à ce qu’un humain la confirme.' },
        { quote: 'La meilleure décision n’est pas celle qui a le meilleur retour sur investissement sur le papier. C’est celle dont on connaît les angles morts.' },
        { h: 'Les angles morts, avant l’analyse' },
        { p: 'Quand on décrit une décision en une phrase, on dit ce qu’on veut faire, rarement ce que cela implique. L’assistant de préparation parcourt le graphe pour faire ressortir ce que la phrase ne dit pas : les autres maillons fragiles de l’activité visée, les personnes qui y travaillent déjà, les informations manquantes pour conclure. Le décideur tranche en connaissance de cause.' },
      ],
      en: [
        { p: 'Replacing someone who retires, hiring an expert, migrating a core system: these decisions are often assessed on a two-column sheet — what it costs, what it brings. What is almost always missing is the third column: what the decision touches.' },
        { h: 'What a spreadsheet does not see' },
        { p: 'The person leaving may be the only one who knows how to restart a system a critical activity depends on. The new expert will come with their tools — hence a new supplier, data that may leave the country, and a new key person. The migrated software is linked to other systems that must be reconnected on switch-over day.' },
        { p: 'None of this is in the budget. It is in the organisation’s dependencies.' },
        { h: 'Putting the decision on the graph' },
        { p: 'In Lenexux, a decision is applied to a copy of the dependency graph: the hired role is added, the departing person removed, whatever depended on the old tool reconnected. The engine then measures, with the same rules before and after:' },
        { ul: [
          'knowledge held by a single person, and what depends on it;',
          'links to rebuild and people to train;',
          'suppliers added, and the resulting concentration;',
          'transition risk, priced with the organisation’s impact model;',
          'resilience before and after: single points of failure, key people.',
        ] },
        { h: 'Every amount says where it comes from' },
        { p: 'A decision costing is only useful if you know what it rests on. Each line therefore states its source: entered by the decision-maker, counted in the graph, computed by the impact engine, or an assumption to confirm. When an AI assistant proposes a value, it stays marked “suggested” until a human confirms it.' },
        { quote: 'The best decision is not the one with the best return on paper. It is the one whose blind spots you know.' },
        { h: 'Blind spots, before the analysis' },
        { p: 'When you describe a decision in one sentence, you say what you want to do, rarely what it implies. The preparation assistant walks the graph to surface what the sentence does not say: the other weak links of the target activity, the people already working on it, the information missing to conclude. The decision-maker decides with eyes open.' },
      ],
    },
  },
  {
    slug: 'chiffrer-une-panne-avant-qu-elle-arrive',
    date: '2026-09-10',
    readMinutes: 5,
    tag: ['Méthode', 'Method'],
    title: [
      'Chiffrer une panne avant qu’elle n’arrive : la méthode, sans boîte noire',
      'Pricing an outage before it happens: the method, no black box',
    ],
    summary: [
      '« Combien nous coûterait la perte de ce système ? » La réponse tient en trois quantités : un coût horaire, une durée de rétablissement, une probabilité de propagation.',
      '“What would losing this system cost us?” The answer rests on three quantities: an hourly cost, a recovery time, a propagation probability.',
    ],
    body: {
      fr: [
        { p: 'Un chiffre d’impact n’a de valeur que s’il peut être expliqué à un comité de direction — et contesté. C’est pourquoi le calcul de Lenexux est déterministe : les mêmes données donnent toujours le même résultat, et chaque étape peut être montrée.' },
        { h: '1. Qu’est-ce qui tombe ?' },
        { p: 'Tout part du graphe de dépendances. Quand un élément tombe, on suit les relations « dépend de » à rebours : tout ce qui s’appuyait sur lui est touché, puis ce qui s’appuyait sur ceux-là, et ainsi de suite. C’est la cascade.' },
        { h: '2. Combien coûte une heure d’arrêt ?' },
        { p: 'Chaque élément touché a un coût horaire d’indisponibilité. S’il a été renseigné, c’est lui qui est utilisé. Sinon, il est estimé à partir de sa criticité, avec des paliers étalonnés sur le chiffre d’affaires de l’organisation : une heure d’arrêt n’a pas le même poids pour une PME que pour un groupe.' },
        { h: '3. Combien de temps pour revenir ?' },
        { p: 'La durée de rétablissement dépend de la nature de l’élément — on redémarre plus vite une application qu’on ne remplace un fournisseur — et de sa criticité. Elle est réglable par organisation.' },
        { h: '4. Tout ne casse pas à coup sûr' },
        { p: 'Plus on s’éloigne de la panne d’origine, moins il est certain que l’effet se propage. Une probabilité décroissante avec la distance pondère chaque élément. On obtient deux chiffres : le pire cas, où tout casse jusqu’au bout, et le cas attendu, pondéré par la probabilité.' },
        { quote: 'Un chiffre d’impact qu’on ne peut pas décomposer est une opinion.' },
        { h: 'Et la qualité des données ?' },
        { p: 'Un chiffrage ne vaut que ce que valent les dépendances sur lesquelles il repose. Chaque relation porte donc ses preuves — import, observation en direct, validation humaine, inférence IA — et le résultat affiche la solidité de sa base : combien de dépendances sont validées, combien sont fragiles, et lesquelles aller vérifier.' },
      ],
      en: [
        { p: 'An impact figure is only valuable if it can be explained to an executive committee — and challenged. That is why Lenexux’s computation is deterministic: the same data always gives the same result, and every step can be shown.' },
        { h: '1. What goes down?' },
        { p: 'It all starts from the dependency graph. When an element fails, “depends on” relations are followed backwards: everything that relied on it is hit, then whatever relied on those, and so on. That is the cascade.' },
        { h: '2. What does an hour of downtime cost?' },
        { p: 'Each affected element has an hourly downtime cost. If it has been entered, it is used. Otherwise it is estimated from its criticality, with tiers calibrated on the organisation’s revenue: an hour of downtime does not weigh the same for a small business as for a group.' },
        { h: '3. How long to recover?' },
        { p: 'Recovery time depends on the element’s nature — an application restarts faster than a supplier is replaced — and on its criticality. It is adjustable per organisation.' },
        { h: '4. Not everything breaks for sure' },
        { p: 'The further from the original failure, the less certain the effect spreads. A probability that decreases with distance weights each element. Two figures come out: the worst case, where everything breaks all the way, and the expected case, weighted by probability.' },
        { quote: 'An impact figure you cannot break down is an opinion.' },
        { h: 'And data quality?' },
        { p: 'A costing is only as good as the dependencies it rests on. Each relation therefore carries its evidence — import, live observation, human validation, AI inference — and the result shows how solid its basis is: how many dependencies are validated, how many are weak, and which ones to go and check.' },
      ],
    },
  },
  {
    slug: 'point-unique-de-defaillance',
    date: '2026-09-02',
    readMinutes: 4,
    tag: ['Résilience', 'Resilience'],
    title: [
      'Points uniques de défaillance : pourquoi vous en avez plus que vous ne le pensez',
      'Single points of failure: why you have more than you think',
    ],
    summary: [
      'Un point unique de défaillance n’est pas toujours un serveur. C’est souvent une personne, un fournisseur ou un fichier que personne ne pense à regarder.',
      'A single point of failure is not always a server. It is often a person, a supplier or a file nobody thinks to look at.',
    ],
    body: {
      fr: [
        { p: 'On imagine volontiers le point unique de défaillance comme une machine sans secours. C’est le cas le plus visible — et souvent le mieux traité. Les plus dangereux sont ailleurs.' },
        { h: 'Les trois familles oubliées' },
        { ul: [
          'Les personnes : celle qui est seule à savoir clôturer le mois, redémarrer un système ou négocier avec un partenaire.',
          'Les fournisseurs : un opérateur, un hébergeur, un éditeur dont dépendent plusieurs activités sans alternative prévue.',
          'Les maillons discrets : un tableur partagé, une clé d’accès, un service cloud souscrit par une équipe et connu d’elle seule.',
        ] },
        { h: 'Pourquoi on ne les voit pas' },
        { p: 'Chaque outil de l’entreprise voit son propre silo : l’inventaire informatique connaît les serveurs, le service achats connaît les contrats, les ressources humaines connaissent les postes. Le point unique de défaillance se trouve presque toujours à la jonction de ces silos — là où aucun outil ne regarde.' },
        { quote: 'Un point unique de défaillance est une dépendance que personne n’a écrite.' },
        { h: 'Les faire apparaître' },
        { p: 'Relier ces silos dans un même graphe suffit à faire apparaître la plupart d’entre eux : un élément dont dépend une activité, sans secours déclaré, et une personne seule à en détenir le savoir. Une fois visibles, ils se traitent : un second détenteur formé, un fournisseur de repli, une procédure écrite. Le travail n’est pas spectaculaire. Il évite simplement de découvrir la dépendance le jour où elle casse.' },
      ],
      en: [
        { p: 'We tend to picture a single point of failure as a machine with no backup. That is the most visible case — and often the best handled. The most dangerous ones are elsewhere.' },
        { h: 'The three forgotten families' },
        { ul: [
          'People: the only one who knows how to close the month, restart a system or negotiate with a partner.',
          'Suppliers: an operator, a host, a vendor several activities depend on with no planned alternative.',
          'Discreet links: a shared spreadsheet, an access key, a cloud service subscribed by one team and known only to it.',
        ] },
        { h: 'Why we do not see them' },
        { p: 'Each company tool sees its own silo: the IT inventory knows servers, procurement knows contracts, HR knows roles. The single point of failure almost always sits at the junction of these silos — where no tool looks.' },
        { quote: 'A single point of failure is a dependency nobody wrote down.' },
        { h: 'Making them visible' },
        { p: 'Linking these silos in one graph is enough to surface most of them: an element an activity depends on, with no declared backup, and a single person holding its knowledge. Once visible, they can be handled: a second trained holder, a fallback supplier, a written procedure. The work is not spectacular. It simply avoids discovering the dependency on the day it breaks.' },
      ],
    },
  },
]

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug)
