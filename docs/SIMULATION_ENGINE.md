# NEXUS — Dependency, Propagation & Simulation Engines

Version : 1.0 (Phase 3) · Articles 13, 16-18, 27

Les moteurs déterministes répondent à « Show me what breaks / what it affects »
en parcourant le knowledge graph. Ils ne traversent que les relations
**« source dépend de cible »** (`CarriesDependency` : `DEPENDS_ON`, `RUNS_ON`,
`USES`, `REQUIRES`, `SUPPLIED_BY`, `AUTHENTICATES`). La panne d'une cible remonte
vers ses dépendants (arêtes entrantes).

## 1. Dependency Engine (article 13)

Traversées (`IDependencyQueries`, Neo4j/Cypher paramétré) :

- **Dépendants directs** — qui dépend directement de X.
- **Rayon d'explosion (blast radius)** — tous les dépendants transitifs et leur
  profondeur minimale (var-length bornée).
- **Redondance** — X possède-t-il un backup/replacement/recovery ?
- **Candidats SPOF** — entités sans redondance dont dépendent d'autres.

## 2. Propagation Engine / What-If (articles 16-17)

`PropagationEngine.SimulateFailureAsync(asset, scenario, duration…)` calcule la
cascade d'une indisponibilité :

```text
Entrée : asset_id, scenario_type, (durée/sévérité)
Sortie : PropagationResult
         ├─ AffectedTotal            (nombre de dépendants transitifs)
         ├─ AffectedByType           (Application: n, Server: n, BusinessProcess: n…)
         ├─ MaxDepth                 (profondeur de la cascade)
         ├─ EstimatedOperationalImpact (Σ criticités affectées)
         └─ Affected[]               (détail avec profondeur)
```

Scénarios (`ScenarioType`, article 16) : `SERVER_FAILURE`, `DATABASE_FAILURE`,
`APPLICATION_FAILURE`, `NETWORK_FAILURE`, `SUPPLIER_FAILURE`, `EMPLOYEE_LOSS`,
`LOCATION_FAILURE`, `CLOUD_REGION_FAILURE`, `CYBER_INCIDENT`, `DATA_LOSS`,
`POWER_OUTAGE`, `COMMUNICATION_FAILURE`.

**Exemple validé** (test d'intégration) : panne de `SQL01` → 4 entités affectées
(ERP, CRM, WEB01, Billing), profondeur max 2, impact opérationnel 293.

## 3. SPOF

`SpofAnalyzer.AnalyzeAsync` classe les single points of failure. Score 0-100 =
**portée** (rayon d'explosion, jusqu'à 70) + **criticité** (jusqu'à 30). Dans
l'exemple, `SQL01` (aucune redondance, tout en dépend) arrive en tête.

## 4. À venir

- **Scenario Engine** composable (multi-événements simultanés — article 18).
- Directions inverses (`KNOWS`/`MAINTAINS`) via le **Human Dependency Engine** (article 28).
- Détection de cycles et concentration fournisseurs (articles 13, 29).
