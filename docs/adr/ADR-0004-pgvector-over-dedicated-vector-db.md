# ADR-0004 — PostgreSQL + pgvector avant une base vectorielle dédiée

Statut : **Accepté** · Date : Phase 0

## Contexte / Problème
Le RAG (article 21) nécessite du stockage et de la recherche de similarité vectorielle (documents, procédures, contrats, incidents). Ajouter une base vectorielle dédiée (Pinecone, Qdrant, Weaviate…) augmente le coût d'exploitation et le nombre de systèmes à sécuriser/isoler.

## Options
1. **pgvector** dans le PostgreSQL déjà présent — un système de moins à opérer, transactions et isolation tenant unifiées.
2. **Base vectorielle dédiée** — meilleures perfs à très grande échelle, mais complexité et coût supplémentaires prématurés.

## Décision
Option 1 : **PostgreSQL + pgvector** (index HNSW, `vector_cosine_ops`). Le master prompt (article 5) demande explicitement de préférer pgvector avant d'ajouter une base vectorielle.

## Conséquences
- ✅ Un seul moteur pour l'état applicatif + les embeddings → isolation tenant, sauvegarde et sécurité unifiées.
- ✅ Coût maîtrisé (article 68).
- ⚠️ À très grande échelle documentaire, réévaluer une base vectorielle dédiée (décision réversible, chunks ré-indexables).
- ➡️ Index HNSW activé après la première ingestion pour de meilleures performances de construction.
