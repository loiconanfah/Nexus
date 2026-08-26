# ADR-0001 — Modular monolith plutôt que microservices au départ

Statut : **Accepté** · Date : Phase 0

## Contexte / Problème
NEXUS comporte de nombreux modules (ingestion, graphe, risque, IA…). La tentation microservices est forte, mais elle impose tôt un coût d'exploitation (réseau, déploiement, observabilité distribuée, cohérence des données) sans bénéfice tant que la charge et l'équipe sont réduites. Le master prompt (article 6) demande explicitement d'« éviter une architecture microservices excessive au départ ».

## Options
1. **Microservices dès le départ** — scalabilité indépendante, mais complexité et lenteur de développement élevées.
2. **Monolithe classique** — simple, mais frontières floues, dette rapide.
3. **Modular monolith** — un seul déployable, frontières de modules nettes (projets .NET séparés, règles de dépendance), extraction possible plus tard.

## Décision
Option 3. Un **modular monolith** : projets `Nexus.*` avec des références contrôlées (le Domaine ne dépend de rien d'infra), un seul point de composition (`Nexus.Api`). Les traitements lourds (import, simulation) sont conçus pour devenir asynchrones (event-driven, article 50) afin de préparer une extraction ultérieure.

## Conséquences
- ✅ Vitesse de développement, transaction et débogage simples, refactoring aisé.
- ✅ Frontières explicites → extraction en service possible sans réécriture.
- ⚠️ Discipline nécessaire pour ne pas violer les règles de dépendance (vérifiées en revue/CI).
- ➡️ Réévaluer l'extraction de `Nexus.Ingestion` et `Nexus.AI` quand la charge le justifie.
