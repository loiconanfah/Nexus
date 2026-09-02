# Exploitation — Sauvegardes, reprise (DR) et supervision

Runbook opérationnel de Lenexus (déploiement Render). Objectif : rendre la
production défendable pour des clients (RPO/RTO définis, sauvegardes testées,
supervision en place).

## 1. Objectifs (à valider avec le client)

| Indicateur | Cible pilote | À viser GA |
|---|---|---|
| RPO (perte de données max) | 24 h | ≤ 1 h |
| RTO (temps de rétablissement) | 4 h | ≤ 1 h |
| Disponibilité | best-effort | 99,5 % |

## 2. Sauvegardes

### PostgreSQL (plan de contrôle : comptes, config IA, usage, modèles, scénarios)
- **Sauvegardes automatiques** : disponibles sur les plans payants Render
  (`basic-1gb`+). **Action requise** : passer `nexus-postgres` du plan `free`
  au plan payant dans le dashboard Render → sauvegardes quotidiennes activées.
- **Sauvegarde manuelle** (avant migration risquée) :
  ```bash
  pg_dump "$DATABASE_URL" -Fc -f nexus-$(date +%F).dump
  ```
- **Restauration** :
  ```bash
  pg_restore --clean --if-exists -d "$DATABASE_URL" nexus-YYYY-MM-DD.dump
  ```

### Neo4j (graphe de dépendances)
Service privé sur disque persistant (`/data`, 5 Go). Render ne sauvegarde pas ce
disque automatiquement → **procédure à planifier** :
- **Dump manuel** (base à l'arrêt ou en ligne selon l'édition) :
  ```bash
  neo4j-admin database dump neo4j --to-path=/data/backups
  ```
- **Externalisation** : copier le dump hors du service (objet S3/Backblaze) via
  un job planifié. Recommandé : un cron hebdomadaire au minimum, quotidien en GA.
- **Restauration** :
  ```bash
  neo4j-admin database load neo4j --from-path=/data/backups --overwrite-destination=true
  ```
- Alternative applicative : réimport depuis les sources (CSV/REST/connecteurs),
  le graphe étant reconstructible depuis les données d'origine du client.

### À faire avant la GA
- [ ] Passer Postgres en plan payant (sauvegardes auto).
- [ ] Planifier + externaliser les dumps Neo4j.
- [ ] **Tester une restauration complète** (Postgres + Neo4j) et chronométrer le RTO.

## 3. Reprise après sinistre (DR)

Ordre de rétablissement :
1. Restaurer PostgreSQL (comptes, config IA par tenant, usage, modèles).
2. Restaurer Neo4j (ou réimporter depuis les sources client).
3. Redéployer l'API et le web (blueprint Render).
4. Vérifier `/health/ready` = `ready` (Postgres + Neo4j joignables).
5. Vérifier une connexion + une simulation par tenant témoin.

Secrets à conserver hors-ligne (sinon perte d'accès) : `NEXUS_JWT_KEY` (sa
rotation invalide toutes les sessions), `NEO4J_AUTH`, mot de passe Postgres,
clés IA. Documenter leur emplacement (coffre).

## 4. Supervision

### Endpoints
- **Liveness** : `GET /health` → 200 si le service répond (utilisé par Render).
- **Readiness** : `GET /health/ready` → 200 `ready` / 503 `degraded` avec l'état
  de Postgres et Neo4j. **À brancher sur un moniteur externe** (UptimeRobot,
  Better Stack, Pingdom) avec alerte.

### Métriques et traces
- L'API expose OpenTelemetry (traces + métriques HTTP/instrumentation). Pointer
  un collecteur OTLP (Grafana/Tempo, Honeycomb, etc.) via les variables
  d'environnement OTEL standard pour conserver l'historique.

### Alertes minimales à configurer
- [ ] `/health/ready` non-200 pendant > 2 min.
- [ ] Taux d'erreurs 5xx anormal.
- [ ] Latence p95 élevée.
- [ ] Approche du quota LLM par tenant (voir `GET /api/v1/ai/usage`).
- [ ] Espace disque Neo4j > 80 %.

## 5. Coûts IA
- Plafond mensuel LLM **par tenant** appliqué en base (`llm_usage`), configurable
  via `NEXUS_LLM_MONTHLY_CALL_CAP` / `NEXUS_LLM_MONTHLY_CHAR_CAP` (0 = illimité).
  Au-delà, l'application bascule automatiquement sur ses réponses déterministes.
- Surveiller la consommation agrégée pour ajuster les plafonds et la tarification.
