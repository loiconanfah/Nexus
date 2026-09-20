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
    slug: 'cartographie-des-dependances-par-ou-commencer',
    date: '2026-09-19',
    readMinutes: 7,
    tag: ['Guide', 'Guide'],
    title: [
      'Cartographie des dépendances : par où commencer, concrètement',
      'Dependency mapping: where to start, concretely',
    ],
    summary: [
      'Une cartographie utile ne commence pas par l’inventaire complet du parc informatique. Elle commence par trois activités et remonte la chaîne. Voici la méthode, étape par étape.',
      'A useful map does not start with a full IT inventory. It starts with three activities and walks up the chain. Here is the method, step by step.',
    ],
    body: {
      fr: [
        { p: 'La plupart des projets de cartographie échouent de la même façon : on décide de tout recenser, on y passe six mois, et la carte est périmée avant d’avoir servi. La méthode inverse donne un résultat exploitable en quelques jours.' },
        { h: 'Étape 1 : partir de trois activités, pas des serveurs' },
        { p: 'Demandez à la direction quelles activités ne peuvent pas s’arrêter une journée. Dans une banque, ce sera le décaissement et les paiements. Dans une clinique, la prise de rendez-vous et le dossier patient. Dans une usine, la ligne de production et l’expédition. Retenez-en trois, pas plus. Ce sont elles qui donnent un sens à tout le reste.' },
        { h: 'Étape 2 : remonter la chaîne, une question à la fois' },
        { p: 'Pour chaque activité, posez la même question jusqu’à épuisement : de quoi cela dépend-il pour fonctionner aujourd’hui ? Le décaissement dépend du système bancaire central, qui dépend d’un serveur, qui dépend d’un hébergeur et de l’électricité. Trois à quatre niveaux suffisent : au-delà, la précision gagnée ne change plus les décisions.' },
        { h: 'Étape 3 : ajouter les personnes et les fournisseurs' },
        { p: 'C’est l’étape que les inventaires techniques sautent, et c’est là que se cachent les vraies fragilités. Pour chaque système, deux questions : qui sait le redémarrer, et de quel prestataire dépend-il ? Notez les rôles plutôt que les noms, la carte survivra aux départs.' },
        { h: 'Étape 4 : marquer ce qui n’a pas de secours' },
        { p: 'Passez la liste et cochez ce qui n’a ni doublure, ni procédure écrite, ni second détenteur du savoir. Vous obtenez vos points uniques de défaillance. C’est en général une liste courte, et souvent une surprise pour la direction.' },
        { h: 'Étape 5 : chiffrer, même grossièrement' },
        { p: 'Pour chaque activité, estimez ce que coûte une heure d’arrêt : chiffre d’affaires perdu, pénalités, personnes immobilisées, remise en état. Un ordre de grandeur suffit pour hiérarchiser. Sans montant, une carte reste un schéma ; avec, elle devient un argument de budget.' },
        { quote: 'Une carte incomplète mais chiffrée est plus utile qu’un inventaire exhaustif que personne ne lit.' },
        { h: 'Étape 6 : la tenir à jour' },
        { p: 'Une cartographie vieillit vite. Reliez-la aux sources qui changent d’elles-mêmes, inventaire technique, outil de gestion des incidents, annuaire du personnel, et faites valider les dépendances critiques par les équipes une fois par trimestre. Dans Lenexux, chaque dépendance porte la trace de son origine et la date de sa dernière validation, et sa confiance baisse toute seule avec le temps.' },
      ],
      en: [
        { p: 'Most mapping projects fail the same way: someone decides to inventory everything, spends six months on it, and the map is outdated before it is used. The opposite method gives a usable result in a few days.' },
        { h: 'Step 1: start from three activities, not from servers' },
        { p: 'Ask management which activities cannot stop for a day. In a bank, disbursement and payments. In a clinic, appointments and patient records. In a factory, the production line and shipping. Pick three, no more. They give meaning to everything else.' },
        { h: 'Step 2: walk up the chain, one question at a time' },
        { p: 'For each activity, ask the same question until you run out of answers: what does this depend on to work today? Disbursement depends on the core banking system, which depends on a server, which depends on a host and on power. Three or four levels are enough; beyond that, the extra precision no longer changes decisions.' },
        { h: 'Step 3: add people and suppliers' },
        { p: 'This is the step technical inventories skip, and where the real fragilities hide. For each system, two questions: who knows how to restart it, and which provider does it depend on? Record roles rather than names, so the map survives departures.' },
        { h: 'Step 4: mark what has no backup' },
        { p: 'Go through the list and tick whatever has no stand-in, no written procedure and no second knowledge holder. Those are your single points of failure. The list is usually short, and often a surprise for management.' },
        { h: 'Step 5: price it, even roughly' },
        { p: 'For each activity, estimate what one hour of downtime costs: lost revenue, penalties, idle staff, recovery work. An order of magnitude is enough to rank them. Without amounts, a map is a diagram; with them, it becomes a budget argument.' },
        { quote: 'An incomplete but priced map is more useful than an exhaustive inventory nobody reads.' },
        { h: 'Step 6: keep it alive' },
        { p: 'A map ages fast. Connect it to the sources that change by themselves, the technical inventory, the incident tool, the staff directory, and have critical dependencies validated by the teams once a quarter. In Lenexux, every dependency carries where it came from and when it was last validated, and its confidence decays on its own over time.' },
      ],
    },
  },
  {
    slug: 'analyse-impact-activite-bia-methode',
    date: '2026-09-12',
    readMinutes: 6,
    tag: ['Guide', 'Guide'],
    title: [
      'Analyse d’impact sur l’activité (BIA) : la méthode en cinq étapes',
      'Business impact analysis (BIA): the method in five steps',
    ],
    summary: [
      'Le BIA sert à répondre à trois questions : quelles activités sont vitales, combien de temps peuvent-elles s’arrêter, et ce que coûte chaque heure. Sans tableur de 40 onglets.',
      'A BIA answers three questions: which activities are vital, how long they can stop, and what each hour costs. Without a 40-tab spreadsheet.',
    ],
    body: {
      fr: [
        { p: 'L’analyse d’impact sur l’activité, ou BIA, est la pièce que réclament les auditeurs, les assureurs et les régulateurs. Elle est trop souvent produite une fois par an, dans un tableur, puis rangée. Voici comment la rendre vivante.' },
        { h: '1. Lister les activités, pas les applications' },
        { p: 'Une activité se dit en langage métier : accorder un crédit, payer les salaires, livrer une commande. Si votre liste contient des noms de logiciels, vous listez des outils, pas des activités.' },
        { h: '2. Fixer la durée d’interruption tolérable' },
        { p: 'Pour chaque activité, deux chiffres. Combien de temps peut-elle s’arrêter avant que les conséquences deviennent graves, et quelle perte de données est acceptable. Faites-les valider par le responsable métier, pas par l’informatique : c’est lui qui assume la conséquence.' },
        { h: '3. Chiffrer le coût d’une heure d’arrêt' },
        { p: 'Additionnez ce qui est réellement perdu ou dépensé pendant une heure d’arrêt : revenu non encaissé, pénalités contractuelles, personnes payées mais bloquées, heures de remise en état, effet sur la réputation quand il est mesurable. Un ordre de grandeur suffit, à condition qu’il soit assumé par la direction.' },
        { h: '4. Relier chaque activité à ce dont elle dépend' },
        { p: 'C’est l’étape qui transforme le document en outil. Une activité dépend de systèmes, de personnes, de fournisseurs et de sites. Tant que ce lien n’est pas écrit, personne ne peut dire quelle panne technique menace quelle activité, ni combien elle coûte.' },
        { h: '5. Vérifier et dater' },
        { p: 'Un BIA sans date de validation ne vaut rien en audit. Notez qui a validé quoi, et quand. Les chiffres se périment, les dépendances changent, les personnes partent.' },
        { quote: 'Un BIA utile tient en une page par activité, et se met à jour tout seul entre deux revues.' },
        { h: 'Ce que Lenexux automatise' },
        { p: 'Les étapes 4 et 5 sont celles qui coûtent le plus de temps manuellement. Lenexux tient le lien entre activités, systèmes, personnes et fournisseurs dans un graphe, calcule l’impact d’une interruption à partir du coût horaire et du délai de rétablissement, et garde la trace de qui a validé chaque dépendance. Le document exigé en audit se regénère alors à la demande, avec les chiffres du jour.' },
      ],
      en: [
        { p: 'Business impact analysis, or BIA, is the document auditors, insurers and regulators ask for. It is too often produced once a year in a spreadsheet, then filed away. Here is how to keep it alive.' },
        { h: '1. List activities, not applications' },
        { p: 'An activity is stated in business terms: granting a loan, paying salaries, delivering an order. If your list contains software names, you are listing tools, not activities.' },
        { h: '2. Set the tolerable interruption time' },
        { p: 'Two figures per activity. How long it can stop before consequences become serious, and how much data loss is acceptable. Have them validated by the business owner, not by IT: the owner bears the consequence.' },
        { h: '3. Price one hour of downtime' },
        { p: 'Add up what is actually lost or spent during one hour of downtime: revenue not collected, contractual penalties, staff paid but idle, recovery hours, reputation effects where measurable. An order of magnitude is enough, as long as management owns it.' },
        { h: '4. Link every activity to what it depends on' },
        { p: 'This is the step that turns the document into a tool. An activity depends on systems, people, suppliers and sites. Until that link is written down, nobody can say which technical failure threatens which activity, or what it costs.' },
        { h: '5. Validate and date' },
        { p: 'A BIA with no validation date is worthless in an audit. Record who validated what, and when. Figures go stale, dependencies change, people leave.' },
        { quote: 'A useful BIA fits on one page per activity, and updates itself between reviews.' },
        { h: 'What Lenexux automates' },
        { p: 'Steps 4 and 5 are the most time-consuming by hand. Lenexux keeps the link between activities, systems, people and suppliers in a graph, computes the impact of an interruption from the hourly cost and recovery time, and records who validated each dependency. The document required at audit time can then be regenerated on demand, with current figures.' },
      ],
    },
  },
  {
    slug: 'plan-de-continuite-activite-graphe',
    date: '2026-09-05',
    readMinutes: 5,
    tag: ['Guide', 'Guide'],
    title: [
      'Plan de continuité d’activité : ce que change un graphe de dépendances',
      'Business continuity plan: what a dependency graph changes',
    ],
    summary: [
      'Un plan de continuité se juge le jour de la panne. Trois défauts reviennent toujours, et un graphe de dépendances en corrige deux.',
      'A continuity plan is judged on the day of the outage. Three flaws come back every time, and a dependency graph fixes two of them.',
    ],
    body: {
      fr: [
        { p: 'Presque toutes les organisations ont un plan de continuité. Peu s’en servent le jour venu. Les raisons se répètent d’un audit à l’autre.' },
        { h: 'Défaut 1 : le plan décrit des scénarios, la réalité en invente d’autres' },
        { p: 'Un plan couvre l’incendie, l’inondation, la panne du centre de données. Le jour venu, c’est un prestataire de paiement qui tombe, ou l’unique personne qui connaît un système qui est en arrêt maladie. Le plan est muet, parce qu’il a été écrit scénario par scénario au lieu d’être écrit dépendance par dépendance.' },
        { h: 'Défaut 2 : personne ne sait ce qui dépend de quoi' },
        { p: 'Pendant l’incident, la première demi-heure sert à découvrir qui est touché. Avec une carte des dépendances à jour, cette demi-heure disparaît : on lit la liste des activités affectées, et on sait qui prévenir.' },
        { h: 'Défaut 3 : les priorités ne sont pas chiffrées' },
        { p: 'Quand trois choses sont à rétablir en même temps, l’équipe choisit à l’instinct. Un coût horaire par activité rend l’arbitrage évident, et il est défendable après coup devant la direction.' },
        { quote: 'Le plan ne sert pas à prévoir la panne. Il sert à raccourcir la demi-heure où personne ne sait quoi faire.' },
        { h: 'Ce qu’un graphe ne remplace pas' },
        { p: 'Un graphe de dépendances ne remplace ni les exercices de crise, ni les sauvegardes testées, ni les contacts à jour. Il remplace la partie qui vieillit le plus vite : la liste de ce qui dépend de quoi, et le chiffrage des conséquences. Le reste reste un travail d’équipe.' },
        { h: 'Par où commencer' },
        { p: 'Reprenez votre plan actuel et, pour chacune des trois activités les plus critiques, écrivez la chaîne complète de ce dont elles dépendent, personnes et fournisseurs compris. Vous verrez immédiatement les maillons que le plan ne couvre pas.' },
      ],
      en: [
        { p: 'Almost every organisation has a continuity plan. Few use it when the day comes. The reasons repeat from one audit to the next.' },
        { h: 'Flaw 1: the plan describes scenarios, reality invents others' },
        { p: 'A plan covers fire, flood, data centre failure. On the day, it is a payment provider going down, or the only person who knows a system being on sick leave. The plan is silent, because it was written scenario by scenario instead of dependency by dependency.' },
        { h: 'Flaw 2: nobody knows what depends on what' },
        { p: 'During the incident, the first half hour goes into discovering who is affected. With an up-to-date dependency map, that half hour disappears: you read the list of affected activities and know who to warn.' },
        { h: 'Flaw 3: priorities are not priced' },
        { p: 'When three things must be restored at once, the team chooses by instinct. An hourly cost per activity makes the trade-off obvious, and defensible afterwards in front of management.' },
        { quote: 'The plan is not there to predict the outage. It is there to shorten the half hour when nobody knows what to do.' },
        { h: 'What a graph does not replace' },
        { p: 'A dependency graph replaces neither crisis exercises, nor tested backups, nor up-to-date contact lists. It replaces the part that ages fastest: the list of what depends on what, and the pricing of consequences. The rest remains teamwork.' },
        { h: 'Where to start' },
        { p: 'Take your current plan and, for each of the three most critical activities, write the full chain of what they depend on, people and suppliers included. You will immediately see the links the plan does not cover.' },
      ],
    },
  },
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
      'Une décision d’organisation n’est pas une ligne de budget. C’est une modification de l’entreprise réelle, et ses conséquences se lisent dans les dépendances.',
      'An organisational decision is not a budget line. It is a change to the real company, and its consequences can be read in the dependencies.',
    ],
    body: {
      fr: [
        { p: 'Remplacer une personne qui part à la retraite, recruter un expert, migrer un logiciel central : ces décisions sont souvent évaluées sur un tableau à deux colonnes, ce que ça coûte, ce que ça rapporte. Ce qui manque presque toujours, c’est la troisième colonne : ce que la décision touche.' },
        { h: 'Ce qu’un tableur ne voit pas' },
        { p: 'La personne qui part est peut-être la seule à savoir redémarrer un système dont dépend une activité critique. Le nouvel expert arrivera avec ses outils, et donc avec un nouveau fournisseur, des données qui sortiront peut-être du pays, et une nouvelle personne clé. Le logiciel migré est relié à d’autres systèmes qu’il faudra reconnecter le jour de la bascule.' },
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
        { p: 'Replacing someone who retires, hiring an expert, migrating a core system: these decisions are often assessed on a two-column sheet, what it costs, what it brings. What is almost always missing is the third column: what the decision touches.' },
        { h: 'What a spreadsheet does not see' },
        { p: 'The person leaving may be the only one who knows how to restart a system a critical activity depends on. The new expert will come with their tools, hence a new supplier, data that may leave the country, and a new key person. The migrated software is linked to other systems that must be reconnected on switch-over day.' },
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
        { p: 'Un chiffre d’impact n’a de valeur que s’il peut être expliqué à un comité de direction, et contesté. C’est pourquoi le calcul de Lenexux est déterministe : les mêmes données donnent toujours le même résultat, et chaque étape peut être montrée.' },
        { h: '1. Qu’est-ce qui tombe ?' },
        { p: 'Tout part du graphe de dépendances. Quand un élément tombe, on suit les relations « dépend de » à rebours : tout ce qui s’appuyait sur lui est touché, puis ce qui s’appuyait sur ceux-là, et ainsi de suite. C’est la cascade.' },
        { h: '2. Combien coûte une heure d’arrêt ?' },
        { p: 'Chaque élément touché a un coût horaire d’indisponibilité. S’il a été renseigné, c’est lui qui est utilisé. Sinon, il est estimé à partir de sa criticité, avec des paliers étalonnés sur le chiffre d’affaires de l’organisation : une heure d’arrêt n’a pas le même poids pour une PME que pour un groupe.' },
        { h: '3. Combien de temps pour revenir ?' },
        { p: 'La durée de rétablissement dépend de la nature de l’élément, on redémarre plus vite une application qu’on ne remplace un fournisseur, et de sa criticité. Elle est réglable par organisation.' },
        { h: '4. Tout ne casse pas à coup sûr' },
        { p: 'Plus on s’éloigne de la panne d’origine, moins il est certain que l’effet se propage. Une probabilité décroissante avec la distance pondère chaque élément. On obtient deux chiffres : le pire cas, où tout casse jusqu’au bout, et le cas attendu, pondéré par la probabilité.' },
        { quote: 'Un chiffre d’impact qu’on ne peut pas décomposer est une opinion.' },
        { h: 'Et la qualité des données ?' },
        { p: 'Un chiffrage ne vaut que ce que valent les dépendances sur lesquelles il repose. Chaque relation porte donc ses preuves, import, observation en direct, validation humaine, inférence IA, et le résultat affiche la solidité de sa base : combien de dépendances sont validées, combien sont fragiles, et lesquelles aller vérifier.' },
      ],
      en: [
        { p: 'An impact figure is only valuable if it can be explained to an executive committee, and challenged. That is why Lenexux’s computation is deterministic: the same data always gives the same result, and every step can be shown.' },
        { h: '1. What goes down?' },
        { p: 'It all starts from the dependency graph. When an element fails, “depends on” relations are followed backwards: everything that relied on it is hit, then whatever relied on those, and so on. That is the cascade.' },
        { h: '2. What does an hour of downtime cost?' },
        { p: 'Each affected element has an hourly downtime cost. If it has been entered, it is used. Otherwise it is estimated from its criticality, with tiers calibrated on the organisation’s revenue: an hour of downtime does not weigh the same for a small business as for a group.' },
        { h: '3. How long to recover?' },
        { p: 'Recovery time depends on the element’s nature, an application restarts faster than a supplier is replaced, and on its criticality. It is adjustable per organisation.' },
        { h: '4. Not everything breaks for sure' },
        { p: 'The further from the original failure, the less certain the effect spreads. A probability that decreases with distance weights each element. Two figures come out: the worst case, where everything breaks all the way, and the expected case, weighted by probability.' },
        { quote: 'An impact figure you cannot break down is an opinion.' },
        { h: 'And data quality?' },
        { p: 'A costing is only as good as the dependencies it rests on. Each relation therefore carries its evidence, import, live observation, human validation, AI inference, and the result shows how solid its basis is: how many dependencies are validated, how many are weak, and which ones to go and check.' },
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
        { p: 'On imagine volontiers le point unique de défaillance comme une machine sans secours. C’est le cas le plus visible, et souvent le mieux traité. Les plus dangereux sont ailleurs.' },
        { h: 'Les trois familles oubliées' },
        { ul: [
          'Les personnes : celle qui est seule à savoir clôturer le mois, redémarrer un système ou négocier avec un partenaire.',
          'Les fournisseurs : un opérateur, un hébergeur, un éditeur dont dépendent plusieurs activités sans alternative prévue.',
          'Les maillons discrets : un tableur partagé, une clé d’accès, un service cloud souscrit par une équipe et connu d’elle seule.',
        ] },
        { h: 'Pourquoi on ne les voit pas' },
        { p: 'Chaque outil de l’entreprise voit son propre silo : l’inventaire informatique connaît les serveurs, le service achats connaît les contrats, les ressources humaines connaissent les postes. Le point unique de défaillance se trouve presque toujours à la jonction de ces silos, là où aucun outil ne regarde.' },
        { quote: 'Un point unique de défaillance est une dépendance que personne n’a écrite.' },
        { h: 'Les faire apparaître' },
        { p: 'Relier ces silos dans un même graphe suffit à faire apparaître la plupart d’entre eux : un élément dont dépend une activité, sans secours déclaré, et une personne seule à en détenir le savoir. Une fois visibles, ils se traitent : un second détenteur formé, un fournisseur de repli, une procédure écrite. Le travail n’est pas spectaculaire. Il évite simplement de découvrir la dépendance le jour où elle casse.' },
      ],
      en: [
        { p: 'We tend to picture a single point of failure as a machine with no backup. That is the most visible case, and often the best handled. The most dangerous ones are elsewhere.' },
        { h: 'The three forgotten families' },
        { ul: [
          'People: the only one who knows how to close the month, restart a system or negotiate with a partner.',
          'Suppliers: an operator, a host, a vendor several activities depend on with no planned alternative.',
          'Discreet links: a shared spreadsheet, an access key, a cloud service subscribed by one team and known only to it.',
        ] },
        { h: 'Why we do not see them' },
        { p: 'Each company tool sees its own silo: the IT inventory knows servers, procurement knows contracts, HR knows roles. The single point of failure almost always sits at the junction of these silos, where no tool looks.' },
        { quote: 'A single point of failure is a dependency nobody wrote down.' },
        { h: 'Making them visible' },
        { p: 'Linking these silos in one graph is enough to surface most of them: an element an activity depends on, with no declared backup, and a single person holding its knowledge. Once visible, they can be handled: a second trained holder, a fallback supplier, a written procedure. The work is not spectacular. It simply avoids discovering the dependency on the day it breaks.' },
      ],
    },
  },
]

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug)
