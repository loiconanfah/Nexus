# NEXUS — API REST

Version : 1.0 · Articles 48-49 (API-first) · Base : `/api/v1`

Tout ce que fait NEXUS est accessible par API. OpenAPI est exposé en
développement sur `/openapi/v1.json`. Les enums sont sérialisés en chaînes.

## Authentification & tenant

En production, le tenant provient du **jeton** (OIDC/Entra, article 41). En
développement, un **stub** le lit dans l'en-tête `X-Tenant-Id` (GUID) — voir
`HeaderTenantProvider`, à remplacer en Phase 6. Sans tenant valide : `400`.

## Santé

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/health/ready` | Readiness (PostgreSQL + Neo4j) |

## Ingestion (read-only)

| Méthode | Route | Corps |
|---|---|---|
| POST | `/api/v1/imports/csv` | multipart : `file`, `profile` (MappingProfile JSON), `delimiter?`, `hasHeader?` |
| POST | `/api/v1/imports/excel` | multipart : `file`, `profile`, `hasHeader?` |

Réponse : `ImportResult` (`recordsRead`, `entitiesCreated`, `entitiesMatched`,
`relationsCreated`, `relationsUnresolved`, `skipped`, `duration`, `timeToFirstGraph`).

## Entités & dépendances

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/v1/entities/search?name=&type=` | Résolution exacte (+ suggestions floues si absente) |
| GET | `/api/v1/entities/{id}` | Détail |
| GET | `/api/v1/entities/{id}/dependencies` | Dépendances directes (confiance + statut) |
| GET | `/api/v1/entities/{id}/dependents` | Dépendants directs |
| GET | `/api/v1/entities/{id}/risk` | Risque **explicable** (score, bande, décomposition par facteur) |

## Risque & simulation

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/v1/risks/spof?limit=` | Single points of failure classés (article 27) |
| POST | `/api/v1/simulations` | What-If : `{ assetId, scenario, maxDepth }` → cascade d'impacts |

Scénarios : `ServerFailure`, `DatabaseFailure`, `ApplicationFailure`,
`NetworkFailure`, `SupplierFailure`, `EmployeeLoss`, `LocationFailure`,
`CloudRegionFailure`, `CyberIncident`, `DataLoss`, `PowerOutage`, `CommunicationFailure`.

## Exemple (curl)

```bash
TENANT="$(uuidgen)"
# 1. Importer des actifs, puis des dépendances
curl -X POST localhost:5199/api/v1/imports/csv -H "X-Tenant-Id: $TENANT" \
     -F "file=@assets.csv" -F "profile=<profile_assets.json"
# 2. Simuler une panne
curl -X POST localhost:5199/api/v1/simulations -H "X-Tenant-Id: $TENANT" \
     -H "Content-Type: application/json" \
     -d '{"assetId":"<id>","scenario":"ServerFailure"}'
```

## À venir

- Webhooks (`risk.created`, `simulation.completed`… — article 49).
- Endpoints documents/RAG & AI Analyst (Phase 5).
- Clés API, rate limiting, versioning formel (Phase 6).
