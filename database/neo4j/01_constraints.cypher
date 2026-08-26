// =====================================================================
// NEXUS — Knowledge Graph (Neo4j) — Contraintes & index initiaux (V1)
// =====================================================================
// Le graphe porte l'ONTOLOGIE opérationnelle : entités (noeuds) et
// dépendances (relations). Tout noeud est multi-tenant via la propriété
// `tenantId` et identifié de façon stable par `id` (UUID généré par NEXUS).
//
// Convention :
//   - Un label générique :Entity sur TOUS les noeuds (requêtes transverses)
//   - Un label spécifique par type d'ontologie (:Server, :Application, ...)
//   - Chaque relation porte : id, type, confidence, status, sourceSystem,
//     sourceRecord, createdAt, updatedAt, verifiedAt, verifiedBy, evidence
//     (article 8).
// À exécuter une fois à l'initialisation (idempotent : IF NOT EXISTS).
// =====================================================================

// ---------- Identité & unicité ----------
CREATE CONSTRAINT entity_id IF NOT EXISTS
  FOR (n:Entity) REQUIRE n.id IS UNIQUE;

// ---------- Index transverses ----------
CREATE INDEX entity_tenant IF NOT EXISTS
  FOR (n:Entity) ON (n.tenantId);

CREATE INDEX entity_tenant_type IF NOT EXISTS
  FOR (n:Entity) ON (n.tenantId, n.entityType);

CREATE INDEX entity_name IF NOT EXISTS
  FOR (n:Entity) ON (n.name);

// Recherche floue / entity resolution (article 11)
CREATE FULLTEXT INDEX entity_search IF NOT EXISTS
  FOR (n:Entity) ON EACH [n.name, n.aliases, n.description];

// ---------- Index sur les relations de dépendance (article 13) ----------
// Toutes les relations opérationnelles sont typées ; DEPENDS_ON est la
// relation pivot du Dependency Engine. Index sur les propriétés clés.
CREATE INDEX rel_depends_confidence IF NOT EXISTS
  FOR ()-[r:DEPENDS_ON]-() ON (r.confidence);

CREATE INDEX rel_depends_tenant IF NOT EXISTS
  FOR ()-[r:DEPENDS_ON]-() ON (r.tenantId);

CREATE INDEX rel_depends_status IF NOT EXISTS
  FOR ()-[r:DEPENDS_ON]-() ON (r.status);
