# Serveur MCP NEXUS

Expose NEXUS (graphe de dépendances opérationnelles, moteurs de risque et de
simulation) comme **serveur MCP**. N'importe quel client MCP — **Claude Desktop**,
**Claude Code**, un agent — peut alors interroger NEXUS en langage naturel :

> « Qu'est-ce qui casse si Entra ID tombe ? »
> « Quels sont nos cinq plus grands risques opérationnels ? »
> « Quel fournisseur concentre le plus de risque ? »

Le serveur appelle l'**API REST NEXUS existante** — aucune donnée n'est dupliquée.

## Outils exposés

| Outil | Description |
|-------|-------------|
| `nexus_overview` | Score de santé, SPOF, actifs critiques, concentration fournisseurs |
| `nexus_top_risks` | Entités les plus risquées (score expliqué, rayon d'impact) |
| `nexus_suppliers` | Intelligence fournisseurs (risque, concentration, alternatives) |
| `nexus_human_dependencies` | Détenteurs de savoir uniques, processus non documentés |
| `nexus_find_entity` | Recherche d'entité par nom |
| `nexus_entity_risk` | Risque détaillé et explicable d'une entité |
| `nexus_simulate` | Simulation what-if d'une défaillance (cascade d'impact) |
| `nexus_ask` | Question en langage naturel à l'analyste NEXUS |

## Installation

```bash
cd mcp-server
npm install
```

## Configuration

| Variable | Défaut | Rôle |
|----------|--------|------|
| `NEXUS_API_URL` | `http://localhost:5199/api/v1` | URL de l'API NEXUS |
| `NEXUS_TENANT_ID` | tenant de démo CGI | Tenant à interroger |

## Brancher à Claude Desktop

Ajouter au fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "nexus": {
      "command": "node",
      "args": ["C:/WebProjet/lenexus/mcp-server/src/index.mjs"],
      "env": {
        "NEXUS_API_URL": "http://localhost:5199/api/v1",
        "NEXUS_TENANT_ID": "c6100000-cf1c-4000-8000-000000000001"
      }
    }
  }
}
```

## Brancher à Claude Code

```bash
claude mcp add nexus -- node C:/WebProjet/lenexus/mcp-server/src/index.mjs
```

## Direction inverse : NEXUS utilise Claude (prêt pour clé)

L'analyste NEXUS et l'import assisté par IA peuvent appeler Claude pour naturaliser
les réponses et déduire les mappings. C'est **gated par une clé** : définir
`ANTHROPIC_API_KEY` côté backend NEXUS active l'appel réel ; sans clé, NEXUS reste
pleinement fonctionnel en mode déterministe. Aucun secret n'est stocké dans le code.
