# ADR-0009 — Frontière de responsabilité des connecteurs

Statut : **Accepté** · Date : Phase 2

## Contexte / Problème
L'article 10 liste de nombreuses capacités attendues d'un connecteur
(`GetMetadata`, `ValidateConnection`, `Discover`, `Extract`, `Normalize`,
`Map`, `Sync`, `HealthCheck`). Mettre la normalisation et le mapping vers
l'ontologie DANS chaque connecteur dupliquerait cette logique à travers tous
les connecteurs (CSV, Excel, REST, Azure…) et les couplerait à l'ontologie.

## Options
1. **Connecteur « épais »** : chaque connecteur normalise et mappe lui-même.
2. **Connecteur « fin »** : le connecteur ne fait que se connecter et extraire
   des enregistrements bruts (streaming) ; la normalisation, la résolution
   d'entités et le mapping sont centralisés dans le pipeline d'ingestion,
   pilotés par un `MappingProfile` déclaratif.

## Décision
Option 2. `IConnector` expose `Metadata`, `ValidateConnectionAsync`,
`DiscoverAsync`, `ExtractAsync` (streaming) et `HealthCheckAsync`. La
normalisation (`NormalizationEngine`), la résolution (`IEntityResolver`) et le
mapping/écriture (`ImportPipeline`) vivent dans `Nexus.Ingestion`, guidés par
un `MappingProfile` (JSON-sérialisable). Les types d'entités/relations sont
validés contre le registre d'ontologie.

## Conséquences
- ✅ Connecteurs simples, interchangeables et rapides à ajouter (moat, article 62).
- ✅ Logique de normalisation/résolution unique et testable, réutilisée par
  toutes les sources.
- ✅ Le mapping est une donnée (profil) et non du code → configurable par tenant.
- ⚠️ Le pipeline doit connaître la forme des données via le profil ; un mauvais
  profil produit des lignes ignorées (comptées), pas des exceptions.
- ➡️ `Authenticate`/`Sync`/pagination/rate-limit seront ajoutés aux connecteurs
  distants (Azure, REST) où ils ont un sens, sans alourdir les connecteurs fichier.
