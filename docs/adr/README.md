# Architecture Decision Records (ADR)

Chaque décision structurante est consignée ici (article 71) au format : **contexte / problème → options → décision → conséquences**.

| ADR | Décision | Statut |
|---|---|---|
| [ADR-0001](ADR-0001-modular-monolith.md) | Modular monolith plutôt que microservices au départ | Accepté |
| [ADR-0002](ADR-0002-neo4j-for-graph.md) | Neo4j pour le knowledge graph | Accepté |
| [ADR-0003](ADR-0003-dotnet-aspnetcore.md) | .NET 10 / ASP.NET Core pour le backend | Accepté |
| [ADR-0004](ADR-0004-pgvector-over-dedicated-vector-db.md) | PostgreSQL + pgvector avant une base vectorielle dédiée | Accepté |
| [ADR-0005](ADR-0005-multi-tenancy.md) | Isolation multi-tenant par `tenantId` (shared schema) | Accepté |
| [ADR-0006](ADR-0006-confidence-and-lineage.md) | Confidence Engine + data lineage sur chaque relation | Accepté |
| [ADR-0007](ADR-0007-deterministic-first-ai-overlay.md) | Déterministe d'abord, IA en surcouche | Accepté |
| [ADR-0008](ADR-0008-read-only-first.md) | Intégrations read-only par défaut | Accepté |

**Statuts possibles** : Proposé · Accepté · Déprécié · Remplacé par ADR-XXXX.
