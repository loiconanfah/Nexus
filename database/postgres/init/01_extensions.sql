-- NEXUS — extensions PostgreSQL requises
-- Exécuté automatiquement au premier démarrage du conteneur (docker-entrypoint-initdb.d).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- génération d'UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- hachage / gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "vector";      -- pgvector : embeddings RAG (article 21)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- fuzzy matching (entity resolution, article 11)
