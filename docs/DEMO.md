# NEXUS — Démonstration (< 10 minutes)

Articles 78, 84-85. Ce parcours prend un jeu de données organisationnel réaliste
et produit graphe, risques, SPOF, simulation et explication IA sourcée.

## 0. Prérequis

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL + pgvector, Neo4j + GDS, Azurite
cd backend && dotnet build
```

Appliquer la migration (première fois) :

```bash
dotnet tool run dotnet-ef database update \
  --project src/Nexus.Infrastructure --startup-project src/Nexus.Infrastructure
```

## 1. Générer le jeu de démonstration

```bash
dotnet run --project src/Nexus.Seed
```

Notez le **tenant** affiché (`X-Tenant-Id: <guid>`). Le jeu contient volontairement :

- un **SPOF** (SQL01, dont tout dépend, sans redondance) ;
- une **dépendance cachée** (ERP → AS400-LEGACY, inférée) ;
- un **fournisseur critique** (CloudProviderX, plusieurs apps en dépendent) ;
- un **fournisseur unique** du legacy (MaintCorp) ;
- une **personne à connaissance unique** (Alice KNOWS AS400-LEGACY) ;
- un **système legacy** (AS400-LEGACY) ;
- une **relation non documentée** (Billing → CloudProviderX, AI_SUGGESTED, confiance 0.40).

## 2. Lancer l'API et l'UI

```bash
# terminal 1
dotnet run --project src/Nexus.Api          # http://localhost:5199

# terminal 2
cd ../frontend && npm install && npm run dev # http://localhost:5173 (ou 5174)
```

Dans l'UI, ouvrez la console du navigateur et fixez le tenant du seed :

```js
localStorage.setItem('nexus.tenantId', '<guid-du-seed>'); location.reload()
```

(ou importez le jeu de démo intégré via le bouton de l'Overview pour un tenant vierge).

## 3. Le parcours

1. **Overview** — Organization Health Score, nombre de SPOF, composition.
2. **Graph Explorer** — la topologie de dépendances ; SQL01 au centre.
3. **Risk Center** — les actifs classés par risque ; badges SPOF.
4. **Simulation** — cliquez un actif critique → « Simuler » → cascade par
   profondeur + impact opérationnel.
5. **AI Analyst** — posez :
   - « Pourquoi SQL01 est-il critique ? » → explication sourcée (facteurs).
   - « Que se passe-t-il si SQL01 tombe ? » → propagation.
   - « Quelles dépendances sont non documentées ? » → révèle Billing → CloudProviderX.
   - « Quels sont nos plus grands risques ? » → classement.

## 4. Ce que la démo prouve (article 85)

En moins de 15 minutes, un externe peut : importer un dataset, comprendre le
graphe, identifier un risque, simuler une défaillance, voir la propagation,
demander « pourquoi » et obtenir une réponse **sourcée** — soit toute la
proposition de valeur : *« Show me what breaks, why, what it affects, and what
to fix first. »*
