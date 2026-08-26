# ADR-0007 — Déterministe d'abord, IA en surcouche

Statut : **Accepté** · Date : Phase 0

## Contexte / Problème
NEXUS contient de l'IA, mais un moteur opaque produirait des résultats non vérifiables — inacceptable pour des décisions de continuité et de risque. Le master prompt (articles 14, 19, 22) impose que l'IA ne remplace pas le moteur déterministe.

## Options
1. **IA-first** — le LLM raisonne sur les données brutes ; rapide à prototyper, mais non explicable et coûteux.
2. **Déterministe d'abord** — graphe + règles calculent dépendances, risques et propagation ; l'IA reçoit des **données structurées** et explique/enrichit.

## Décision
Option 2. Ordre d'exécution : `deterministic query → graph → rules → AI only when needed` (article 68). Le LLM ne calcule pas le risque ; il explique, compare, résume, recommande — toujours avec evidence et niveau de confiance. Garde-fous de l'article 22 appliqués.

## Conséquences
- ✅ Résultats reproductibles, explicables et auditables.
- ✅ Coût IA maîtrisé (appels ciblés, caching des embeddings/réponses — article 69).
- ✅ Architecture d'agents spécialisés possible plus tard, sans agentification artificielle (article 23).
- ⚠️ Plus d'effort initial sur les moteurs déterministes (Phase 3) — c'est voulu et constitue la valeur.
