# NEXUS — Connecteurs & Ingestion

Version : 1.0 (Phase 2) · Articles 10-13 · Voir [ADR-0009](adr/ADR-0009-connector-responsibility-boundary.md)

Le moteur d'ingestion transforme des sources hétérogènes en graphe de
dépendances, **en lecture seule** (ADR-0008), avec confiance et lineage.

## 1. Pipeline

```text
Source ─▶ Extract ─▶ Normalize ─▶ Resolve ─▶ Map ─▶ Write (graphe + lineage)
        (IConnector)  (Ontologie)  (dédup)         (Neo4j)   (PostgreSQL)
```

- **Extract** : le connecteur streame des `RawRecord` (aucune logique métier).
- **Normalize** : `NormalizationEngine` valide types/colonnes contre le registre d'ontologie → `EntityCandidate` / `RelationCandidate`.
- **Resolve** : `IEntityResolver` rapproche un candidat d'une entité existante (exact + alias, insensible à la casse ; suggestions floues via l'index full-text Neo4j). Jamais de fusion automatique d'entité critique sous seuil (article 11).
- **Map/Write** : `ImportPipeline` écrit nœuds et relations dans Neo4j (confiance + statut `IMPORTED`), avec **id de relation déterministe** (mêmes source/cible/type ⇒ une seule arête, ré-import idempotent), et le **data lineage** dans PostgreSQL (article 12).

Deux passes : entités d'abord (peuple le cache de résolution), relations ensuite.

## 2. `IConnector`

```csharp
ConnectorMetadata Metadata { get; }
Task<Result> ValidateConnectionAsync(ct);
Task<IReadOnlyList<DatasetDescriptor>> DiscoverAsync(ct);
IAsyncEnumerable<RawRecord> ExtractAsync(string dataset, ct);   // streaming
Task<ConnectorHealth> HealthCheckAsync(ct);
```

Connecteurs livrés (Phase 2, read-only, premier niveau — article 10) :

| Type | Classe | Datasets |
|---|---|---|
| `csv` | `CsvConnector` | le fichier |
| `excel` | `ExcelConnector` | une feuille = un dataset |

## 3. Profil de mapping (déclaratif)

Le mapping est **une donnée** (`MappingProfile`), pas du code — configurable par tenant.

```csharp
new MappingProfile(
  SourceSystem: "Demo Excel",
  Entities: [
    new EntityMapping(Dataset:"assets", EntityType:"Asset", NameColumn:"name",
                      AliasColumns:["alias"], CriticalityColumn:"criticality",
                      EntityTypeColumn:"type")   // type par ligne
  ],
  Relations: [
    new RelationMapping(Dataset:"deps", RelationType:"DEPENDS_ON",
                        SourceEntityType:"Server", SourceNameColumn:"source",
                        TargetEntityType:"Server", TargetNameColumn:"target",
                        SourceTypeColumn:"source_type", TargetTypeColumn:"target_type")
  ]);
```

## 4. Résultat & KPI

`ImportResult` : `RecordsRead`, `EntitiesCreated`, `EntitiesMatched`,
`RelationsCreated`, `RelationsUnresolved`, `Skipped`, `Duration`, et surtout
**`TimeToFirstGraph`** — le KPI central (article 65) : délai avant la première
écriture dans le graphe.

## 5. Résolution d'entités (dédup)

Une même ressource nommée différemment (« SQL01 », « database-server-001 ») se
résout vers **une seule** entité NEXUS grâce aux alias. Validé par test
d'intégration (`IngestionIntegrationTests`) : une dépendance déclarée via l'alias
du serveur produit la même arête que via son nom canonique.

## 6. Feuille de route

Niveaux 2-3 (post-MVP) : Microsoft 365, Azure, Entra ID, SQL Server, ServiceNow,
Jira… avec `Authenticate`, pagination, rate-limit, sync incrémental (article 10).
