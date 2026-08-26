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
| 4 | PostgreSQL | 1 | 🟡 (DbContext + migration ✅ ; apply en base à faire quand Docker up) |
| 5 | Neo4j | 1 | 🟡 (client + repo + contraintes ✅ ; apply en base à faire quand Docker up) |
| 6 | Ontology | 0/1 | ✅ (doc + code) |
| 7 | Asset model | 1 | ✅ |
| 8 | Relationship model | 1 | ✅ |
| 9 | CSV importer | 2 | ⬜ |
| 10 | Excel importer | 2 | ⬜ |
| 11 | Normalization | 2 | ⬜ |
| 12 | Entity resolution | 2 | ⬜ |
| 13 | Graph creation | 2 | ⬜ |
| 14 | Graph explorer (UI) | 4 | ⬜ |
| 15 | Dependency engine | 3 | ⬜ |
| 16 | Criticality engine | 3 | ⬜ |
| 17 | Risk engine | 3 | ⬜ |
| 18 | Risk dashboard | 4 | ⬜ |
| 19 | What-if engine | 3 | ⬜ |
| 20 | Simulation visualization | 4 | ⬜ |
| 21 | Document ingestion | 5 | ⬜ |
| 22 | Vector search | 5 | ⬜ |
| 23 | AI analyst | 5 | ⬜ |
| 24 | Evidence / citations | 5 | ⬜ |
| 25 | Microsoft connector | 6 (post-MVP) | ⬜ |
| 26 | Security hardening | 6 | ⬜ |
| 27 | Observability | 6 | ⬜ |
| 28 | Testing | continu | ⬜ |
| 29 | Documentation | continu | 🟡 |
| 30 | Enterprise demo | 6 | ⬜ |

---

## 2. Découpage en 10 phases sur 30 jours (article 54)

### Phase 0 — Architecture Foundation *(J1-J2)* ✅
Repo, solution .NET modulaire qui compile, docs (ARCHITECTURE / ONTOLOGY / DOMAIN_MODEL / SECURITY / DEPLOYMENT), docker-compose (PostgreSQL+pgvector, Neo4j+GDS, Azurite), modèles DB initiaux, ADR, backlog.

### Phase 1 — Domain & Data Foundation *(J3-J6)* 🟡 en cours
- `Nexus.Core` : `Result<T>`, erreurs, primitives.
- `Nexus.Domain` : registre d'ontologie (types d'entités/relations), value objects (Confidence, Criticality), invariants.
- `Nexus.Infrastructure` : DbContext EF Core + migration initiale (tables de `02_schema.sql`).
- `Nexus.Graph` : client Neo4j, application des contraintes, CRUD entités/relations.
- Tests unitaires domaine + tests d'intégration PostgreSQL/Neo4j (conteneurs).

### Phase 2 — Ingestion CSV/Excel *(J7-J11)*
- Framework `IConnector` (`Nexus.Connectors`).
- Connecteurs CSV & Excel (read-only).
- Normalisation → ontologie ; Entity Resolution (exact + fuzzy `pg_trgm` + alias).
- Écriture du graphe + `data_lineage` + confidence/status.
- KPI **Time To First Graph**.

### Phase 3 — Moteurs déterministes *(J12-J17)*
- Dependency Engine : dépendances directes/indirectes, profondeur, cycles, SPOF, concentration.
- Criticality Engine : profil configurable par tenant.
- Risk Engine : `RiskScore` 0-100 explicable, pondérations depuis `risk_profile` (jamais hardcodé).
- What-If / Propagation Engine : simulation de défaillance, cascade d'impacts.
- Tests des moteurs (cas déterministes vérifiables).

### Phase 4 — UI Analytics *(J18-J23)*
- App React (Vite, Tailwind, shadcn/ui).
- Dashboard (Organization Health Score, risques, SPOF, concentration…).
- Graph Explorer (XYFlow) : zoom/pan/search/filtres/expand, path finding, affichage confiance/preuve.
- Risk Center (filtres/tri).
- Simulation UI (« WHAT IF? ») + animation de propagation.

### Phase 5 — Documents & AI Analyst *(J24-J28)*
- Ingestion documentaire → chunking → embeddings (pgvector).
- RAG : retrieval + reranking + context builder.
- AI Orchestrator : intent → graph query → risk → RAG → LLM → réponse.
- Guardrails + **evidence/citations** + niveau de confiance.

### Phase 6 — Report, Sécurité, Observabilité, Demo *(J29-J30)*
- Report Engine (Executive Risk Report, PDF/JSON/CSV).
- Durcissement sécurité (OIDC/Entra, RBAC, rate limiting, headers).
- Observabilité (OpenTelemetry, métriques).
- `Nexus.Seed` : dataset de démo + scénario de démonstration.

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
