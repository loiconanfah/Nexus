# NEXUS — Operational Dependency Intelligence Platform

> **Know what breaks before the business does.**

NEXUS transforme les systèmes, infrastructures, applications, personnes, fournisseurs, processus, données et contrats d'une organisation en un **modèle dynamique de dépendances** permettant de comprendre les risques, simuler des scénarios de rupture et identifier les conséquences opérationnelles **avant** qu'un incident majeur ne survienne.

NEXUS n'est **pas** un ERP, un CMDB classique, un chatbot ou un outil de cybersécurité traditionnel.
NEXUS est **la couche d'intelligence des dépendances opérationnelles**.

---

## Ce que NEXUS répond

- Que se passe-t-il si ce serveur / cette base / ce fournisseur tombe ?
- Quels processus métiers dépendent (directement ou indirectement) de cet actif ?
- Quels sont les **single points of failure** ?
- Quels employés détiennent une connaissance critique ?
- Comment un incident se **propage-t-il** en cascade ?
- Où investir 1 M$ pour réduire le plus de risque ?

---

## Principes fondateurs

1. **Couche d'intelligence, pas de remplacement** — NEXUS observe et analyse ; il ne devient jamais un système métier.
2. **Read-only first** — toute intégration démarre en lecture seule ; l'écriture est désactivée par défaut, auditée et explicitement autorisée.
3. **Explicable avant tout** — le moteur déterministe (graphe + règles) prime ; l'IA explique et enrichit, elle n'invente pas.
4. **Confidence Engine** — chaque relation porte une source, un statut (`VERIFIED / IMPORTED / INFERRED / AI_SUGGESTED / UNKNOWN`) et un score de confiance 0→1.
5. **Modular monolith d'abord** — extraction en services seulement quand la scalabilité l'exige.

---

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React + TypeScript + Vite, Tailwind, shadcn/ui, XYFlow (graphe), ECharts |
| Backend | C# / .NET 10, ASP.NET Core, EF Core, FluentValidation, Serilog, OpenTelemetry |
| État applicatif | PostgreSQL (+ pgvector pour le RAG) |
| Knowledge Graph | Neo4j (+ Graph Data Science) |
| Storage | Azure Blob (Azurite en local) |
| IA | Azure OpenAI (RAG + orchestrateur) |
| Cloud / CI-CD | Azure / Azure DevOps |

---

## Démarrage local

```bash
# 1. Copier les variables d'environnement
cp .env.example .env

# 2. Démarrer les dépendances (PostgreSQL + pgvector, Neo4j + GDS, Azurite)
docker compose up -d

# 3. Compiler et lancer l'API
cd backend
dotnet build
dotnet run --project src/Nexus.Api

# 4. (à venir) Générer le jeu de démonstration
dotnet run --project src/Nexus.Seed
```

- Neo4j Browser : http://localhost:7474
- API (dev) : voir la sortie `dotnet run`

---

## Structure du dépôt

```text
lenexus/
├─ backend/            Solution .NET 10 (modular monolith)
│  ├─ src/
│  │  ├─ Nexus.Api            API ASP.NET Core (point d'entrée)
│  │  ├─ Nexus.Core           Shared kernel (primitives, Result, abstractions)
│  │  ├─ Nexus.Domain         Ontologie, entités, règles métier pures
│  │  ├─ Nexus.Application    Cas d'usage (CQRS), ports
│  │  ├─ Nexus.Infrastructure Persistance EF Core / PostgreSQL
│  │  ├─ Nexus.Graph          Accès Neo4j, traversées, dependency engine
│  │  ├─ Nexus.Risk           Risk / Criticality / Propagation engines
│  │  ├─ Nexus.Ingestion      Pipeline d'ingestion, normalisation, résolution
│  │  ├─ Nexus.Connectors     Framework IConnector + connecteurs
│  │  ├─ Nexus.AI             Orchestrateur IA, RAG, guardrails
│  │  ├─ Nexus.Security       Auth, RBAC, isolation tenant
│  │  ├─ Nexus.Observability  Télémétrie (OpenTelemetry, Serilog)
│  │  └─ Nexus.Seed           Générateur de dataset de démonstration
│  └─ tests/Nexus.Tests
├─ frontend/           Application React (à venir Phase UI)
├─ database/
│  ├─ postgres/init    Extensions + schéma de référence
│  └─ neo4j            Contraintes & index du graphe
├─ docs/               Architecture, ontologie, sécurité, ADR, backlog
├─ deploy/             Données locales (volumes docker, gitignored)
└─ docker-compose.yml
```

---

## Documentation

| Document | Contenu |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture globale, composants, flux de données |
| [ONTOLOGY.md](docs/ONTOLOGY.md) | Ontologie NEXUS : entités, relations, confidence |
| [DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) | Modèle de données PostgreSQL + Neo4j |
| [CONNECTORS.md](docs/CONNECTORS.md) | Framework de connecteurs, pipeline d'ingestion |
| [SECURITY.md](docs/SECURITY.md) | Zero Trust, RBAC, secrets, OWASP |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | SaaS / Private Cloud / On-Prem, CI-CD |
| [BACKLOG.md](docs/BACKLOG.md) | Backlog 30 jours + critères d'acceptation |
| [docs/adr/](docs/adr/) | Architecture Decision Records |

---

## Statut

**Phase 0 — Architecture Foundation** (en cours).
Voir [docs/BACKLOG.md](docs/BACKLOG.md) pour la feuille de route des 30 jours.

## Licence

Propriétaire — voir [LICENSE.md](LICENSE.md).
