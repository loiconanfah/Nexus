-- =====================================================================
-- NEXUS — Modèle PostgreSQL initial (V1) — Plan de contrôle
-- =====================================================================
-- PostgreSQL est la source de vérité pour l'ÉTAT APPLICATIF :
-- tenants, organisations, utilisateurs, RBAC, connecteurs, imports/jobs,
-- audit, métadonnées, documents + embeddings.
-- Le GRAPHE opérationnel (assets, dépendances, propagation) vit dans Neo4j.
--
-- Note : ce script documente le modèle cible. En pratique le schéma est
-- géré et versionné par EF Core Migrations (Nexus.Infrastructure). Ce
-- fichier sert de référence lisible et de bootstrap pour un environnement
-- purement SQL. Convention : snake_case, clés primaires UUID.
-- =====================================================================

-- ---------- Isolation multi-tenant (article 41) ----------
CREATE TABLE tenant (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    deployment_mode TEXT NOT NULL DEFAULT 'saas'      -- saas | private_cloud | on_prem
        CHECK (deployment_mode IN ('saas','private_cloud','on_prem')),
    status          TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','suspended','archived')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    industry        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_organization_tenant ON organization(tenant_id);

CREATE TABLE business_unit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    parent_id       UUID REFERENCES business_unit(id) ON DELETE SET NULL
);
CREATE INDEX ix_bu_org ON business_unit(organization_id);

-- ---------- Identité & RBAC (articles 41/42) ----------
CREATE TABLE app_user (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    external_id     TEXT,                              -- sub Entra ID (OIDC)
    email           TEXT NOT NULL,
    display_name    TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','disabled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ,
    UNIQUE (tenant_id, email)
);
CREATE INDEX ix_user_tenant ON app_user(tenant_id);

-- Rôles prédéfinis (article 41) : platform_admin, org_admin, risk_manager,
-- security_analyst, it_manager, executive, auditor, read_only
CREATE TABLE role (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenant(id) ON DELETE CASCADE,  -- NULL = rôle système global
    key             TEXT NOT NULL,                    -- ex : risk_manager
    name            TEXT NOT NULL,
    is_system       BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (tenant_id, key)
);

-- Permissions granulaires (article 42) : assets.read, risks.manage, ...
CREATE TABLE permission (
    key             TEXT PRIMARY KEY,                 -- ex : simulations.execute
    description     TEXT NOT NULL
);

CREATE TABLE role_permission (
    role_id         UUID NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    permission_key  TEXT NOT NULL REFERENCES permission(key) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE user_role (
    user_id         UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ---------- Connecteurs & Ingestion (articles 10/12) ----------
CREATE TABLE connector (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,                    -- csv | excel | json | rest | azure | m365 ...
    name            TEXT NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}',      -- config non-secrète ; secrets -> Key Vault
    is_read_only    BOOLEAN NOT NULL DEFAULT true,    -- article 3 : read-only first
    status          TEXT NOT NULL DEFAULT 'configured'
        CHECK (status IN ('configured','healthy','degraded','failed','disabled')),
    last_sync_at    TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_connector_tenant ON connector(tenant_id);

CREATE TABLE ingestion_job (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    connector_id    UUID REFERENCES connector(id) ON DELETE SET NULL,
    mode            TEXT NOT NULL DEFAULT 'full'      -- full | incremental
        CHECK (mode IN ('full','incremental')),
    status          TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
    records_read    INTEGER NOT NULL DEFAULT 0,
    records_mapped  INTEGER NOT NULL DEFAULT 0,
    error           TEXT,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_job_tenant_status ON ingestion_job(tenant_id, status);

-- Data lineage (article 12) : d'où vient chaque donnée mappée dans le graphe.
CREATE TABLE data_lineage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    graph_node_id   TEXT,                             -- id de l'entité côté Neo4j
    graph_edge_id   TEXT,                             -- ou id de la relation
    connector_id    UUID REFERENCES connector(id) ON DELETE SET NULL,
    job_id          UUID REFERENCES ingestion_job(id) ON DELETE SET NULL,
    source_system   TEXT,
    source_record   TEXT,                             -- clé/identifiant dans le système source
    transformed     BOOLEAN NOT NULL DEFAULT false,
    inferred        BOOLEAN NOT NULL DEFAULT false,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_lineage_node ON data_lineage(graph_node_id);
CREATE INDEX ix_lineage_edge ON data_lineage(graph_edge_id);

-- ---------- Documents & RAG (articles 21/22) ----------
CREATE TABLE document (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    doc_type        TEXT,                             -- contract | procedure | incident | policy ...
    blob_uri        TEXT NOT NULL,                    -- Azure Blob / Azurite
    content_hash    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_document_tenant ON document(tenant_id);

CREATE TABLE document_chunk (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    content         TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    embedding       vector(3072),                     -- text-embedding-3-large
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_chunk_tenant ON document_chunk(tenant_id);
-- Index vectoriel ANN (créé après ingestion initiale pour de meilleures perfs) :
-- CREATE INDEX ix_chunk_embedding ON document_chunk USING hnsw (embedding vector_cosine_ops);

-- ---------- Audit (article 43) ----------
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID REFERENCES tenant(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES app_user(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,                    -- login | data_import | risk_modified | ai_query ...
    entity_type     TEXT,
    entity_id       TEXT,
    detail          JSONB NOT NULL DEFAULT '{}',
    ip_address      INET,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_tenant_time ON audit_log(tenant_id, occurred_at DESC);
CREATE INDEX ix_audit_action ON audit_log(action);

-- ---------- Configuration du moteur de risque (articles 14/15) ----------
-- La formule de risque N'EST JAMAIS hardcodée : coefficients configurables par tenant.
CREATE TABLE risk_profile (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    weights         JSONB NOT NULL,                   -- { criticality: 0.25, exposure: 0.15, ... }
    thresholds      JSONB NOT NULL DEFAULT
        '{"low":20,"moderate":40,"elevated":60,"high":80}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_riskprofile_tenant ON risk_profile(tenant_id);
