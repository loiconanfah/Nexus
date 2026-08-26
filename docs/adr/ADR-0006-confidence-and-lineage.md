# ADR-0006 — Confidence Engine + data lineage sur chaque relation

Statut : **Accepté** · Date : Phase 0

## Contexte / Problème
Les dépendances proviennent de sources hétérogènes (CMDB fiable, Excel approximatif, inférence, suggestion IA). Les traiter toutes comme des faits certains produirait des analyses fausses et non défendables. NEXUS doit toujours pouvoir répondre : *« Pourquoi penses-tu que ces deux systèmes sont liés ? »* (articles 9, 12).

## Options
1. **Relations binaires** (existe / n'existe pas) — simple mais faux et non traçable.
2. **Confidence + statut + lineage** — chaque relation porte un score `0→1`, un statut (`VERIFIED/IMPORTED/INFERRED/AI_SUGGESTED/UNKNOWN`) et une provenance complète.

## Décision
Option 2. Chaque relation porte les propriétés de l'article 8 (confidence, status, sourceSystem, sourceRecord, evidence, verifiedAt/By). La provenance détaillée est stockée dans `data_lineage` (PostgreSQL) et reliée à la relation Neo4j par `graph_edge_id`.
Règle : les relations `AI_SUGGESTED`/`UNKNOWN` sont **exclues par défaut** des calculs de risque fermes ; aucune fusion d'entité critique ni promotion automatique sans franchir un seuil de confiance.

## Conséquences
- ✅ Analyses défendables et explicables ; l'utilisateur peut valider/promouvoir.
- ✅ Constitue une partie du *moat* (article 62) : la logique de confiance est difficile à reproduire.
- ⚠️ Toute écriture de relation doit renseigner confidence + lineage → imposé par le pipeline d'ingestion.
- ➡️ Alimente directement le Risk Engine et l'AI Analyst (evidence/citations).
