# NEXUS — AI Analyst

Version : 1.0 (Phase 5) · Articles 19-23, 39 · Voir [ADR-0007](adr/ADR-0007-deterministic-first-ai-overlay.md)

L'AI Analyst répond en langage naturel à des questions sur les dépendances et
les risques. **Il ne raisonne jamais seul** : il rassemble un contexte
structuré depuis les moteurs déterministes, puis un LLM (optionnel) se contente
de reformuler sans s'écarter des faits.

## 1. Flux (article 19)

```text
Question → Intent Detection → Moteurs déterministes (graph/risk/propagation/spof)
        → Réponse ancrée (evidence + confiance + sources)
        → [LLM: reformulation optionnelle] → Réponse
```

## 2. Intentions reconnues (article 20)

| Intention | Répond via |
|---|---|
| `TopRisks` | RiskAnalyzer sur toutes les entités, classées |
| `ExplainCriticality` | RiskAnalyzer de l'entité + décomposition des facteurs |
| `SimulateFailure` | PropagationEngine (cascade) |
| `SinglePointsOfFailure` | SpofAnalyzer |
| `UndocumentedDependencies` | relations `UNKNOWN`/`AI_SUGGESTED` ou confiance < 0.5 |
| `Overview` | synthèse (stats + principal SPOF) |

L'entité mentionnée est résolue par nom/alias dans la question.

## 3. Guardrails (article 22)

- **N'invente pas** : chaque réponse est construite à partir de données déterministes.
- **Cite ses sources** (`AiSource`) et expose ses **preuves** (`AiEvidence`).
- Affiche un **niveau de confiance** (0-1).
- Le LLM reçoit la consigne stricte de ne pas dépasser les FAITS fournis ;
  une erreur/absence de LLM dégrade proprement vers la réponse déterministe.
- Ne modifie jamais de données ; aucune action destructive.

## 4. LLM optionnel (Azure OpenAI)

Configuré via `Nexus:AI` (`Endpoint`, `ApiKey`, `ChatDeployment`). **Sans clé**,
`NullChatCompletion` est utilisé et l'AI Analyst reste pleinement fonctionnel
(réponses déterministes). Avec clé, `AzureOpenAIChatCompletion` reformule
(`llmNaturalized = true`).

## 5. API

`POST /api/v1/ai/ask` — corps `{ "question": "..." }` → `AiAnswer`
(`answer`, `intent`, `confidence`, `evidence[]`, `sources[]`, `affectedAssets[]`,
`recommendedAction`, `llmNaturalized`). Voir [API.md](API.md).

## 6. RAG documentaire — à venir

La base est prête (pgvector, table `document_chunk`, embeddings 3072). Le
pipeline d'ingestion documentaire (parsing → chunking → embeddings → retrieval →
reranking) sera activé quand un déploiement d'embeddings Azure OpenAI sera
disponible, pour enrichir les réponses avec des extraits de contrats,
procédures et incidents (article 21).
