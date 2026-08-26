# NEXUS — Déploiement

Articles 47, 5. NEXUS se déploie en une commande grâce à sa stack containerisée
(API .NET + frontend nginx + PostgreSQL + Neo4j).

## 1. Démo / POC en une commande

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Puis ouvrir **http://localhost:8088**. L'API applique migrations et contraintes
au démarrage ; chaque visiteur obtient son tenant et importe le jeu de démo
depuis l'Overview.

Variables (optionnelles, `.env` ou environnement) :

| Variable | Rôle | Défaut |
|---|---|---|
| `WEB_PORT` | port public du frontend | `8088` |
| `POSTGRES_PASSWORD` / `NEO4J_PASSWORD` | secrets DB | dev |
| `NEXUS_AI_ENDPOINT` / `NEXUS_AI_APIKEY` | active la reformulation LLM (Azure OpenAI) | vide |

Arrêt : `docker compose -f docker-compose.prod.yml down` (ajouter `-v` pour purger les données).

## 2. URL démo publique (VM / cloud)

Sur n'importe quel hôte Docker (VM Azure/AWS/GCP, VPS) :

1. Cloner le dépôt, `docker compose -f docker-compose.prod.yml up -d --build`.
2. Placer un reverse proxy TLS devant le port `web` (Caddy/nginx/Traefik) pour
   servir `https://demo.votre-domaine.com`.
3. Renseigner des mots de passe DB forts et, si souhaité, la clé Azure OpenAI.

## 3. Cible Azure (production, article 47)

| Composant | Service |
|---|---|
| API `nexus-api` | Azure Container Apps |
| Web `nexus-web` | Azure Container Apps / Static Web Apps |
| PostgreSQL | Azure Database for PostgreSQL (extension `vector`) |
| Neo4j | Neo4j AuraDB **ou** conteneur (Container Apps/AKS) |
| Secrets | Azure Key Vault + managed identities |
| Identité | Microsoft Entra ID (remplace le stub `X-Tenant-Id`) |
| Observabilité | Application Insights (exporter OTLP) |

Étapes (esquisse) :

```bash
# Construire et pousser les images
az acr build -r <registry> -t nexus-api:latest -f backend/Dockerfile .
az acr build -r <registry> -t nexus-web:latest -f frontend/Dockerfile .
# Déployer les Container Apps en pointant vers PostgreSQL/AuraDB managés,
# secrets depuis Key Vault, et OTEL_EXPORTER_OTLP_ENDPOINT → Application Insights.
```

Le pipeline Azure DevOps (build → test → scan → migrate → deploy → rollback) est
décrit dans [DEPLOYMENT.md](DEPLOYMENT.md).

## 4. Santé (orchestration)

- Liveness : `GET /health`
- Readiness : `GET /health/ready` (PostgreSQL + Neo4j) — à brancher sur les
  sondes du conteneur / de l'orchestrateur.
