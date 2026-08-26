# NEXUS Ontology — V1

Version : 1.0 (Phase 0)

L'**ontologie NEXUS** est le vocabulaire propriétaire qui décrit *ce qui existe* dans une organisation et *comment les choses dépendent les unes des autres*. C'est l'un des principaux actifs de propriété intellectuelle du produit (articles 59-62). Elle doit être stable, extensible et indépendante des systèmes sources.

---

## 1. Principes

- **Une entité = un noeud** dans le graphe, portant le label générique `:Entity` + un label de type (`:Server`, `:Application`, …).
- **Une dépendance = une relation typée** entre deux entités, portant confiance, source et preuve.
- **Indépendance des sources** : un « SQL Server » d'Azure CMDB et un « database-server-001 » d'un Excel se résolvent vers **la même** entité NEXUS (article 11).
- **Extensible** : de nouveaux types d'entités/relations peuvent être ajoutés sans casser l'existant (`entityType` / `type` sont des chaînes contrôlées par un registre versionné).

---

## 2. Types d'entités

Regroupés par domaine. Chaque type hérite des **propriétés communes** (§4).

### Organisation & humains
`Organization` · `BusinessUnit` · `Location` · `Person` · `Role` · `Team`

### Fournisseurs & contrats
`Supplier` · `Contract`

### Technique & infrastructure
`Asset` · `Infrastructure` · `Server` · `Device` · `Network` · `CloudResource`

### Logiciel & données
`Application` · `Service` · `System` · `Database` · `DataStore`

### Processus & métier
`Process` · `BusinessProcess` · `BusinessService`

### Identité & sécurité
`Identity` · `Credential` · `Control` · `Policy` · `Vulnerability`

### Connaissance & gouvernance
`Document` · `Incident` · `Change` · `Risk` · `Event`

### Analyse (entités dérivées, générées par NEXUS)
`Dependency` · `Scenario` · `Simulation`

> `Asset` est le **supertype** technique : `Server`, `Device`, `Application`, `Database`, `CloudResource`… sont des actifs. Les requêtes transverses peuvent cibler `:Asset` ou `:Entity`.

---

## 3. Types de relations

Toutes orientées `source → target`, typées, portant les propriétés de relation (§5).

| Relation | Sens |
|---|---|
| `DEPENDS_ON` | **relation pivot** : la source cesse de fonctionner correctement si la cible est indisponible |
| `RUNS_ON` | s'exécute sur (application → serveur) |
| `HOSTS` | héberge (serveur → application) |
| `CONNECTS_TO` / `COMMUNICATES_WITH` / `CONNECTED_TO` | connectivité réseau/logique |
| `USES` | utilise une ressource/service |
| `SUPPORTS` | soutient (système → processus métier) |
| `STORES` / `PROCESSES` | stocke / traite des données |
| `OWNED_BY` / `MANAGED_BY` / `OPERATED_BY` | propriété / gestion / exploitation |
| `SUPPLIED_BY` / `CONTRACTED_BY` | fourni par / sous contrat avec |
| `LOCATED_IN` / `PART_OF` | localisation / composition |
| `REQUIRES` | pré-requis fonctionnel |
| `AFFECTS` / `IMPACTS` / `TRIGGERS` / `BLOCKS` | causalité / propagation |
| `PROTECTS` / `AUTHENTICATES` | contrôle de sécurité / authentification |
| `REPLACED_BY` / `BACKED_UP_BY` / `RECOVERS_WITH` | cycle de vie / résilience |
| `HAS_ACCESS_TO` / `KNOWS` / `MAINTAINS` / `RESPONSIBLE_FOR` | dépendances **humaines** (article 28) |
| `DOCUMENTED_BY` / `RELATED_TO` | gouvernance / lien générique |

> **`KNOWS`** (`Person → System/Application`) est différenciant : il modélise la connaissance critique détenue par les personnes et alimente le *Human Dependency Engine*.

---

## 4. Propriétés communes des entités

```jsonc
{
  "id":          "uuid",        // identifiant stable NEXUS
  "tenantId":    "uuid",        // isolation multi-tenant
  "entityType":  "Server",      // type d'ontologie
  "name":        "SQL01",
  "aliases":     ["database-server-001", "SQL Server prod"], // entity resolution
  "description": "…",
  "criticality": 0,             // 0–100, dérivé du Criticality Engine (article 15)
  "attributes":  { },           // propriétés spécifiques au type (JSON libre)
  "sourceSystem":"Azure CMDB",
  "createdAt":   "iso8601",
  "updatedAt":   "iso8601",
  "validFrom":   "iso8601",     // graphe temporel (article 25) — optionnel V1
  "validUntil":  "iso8601"      // null = actif
}
```

---

## 5. Propriétés communes des relations (article 8)

```jsonc
{
  "id":           "uuid",
  "tenantId":     "uuid",
  "type":         "DEPENDS_ON",
  "confidence":   0.98,          // 0 → 1 (Confidence Engine, article 9)
  "status":       "VERIFIED",    // cf. §6
  "sourceSystem": "Azure CMDB",
  "sourceRecord": "cmdb://ci/40213",
  "evidence":     "Import CMDB relation 'hostedOn'",
  "createdAt":    "iso8601",
  "updatedAt":    "iso8601",
  "verifiedAt":   "iso8601",
  "verifiedBy":   "user:uuid",
  "validFrom":    "iso8601",
  "validUntil":   "iso8601"
}
```

---

## 6. Confidence Engine (articles 9)

Toutes les relations ne se valent pas. Chaque relation possède un **statut** et un **score de confiance** `0 → 1`.

| Statut | Signification |
|---|---|
| `VERIFIED` | confirmée par une source fiable **ou** un humain |
| `IMPORTED` | importée directement d'une source |
| `INFERRED` | déduite par le moteur déterministe de NEXUS |
| `AI_SUGGESTED` | proposée par l'IA (jamais présentée comme un fait) |
| `UNKNOWN` | relation potentielle non confirmée |

**Exemples**

```text
ERP ─DEPENDS_ON→ SQL01    confidence=0.98  source=Azure CMDB    status=VERIFIED
ERP ─DEPENDS_ON→ SQL01    confidence=0.76  source=AI inference  status=AI_SUGGESTED
```

Une relation `AI_SUGGESTED` ou `UNKNOWN` est visible dans l'UI mais **exclue par défaut** des calculs de risque « fermes » ; l'utilisateur peut la promouvoir en `VERIFIED`. Aucune fusion d'entité critique ni promotion automatique sans franchir un seuil de confiance configurable.

---

## 7. Entités dérivées

NEXUS **calcule** certaines entités à partir du graphe :

- `Dependency` — une dépendance qualifiée : `DirectDependency`, `IndirectDependency`, `CriticalDependency`, `HiddenDependency`, `SinglePointOfFailure`, `ConcentrationRisk`, `CascadeRisk` (article 13).
- `Scenario` — composition d'événements de rupture (article 18).
- `Simulation` — résultat exécuté d'un scénario, avec la cascade d'impacts (articles 16-17).

---

## 8. Gouvernance de l'ontologie

- L'ontologie est **versionnée** (`ONTOLOGY.md` + registre de types dans `Nexus.Domain`).
- Tout ajout de type passe par un ADR si structurant.
- Les valeurs `entityType` / relation `type` sont validées à l'écriture contre le registre : pas de type « sauvage ».
- Le graphe est destiné à devenir la **mémoire opérationnelle** de l'organisation, avec historique temporel (`validFrom`/`validUntil`) — article 24-25.
