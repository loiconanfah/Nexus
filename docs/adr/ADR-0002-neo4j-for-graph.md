# ADR-0002 — Neo4j pour le knowledge graph

Statut : **Accepté** · Date : Phase 0

## Contexte / Problème
Le cœur de NEXUS est un modèle de dépendances : traversées multi-sauts, chemins les plus courts, détection de cycles, propagation en cascade, centralité, communautés (articles 13, 17, 58). Ces opérations sont coûteuses et peu naturelles en SQL relationnel (jointures récursives) au-delà de quelques niveaux et à grande échelle (jusqu'à 1M+ noeuds, article 67).

## Options
1. **PostgreSQL récursif (CTE)** — pas de dépendance supplémentaire, mais performances et expressivité limitées pour les traversées profondes.
2. **Neo4j** — base graphe native, Cypher, algorithmes GDS (PageRank, betweenness, shortest path, community detection).
3. **Autres bases graphe** (JanusGraph, Neptune…) — soit couplage cloud fort, soit exploitation plus lourde.

## Décision
Option 2 : **Neo4j** (Community en local via Docker + plugins GDS/APOC ; AuraDB ou conteneur managé en cloud). PostgreSQL reste le plan de contrôle ; Neo4j porte le plan opérationnel (graphe).

## Conséquences
- ✅ Traversées, chemins, propagation et algos de graphe natifs et performants.
- ✅ Cypher expressif pour le Dependency/Propagation Engine.
- ⚠️ Deux moteurs de stockage à opérer et à garder cohérents (lien via `data_lineage` + UUID générés par NEXUS).
- ⚠️ Licence : rester sur Community/AuraDB ; documenter tout usage de fonctionnalités Enterprise.
- ➡️ Voir [DOMAIN_MODEL.md](../DOMAIN_MODEL.md) pour la répartition PostgreSQL/Neo4j.
