# NEXUS — Backlog MVP (30 jours) & Critères d'acceptation

Version : 1.0 (Phase 0) · Articles 54, 78, 81, 84, 85

Objectif MVP : prendre un dataset organisationnel réaliste et produire un **graphe de dépendances**, un **classement des risques**, les **SPOF**, les dépendances **fournisseurs** et **humaines**, les dépendances **non documentées**, une **simulation de panne**, une **analyse de propagation**, une **explication IA sourcée** et un **rapport exécutif** — le tout compréhensible par un externe en **< 15 minutes**.

---

## 1. Ordre absolu de construction (article 81)

Cet ordre ne doit pas être sauté.

| # | Étape | Phase | Statut |
|---|---|---|---|
| 1 | Repository | 0 | ✅ |
| 2 | Architecture | 0 | ✅ |
| 3 | Domain | 1 | ✅ |
| 4 | PostgreSQL | 1 | ✅ (migration appliquée + test d'intégration vert) |
| 5 | Neo4j | 1 | ✅ (contraintes + round-trip d'intégration vert) |
| 6 | Ontology | 0/1 | ✅ (doc + code) |
| 7 | Asset model | 1 | ✅ |
| 8 | Relationship model | 1 | ✅ |
| 9 | CSV importer | 2 | ✅ |
| 10 | Excel importer | 2 | ✅ |
| 11 | Normalization | 2 | ✅ |
| 12 | Entity resolution | 2 | ✅ (exact + alias ; fuzzy full-text dispo) |
| 13 | Graph creation | 2 | ✅ (via pipeline d'ingestion) |
| 14 | Graph explorer (UI) | 4 | ✅ (XYFlow + dagre) |
| 15 | Dependency engine | 3 | ✅ (directes/blast/SPOF ; cycles à venir) |
| 16 | Criticality engine | 3 | ✅ |
| 17 | Risk engine | 3 | ✅ (explicable + configurable) |
| 18 | Risk dashboard | 4 | ✅ (Dashboard + Risk Center) |
| 19 | What-if engine | 3 | ✅ (Propagation Engine) |
| 20 | Simulation visualization | 4 | ✅ (cascade par profondeur) |
| 21 | Document ingestion | 5 | ⬜ (RAG — base pgvector prête, activé avec clé LLM) |
| 22 | Vector search | 5 | ⬜ (idem RAG) |
| 23 | AI analyst | 5 | ✅ (orchestrateur ancré, LLM optionnel) |
| 24 | Evidence / citations | 5 | ✅ |
| 25 | Microsoft connector | 6 (post-MVP) | ⬜ |
| 26 | Security hardening | 6 | 🟡 (headers + rate limiting ✅ ; Entra ID réel à venir) |
| 27 | Observability | 6 | ✅ (Serilog + OpenTelemetry) |
| 28 | Testing | continu | 🟡 (49 tests, dont intégration live) |
| 29 | Documentation | continu | ✅ |
| 30 | Enterprise demo | 6 | ✅ (Nexus.Seed + DEMO.md) |

---

## 2. Découpage en 10 phases sur 30 jours (article 54)

### Phase 0 — Architecture Foundation *(J1-J2)* ✅
Repo, solution .NET modulaire qui compile, docs (ARCHITECTURE / ONTOLOGY / DOMAIN_MODEL / SECURITY / DEPLOYMENT), docker-compose (PostgreSQL+pgvector, Neo4j+GDS, Azurite), modèles DB initiaux, ADR, backlog.

### Phase 1 — Domain & Data Foundation *(J3-J6)* ✅
Validée de bout en bout : build 0/0, 34 tests verts (dont 2 d'intégration PostgreSQL+Neo4j live), migration appliquée, `/health/ready` → `ready`.
- `Nexus.Core` : `Result<T>`, erreurs, primitives.
- `Nexus.Domain` : registre d'ontologie (types d'entités/relations), value objects (Confidence, Criticality), invariants.
- `Nexus.Infrastructure` : DbContext EF Core + migration initiale (tables de `02_schema.sql`).
- `Nexus.Graph` : client Neo4j, application des contraintes, CRUD entités/relations.
- Tests unitaires domaine + tests d'intégration PostgreSQL/Neo4j (conteneurs).

### Phase 2 — Ingestion CSV/Excel *(J7-J11)* ✅
- Framework `IConnector` (`Nexus.Connectors`) — voir [ADR-0009](adr/ADR-0009-connector-responsibility-boundary.md).
- Connecteurs CSV & Excel (read-only, streaming).
- Normalisation → ontologie ; Entity Resolution (exact + alias ; fuzzy full-text Neo4j).
- Écriture du graphe + `data_lineage` + confidence/status, id de relation déterministe (idempotent).
- KPI **Time To First Graph** exposé dans `ImportResult`.
- Validé : 38 tests verts dont un test d'intégration d'import Excel de bout en bout. Voir [CONNECTORS.md](CONNECTORS.md).

### Phase 3 — Moteurs déterministes *(J12-J17)* ✅
- Dependency Engine : dépendants directs, **blast radius** transitif, redondance, candidats SPOF (`IDependencyQueries`).
- Criticality Engine : criticité effective (déclarée ∨ structurelle).
- Risk Engine : `RiskScore` 0-100 **explicable**, pondérations/seuils configurables (jamais hardcodé) + `RiskAnalyzer`.
- Propagation Engine (What-If) : simulation de défaillance, cascade d'impacts par type + impact opérationnel.
- SPOF Analyzer (article 27).
- Validé : 49 tests verts (10 unitaires risque + intégration propagation/SPOF/risk sur topologie live). Voir [RISK_ENGINE.md](RISK_ENGINE.md), [SIMULATION_ENGINE.md](SIMULATION_ENGINE.md).
- Reste (post-MVP) : cycles, concentration fournisseurs, Human Dependency (KNOWS/MAINTAINS), Scenario Engine multi-événements.

### Phase 4 — UI Analytics *(J18-J23)* ✅
- App React (Vite, Tailwind v4, thème enterprise dark), consommant l'API REST.
- Dashboard (Organization Health Score, tuiles, SPOF, composition) + import du jeu de démo.
- Graph Explorer (XYFlow + dagre) : zoom/pan/recherche/filtre par type, panneau de détail (dépendances/dépendants/confiance).
- Risk Center (bandes, filtres type, tri, badges SPOF) + Assets (inventaire).
- Simulation « WHAT IF? » : cascade par profondeur, impact par type, risque explicable.
- Vérifié dans le navigateur de bout en bout (import démo → SPOF → simulation).
- Reste (post-MVP) : path finding A→B, expand incrémental, animation de propagation.

### Phase 5 — Documents & AI Analyst *(J24-J28)* ✅ (AI Analyst) · 🟡 (RAG documentaire différé)
- AI Orchestrator : intent → moteurs déterministes → réponse ancrée ; LLM Azure OpenAI **optionnel** (reformulation), dégradation propre sans clé.
- Guardrails + **evidence/citations** + niveau de confiance (article 22).
- API `POST /api/v1/ai/ask` + page UI conversationnelle (preuves dépliables).
- Vérifié navigateur : « quels SPOF ? » → SinglePointsOfFailure, confiance 90%, 3 SPOF sourcés.
- RAG documentaire (ingestion→chunking→embeddings→retrieval) : base pgvector prête, activé avec un déploiement d'embeddings. Voir [AI.md](AI.md).

### Phase 6 — Sécurité, Observabilité, Demo *(J29-J30)* ✅ (noyau)
- Durcissement sécurité : en-têtes OWASP + rate limiting par IP. (Entra ID/OIDC réel + RBAC : à câbler avec un tenant Azure.)
- Observabilité : Serilog (logs structurés + request logging) + OpenTelemetry (traces/métriques ASP.NET Core & HTTP).
- `Nexus.Seed` : dataset révélant SPOF, dépendance cachée, fournisseur critique/unique, personne clé, legacy, relation non documentée. `dotnet run --project src/Nexus.Seed`.
- [DEMO.md](DEMO.md) : scénario de démonstration < 10 min.
- Reste (post-MVP) : Report Engine (PDF exécutif), Entra ID réel, connecteurs V1.1.

---

## 3. Jeu de données de démonstration (articles 52-53)

Environnement fictif réaliste :

```text
1 organisation · 5 business units · 4 sites · 1 000 employés
500 assets · 100 applications · 50 bases · 30 serveurs
25 fournisseurs · 20 processus métier · 15 services critiques
100 documents · 50 incidents
```

Risques **volontairement** intégrés à révéler pendant la démo :
- une **dépendance cachée** ;
- un **fournisseur critique** unique ;
- un **serveur SPOF** ;
- une **personne** détenant une connaissance unique ;
- un **système legacy** ;
- une **relation non documentée** ;
- un **incident historique** significatif.

---

## 4. Scénario de première démo (article 78) — < 10 min

1. login → 2. import dataset → 3. ingestion → 4. graphe généré →
5. calcul des risques → 6. dashboard → 7. sélection d'un serveur critique →
8. simulation de panne → 9. visualisation de la cascade → 10. « pourquoi ? » à l'IA →
11. génération du rapport exécutif.

---

## 5. Critères d'acceptation du MVP (articles 84-85)

Le MVP est **réussi** si une personne externe peut, en **< 15 minutes** :

- [ ] importer un dataset ;
- [ ] comprendre le graphe de dépendances ;
- [ ] identifier un risque (classement des risques + SPOF) ;
- [ ] voir les dépendances fournisseurs, humaines et non documentées ;
- [ ] simuler une défaillance ;
- [ ] voir la propagation (analyse d'impact) ;
- [ ] demander « pourquoi » et obtenir une réponse **sourcée** ;
- [ ] générer un rapport exécutif ;
- [ ] comprendre la valeur commerciale.

**KPI central : Time To First Insight** — une information utile en quelques minutes après le premier import (article 65).

---

## 6. Interdit au MVP (article 55)

App mobile · billing complexe · marketplace · CRM/ERP · chat social · workflow builder généraliste · SOC/SIEM/antivirus/EDR · « prédiction magique » · 50 connecteurs · toute fonctionnalité sans lien avec la *dependency intelligence*.
