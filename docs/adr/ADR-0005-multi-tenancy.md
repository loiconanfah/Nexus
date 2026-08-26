# ADR-0005 — Isolation multi-tenant par `tenantId` (shared schema)

Statut : **Accepté** · Date : Phase 0

## Contexte / Problème
NEXUS est multi-tenant (article 41) et doit garantir qu'un tenant ne lit jamais les données d'un autre — la carte des dépendances est hautement sensible. Il faut aussi supporter des modes *private cloud* et *on-prem* (article 47).

## Options
1. **Shared schema + colonne `tenantId`** — simple, économique, scalable ; risque de fuite si un filtre est oublié.
2. **Schéma/base par tenant** — isolation forte, mais coût opérationnel et migrations multipliés.
3. **Instance par tenant** — isolation maximale, réservée aux déploiements dédiés.

## Décision
Option 1 par défaut (**SaaS**) : `tenantId` sur chaque entité PostgreSQL et chaque noeud/relation Neo4j ; le `tenantId` provient **du token**, jamais du client. Options 2/3 réservées aux modes *private cloud* / *on-prem*.
Durcissement : Row-Level Security PostgreSQL, et **tests d'isolation obligatoires** (article 51).

## Conséquences
- ✅ Économique et scalable ; un seul schéma à faire évoluer.
- ✅ Chemin de sur-isolation disponible pour clients sensibles (bases/labels séparés).
- ⚠️ Chaque requête (SQL, Cypher, vectorielle) **doit** être filtrée par `tenantId` → filtre centralisé + tests d'isolation en CI.
- ➡️ RLS PostgreSQL planifiée en durcissement (Phase 6).
