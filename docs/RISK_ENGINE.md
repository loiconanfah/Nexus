# NEXUS — Risk Engine

Version : 1.0 (Phase 3) · Articles 14-15, 27 · Voir [ADR-0007](adr/ADR-0007-deterministic-first-ai-overlay.md)

Le Risk Engine est **déterministe et explicable** : aucune boîte noire, aucun
coefficient hardcodé. La formule et les seuils proviennent du profil de risque
du tenant (`risk_profile`, configurable — article 14).

## 1. Facteurs (`RiskInput`, normalisés [0, 1])

| Facteur | Signification | Source déterministe |
|---|---|---|
| `Criticality` | criticité effective de l'entité | Criticality Engine |
| `PropagationPotential` | portée d'une panne (rayon d'explosion) | blast radius (graphe) |
| `Concentration` | nombre de dépendants directs | graphe |
| `DependencyDepth` | étendue de ses propres dépendances | graphe |
| `LackOfRedundancy` | absence de backup/reprise | graphe |
| `Uncertainty` | 1 − confiance moyenne des dépendances | Confidence Engine |

## 2. Formule (configurable)

```text
score = 100 × Σ(valeurᵢ × poidsᵢ) / Σ(poidsᵢ)        // moyenne pondérée, 0-100
```

Les poids (`RiskWeights`) et seuils (`RiskThresholds`) sont stockés par tenant.
Bandes (article 14) : `LOW ≤20`, `MODERATE ≤40`, `ELEVATED ≤60`, `HIGH ≤80`, `CRITICAL >80`.

## 3. Explicabilité

Chaque évaluation (`RiskAssessment`) expose la **décomposition** : pour chaque
facteur, sa valeur, son poids et sa **contribution en points**, triée par
contribution décroissante — le « pourquoi » du score est directement lisible
(article 22). C'est ce que l'AI Analyst citera comme evidence.

## 4. Criticality Engine (articles 14-15)

Criticité effective = `max(criticité déclarée, criticité structurelle)`, où la
criticité structurelle croît avec le nombre de dépendants. Un actif « secondaire »
dont dépendent beaucoup de systèmes voit ainsi sa criticité remonter
automatiquement (criticité disproportionnée — article 1).

## 5. Orchestration

`RiskAnalyzer.AssessEntityAsync` rassemble les facteurs depuis le graphe et
renvoie un `EntityRisk` (assessment + signaux : criticité effective, dépendants
directs, blast radius, redondance). Point d'entrée « risque d'une entité ».

## 6. SPOF (article 27)

Voir [SIMULATION_ENGINE.md](SIMULATION_ENGINE.md#3-spof). Un SPOF est une entité
sans redondance dont dépendent d'autres ; le score combine portée et criticité.
