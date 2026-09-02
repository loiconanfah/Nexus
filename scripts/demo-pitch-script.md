# Démo Lenexus — Pitch investisseurs (~75 s)

Script de narration synchronisé au parcours auto-piloté `scripts/demo-drive.mjs`.
Tu lances le parcours, tu enregistres l'écran (OBS/Loom), et tu lis la narration
par-dessus.

## Comment enregistrer

1. Lance la démo locale : backend sur `:5199` et front Vite sur `:5173`
   (ou utilise `--deployed` pour le site en ligne).
2. Prépare ton enregistreur (OBS : *Capture de fenêtre* → la fenêtre Chrome ;
   ou Loom : fenêtre). Résolution conseillée 1600×900.
3. Démarre l'enregistrement, puis lance :
   ```bash
   node scripts/demo-drive.mjs
   ```
4. Une fenêtre Chrome s'ouvre et **joue la démo toute seule** (~75 s). Lis la
   narration ci-dessous au rythme des scènes. Arrête l'enregistrement à la fin.

Astuce : fais un premier passage « à blanc » pour caler ta voix sur les
transitions, puis un second pour la prise finale.

## Narration

| Temps | À l'écran | Narration (FR) | Voice-over (EN) |
|---|---|---|---|
| 0–8 s | Vitrine (accroche) | « Chaque organisation prend des décisions critiques qui traversent des dizaines de systèmes — ERP, CRM, IT, fournisseurs. Personne n'a la vue d'ensemble. » | “Every organization makes critical decisions that cut across dozens of systems — ERP, CRM, IT, suppliers. Nobody owns the full picture.” |
| 8–14 s | Graphe de dépendances | « Lenexus cartographie tout — systèmes, fournisseurs, personnes — en un seul graphe vivant. » | “Lenexus maps it all — systems, suppliers, people — into a single living graph.” |
| 14–26 s | Impact transversal (question → résultat) | « Posez une question en langage naturel : *que se passe-t-il si nous perdons ce fournisseur ?* En une seconde, Lenexus relie les silos et chiffre l'impact : vingt composants menacés, plus de trois millions exposés, et le point unique de défaillance identifié. » | “Ask in plain language: *what happens if we lose this supplier?* In one second, Lenexus links the silos and quantifies the impact: twenty components at risk, over three million exposed, and the single point of failure pinpointed.” |
| 26–45 s | Simulation holographique (Faire tomber → cascade) | « Et vous pouvez le simuler en direct. Faites tomber un élément et regardez la panne se propager — directs, indirects, coût, temps de rétablissement — élément par élément, avec l'analyse IA. » | “And you can simulate it live. Take an element down and watch the outage propagate — direct, indirect, cost, recovery time — element by element, with AI analysis.” |
| 45–60 s | Vue d'ensemble | « Ce n'est pas un ERP de plus. C'est la couche au-dessus qui répond aux questions que chaque outil, seul, ne voit qu'à moitié. » | “This isn't another ERP. It's the layer on top that answers the questions each tool, on its own, only half-sees.” |
| 60–75 s | Vitrine (clôture) | « Lenexus : savoir ce qui casse, avant que l'activité n'en pâtisse. » | “Lenexus: know what breaks, before the business does.” |

## Variantes courtes (clips 30–60 s)

- **Clip Impact** (0–26 s ci-dessus) : le problème + la question en langage naturel.
- **Clip Simulation** (scène 4 seule) : « Faites tomber n'importe quel élément et
  voyez l'onde de choc chiffrée, en temps réel. »
- **Clip Inférence** (page Dépendances inférées) : « Un graphe qui apprend :
  Lenexus propose les dépendances manquantes, vous validez. »

## Conseils

- Voix posée, phrases courtes. Laisse respirer sur le moment « wow » (la cascade).
- Coupe le son système de Chrome.
- Pour une version muette : ajoute des sous-titres reprenant la colonne FR/EN.
- Le parcours est **reproductible** : relance `demo-drive.mjs` autant que besoin.
