using System.Text.Json;
using Neo4j.Driver;
using Nexus.Domain.Graph;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;

namespace Nexus.Graph;

/// <summary>
/// Repository Neo4j. Toutes les valeurs sont paramétrées ; seuls les LABELS et
/// TYPES de relation (issus du registre d'ontologie validé) sont interpolés,
/// après contrôle contre le registre (jamais de texte libre — SECURITY.md §8).
/// </summary>
public sealed class Neo4jGraphRepository(INeo4jConnection connection) : IGraphRepository
{
    private const string Iso = "O";

    public async Task UpsertEntityAsync(GraphEntity entity, CancellationToken ct = default)
    {
        var label = SafeLabel(entity.Type.Name, EntityType.IsKnown);

        var props = new Dictionary<string, object?>
        {
            ["id"] = entity.Id.ToString(),
            ["tenantId"] = entity.TenantId.ToString(),
            ["entityType"] = entity.Type.Name,
            ["name"] = entity.Name,
            ["description"] = entity.Description,
            ["criticality"] = entity.Criticality.Value,
            ["costPerHour"] = entity.CostPerHour, // null => propriété retirée (repli sur criticité)
            ["aliases"] = entity.Aliases.ToArray(),
            ["attributes"] = JsonSerializer.Serialize(entity.Attributes),
            ["sourceSystem"] = entity.SourceSystem,
            ["createdAt"] = entity.CreatedAt.ToString(Iso),
            ["updatedAt"] = entity.UpdatedAt.ToString(Iso),
            ["validFrom"] = entity.ValidFrom.ToString(Iso),
            ["validUntil"] = entity.ValidUntil?.ToString(Iso)
        };

        // Le label générique :Entity + le label de type (contrôlé) sont posés au MERGE.
        // Le tenant fait partie de la clé : même avec un identifiant venu d'ailleurs,
        // l'écriture ne peut jamais atteindre (ni réattribuer) le nœud d'un autre espace.
        var cypher = $$"""
            MERGE (n:Entity { id: $props.id, tenantId: $props.tenantId })
            SET n += $props
            SET n:`{{label}}`
            """;

        await connection.WriteAsync(cypher, new { props }, ct);
    }

    public async Task UpsertRelationAsync(GraphRelation relation, CancellationToken ct = default)
    {
        var relType = SafeLabel(relation.Type.Name, RelationType.IsKnown);

        // FUSION des preuves : l'import utilise des identifiants déterministes, donc
        // un ré-import retombe sur la même arête. Sans fusion, `SET r += $props`
        // effacerait ce que d'AUTRES sources (ou une validation humaine) ont établi.
        // Une lecture ponctuelle par id (indexé) précède donc l'écriture.
        var merged = await MergeWithExistingEvidencesAsync(relation, ct);
        var hasEvidence = merged.Count > 0;
        var breakdown = hasEvidence ? ConfidenceEngine.Evaluate(merged, DateTimeOffset.UtcNow) : null;

        var props = new Dictionary<string, object?>
        {
            ["id"] = relation.Id.ToString(),
            ["tenantId"] = relation.TenantId.ToString(),
            ["type"] = relation.Type.Name,
            ["confidence"] = breakdown?.Score ?? relation.Confidence.Value,
            ["status"] = (breakdown?.Status ?? relation.Status).ToString(),
            ["sourceSystem"] = relation.SourceSystem,
            ["sourceRecord"] = relation.SourceRecord,
            ["evidence"] = relation.Evidence,
            // Preuves structurées (Evidence Engine), sérialisées sur l'arête —
            // même patron que `attributes` sur les nœuds.
            ["evidences"] = JsonSerializer.Serialize(merged),
            ["createdAt"] = relation.CreatedAt.ToString(Iso),
            ["updatedAt"] = relation.UpdatedAt.ToString(Iso),
            ["verifiedAt"] = relation.VerifiedAt?.ToString(Iso),
            ["verifiedBy"] = relation.VerifiedBy,
            ["validFrom"] = relation.ValidFrom.ToString(Iso),
            ["validUntil"] = relation.ValidUntil?.ToString(Iso)
        };

        var cypher = $$"""
            MATCH (s:Entity { id: $sourceId, tenantId: $tenantId })
            MATCH (t:Entity { id: $targetId, tenantId: $tenantId })
            MERGE (s)-[r:`{{relType}}` { id: $props.id }]->(t)
            SET r += $props
            """;

        await connection.WriteAsync(cypher, new
        {
            sourceId = relation.SourceId.ToString(),
            targetId = relation.TargetId.ToString(),
            tenantId = relation.TenantId.ToString(),
            props
        }, ct);
    }

    public async Task<bool> DeleteEntityAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        // Suppression définitive, filtrée par tenant, avec ses relations (DETACH).
        const string cypher = """
            OPTIONAL MATCH (n:Entity { id: $id, tenantId: $tenantId })
            WITH n, n IS NOT NULL AS existed
            DETACH DELETE n
            RETURN existed
            """;
        var res = await connection.WriteAsync(cypher, new { id = id.ToString(), tenantId = tenantId.ToString() }, ct);
        return res.Count > 0 && res[0]["existed"].As<bool>();
    }

    // ── Mise de côté (« désinstaller ») : réutilise la validité temporelle. Un
    // actif mis de côté (validUntil non nul) disparaît de TOUTES les lectures
    // actives (graphe, propagation, impact) sans être supprimé, et reste
    // réactivable. Aucun changement des moteurs : ils filtrent déjà validUntil.
    public async Task<bool> DecommissionEntityAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        const string cypher = """
            MATCH (n:Entity { id: $id, tenantId: $tenantId })
            SET n.validUntil = $now, n.updatedAt = $now
            RETURN count(n) AS c
            """;
        var now = DateTimeOffset.UtcNow.ToString(Iso);
        var res = await connection.WriteAsync(cypher, new { id = id.ToString(), tenantId = tenantId.ToString(), now }, ct);
        return res.Count > 0 && res[0]["c"].As<long>() > 0;
    }

    public async Task<bool> ReactivateEntityAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        const string cypher = """
            MATCH (n:Entity { id: $id, tenantId: $tenantId })
            SET n.validUntil = null, n.validFrom = $now, n.updatedAt = $now
            RETURN count(n) AS c
            """;
        var now = DateTimeOffset.UtcNow.ToString(Iso);
        var res = await connection.WriteAsync(cypher, new { id = id.ToString(), tenantId = tenantId.ToString(), now }, ct);
        return res.Count > 0 && res[0]["c"].As<long>() > 0;
    }

    // Coût d'arrêt réel par heure. null / ≤ 0 retire la propriété (repli sur la
    // criticité). Ne filtre pas validUntil : on peut régler le coût même mis de côté.
    public async Task<bool> SetCostPerHourAsync(Guid tenantId, Guid id, double? costPerHour, CancellationToken ct = default)
    {
        const string cypher = """
            MATCH (n:Entity { id: $id, tenantId: $tenantId })
            SET n.costPerHour = $cost, n.updatedAt = $now
            RETURN count(n) AS c
            """;
        object? cost = costPerHour is > 0 ? costPerHour.Value : null;
        var now = DateTimeOffset.UtcNow.ToString(Iso);
        var res = await connection.WriteAsync(cypher, new { id = id.ToString(), tenantId = tenantId.ToString(), cost, now }, ct);
        return res.Count > 0 && res[0]["c"].As<long>() > 0;
    }

    // Actifs mis de côté (validUntil non nul) — pour les afficher et les réactiver.
    public async Task<IReadOnlyList<GraphEntityRecord>> GetArchivedEntitiesAsync(Guid tenantId, int limit = 500, CancellationToken ct = default)
    {
        var take = Math.Clamp(limit, 1, 5000);
        var cypher = $$"""
            MATCH (n:Entity { tenantId: $t })
            WHERE n.validUntil IS NOT NULL
            RETURN n.id AS id, n.tenantId AS tenantId, n.entityType AS entityType, n.name AS name,
                   n.criticality AS criticality, n.aliases AS aliases, n.description AS description,
                   n.sourceSystem AS sourceSystem, n.costPerHour AS costPerHour
            ORDER BY n.updatedAt DESC
            LIMIT {{take}}
            """;
        var records = await connection.ReadAsync(cypher, new { t = tenantId.ToString() }, ct);
        return records.Select(GraphRecordMapper.MapEntity).ToList();
    }

    public async Task<GraphEntityRecord?> GetEntityAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        const string cypher = """
            MATCH (n:Entity { id: $id, tenantId: $tenantId })
            WHERE n.validUntil IS NULL
            RETURN n.id AS id, n.tenantId AS tenantId, n.entityType AS entityType,
                   n.name AS name, n.criticality AS criticality, n.aliases AS aliases,
                   n.description AS description, n.sourceSystem AS sourceSystem,
                   n.costPerHour AS costPerHour
            """;

        var records = await connection.ReadAsync(cypher,
            new { id = id.ToString(), tenantId = tenantId.ToString() }, ct);

        return records.Count == 0 ? null : GraphRecordMapper.MapEntity(records[0]);
    }

    public async Task<IReadOnlyList<DirectDependencyRecord>> GetDirectDependenciesAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        var depTypes = RelationType.DependencyTraversalTypes.ToArray();

        const string cypher = """
            MATCH (s:Entity { id: $id, tenantId: $tenantId })-[r]->(t:Entity)
            WHERE r.tenantId = $tenantId AND r.validUntil IS NULL AND type(r) IN $depTypes
            RETURN t.id AS id, t.tenantId AS tenantId, t.entityType AS entityType,
                   t.name AS name, t.criticality AS criticality, t.aliases AS aliases,
                   t.description AS description, t.sourceSystem AS sourceSystem,
                   t.costPerHour AS costPerHour,
                   type(r) AS relType, r.confidence AS confidence, r.status AS status
            """;

        var records = await connection.ReadAsync(cypher, new
        {
            id = id.ToString(),
            tenantId = tenantId.ToString(),
            depTypes
        }, ct);

        return records.Select(r => new DirectDependencyRecord(
            GraphRecordMapper.MapEntity(r),
            r["relType"].As<string>(),
            r["confidence"].As<double>(),
            r["status"].As<string>())).ToList();
    }

    public async Task<IReadOnlyList<GraphEntityRecord>> GetEntitiesAsync(Guid tenantId, int limit = 2000, CancellationToken ct = default)
    {
        var take = Math.Clamp(limit, 1, 20000);
        var cypher = $$"""
            MATCH (n:Entity { tenantId: $t })
            WHERE n.validUntil IS NULL
            RETURN n.id AS id, n.tenantId AS tenantId, n.entityType AS entityType, n.name AS name,
                   n.criticality AS criticality, n.aliases AS aliases, n.description AS description,
                   n.sourceSystem AS sourceSystem, n.costPerHour AS costPerHour
            LIMIT {{take}}
            """;

        var records = await connection.ReadAsync(cypher, new { t = tenantId.ToString() }, ct);
        return records.Select(GraphRecordMapper.MapEntity).ToList();
    }

    public async Task<IReadOnlyList<GraphEdgeRecord>> GetRelationsAsync(Guid tenantId, int limit = 5000, CancellationToken ct = default)
    {
        var take = Math.Clamp(limit, 1, 50000);
        var cypher = $$"""
            MATCH (s:Entity { tenantId: $t })-[r]->(tg:Entity { tenantId: $t })
            WHERE r.validUntil IS NULL
            RETURN r.id AS id, s.id AS source, tg.id AS target, type(r) AS type,
                   r.confidence AS confidence, r.status AS status,
                   r.sourceSystem AS sourceSystem, r.evidence AS evidence,
                   r.evidences AS evidences
            LIMIT {{take}}
            """;

        var records = await connection.ReadAsync(cypher, new { t = tenantId.ToString() }, ct);
        return records.Select(r => new GraphEdgeRecord(
            Guid.Parse(r["id"].As<string>()),
            Guid.Parse(r["source"].As<string>()),
            Guid.Parse(r["target"].As<string>()),
            r["type"].As<string>(),
            r["confidence"].As<double>(),
            r["status"].As<string>(),
            r["sourceSystem"]?.As<string>(),
            r["evidence"]?.As<string>(),
            DeserializeEvidences(r["evidences"]?.As<string>()))).ToList();
    }

    /// <summary>
    /// Preuves existantes de l'arête + celles de la relation entrante. Une source
    /// qui re-confirme le même fait REMPLACE sa propre preuve (on garde la plus
    /// récente) ; les preuves des autres sources sont préservées.
    /// </summary>
    private async Task<List<RelationEvidence>> MergeWithExistingEvidencesAsync(
        GraphRelation relation, CancellationToken ct)
    {
        var incoming = relation.Evidences.ToList();

        const string read = """
            MATCH ()-[r { id: $id, tenantId: $tenantId }]->()
            RETURN r.evidences AS evidences
            """;
        var rows = await connection.ReadAsync(read,
            new { id = relation.Id.ToString(), tenantId = relation.TenantId.ToString() }, ct);
        if (rows.Count == 0) return incoming; // nouvelle arête

        var merged = DeserializeEvidences(rows[0]["evidences"]?.As<string>()).ToList();
        foreach (var e in incoming)
        {
            merged.RemoveAll(x =>
                x.Source == e.Source &&
                string.Equals(x.SourceSystem, e.SourceSystem, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(x.SourceRecord, e.SourceRecord, StringComparison.OrdinalIgnoreCase));
            merged.Add(e);
        }
        return merged;
    }

    private static IReadOnlyList<RelationEvidence> DeserializeEvidences(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<List<RelationEvidence>>(json) ?? []; }
        catch { return []; } // preuves illisibles : on n'invente rien, on repart de zéro
    }

    /// <summary>
    /// Ajoute une PREUVE à une relation existante et recalcule sa confiance.
    /// C'est le chemin par lequel une source qui re-confirme un fait renforce la
    /// relation au lieu de créer un doublon (lecture → fusion en mémoire →
    /// réécriture), et par lequel une validation humaine s'ajoute à la trace.
    /// </summary>
    public async Task<ConfidenceBreakdown?> AddRelationEvidenceAsync(
        Guid tenantId, Guid relationId, RelationEvidence evidence, string? verifiedBy = null, CancellationToken ct = default)
    {
        const string read = """
            MATCH ()-[r { id: $id, tenantId: $tenantId }]->()
            RETURN r.evidences AS evidences
            """;
        var rows = await connection.ReadAsync(read, new { id = relationId.ToString(), tenantId = tenantId.ToString() }, ct);
        if (rows.Count == 0) return null;

        var evidences = DeserializeEvidences(rows[0]["evidences"]?.As<string>()).ToList();

        // Une même source re-confirmant le même fait remplace sa preuve précédente
        // (on garde la plus récente) au lieu de gonfler la confiance par répétition.
        evidences.RemoveAll(e =>
            e.Source == evidence.Source &&
            string.Equals(e.SourceSystem, evidence.SourceSystem, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(e.SourceRecord, evidence.SourceRecord, StringComparison.OrdinalIgnoreCase));
        evidences.Add(evidence);

        var now = DateTimeOffset.UtcNow;
        var breakdown = ConfidenceEngine.Evaluate(evidences, now);

        const string write = """
            MATCH ()-[r { id: $id, tenantId: $tenantId }]->()
            SET r.evidences = $evidences,
                r.confidence = $confidence,
                r.status = $status,
                r.updatedAt = $now,
                r.verifiedBy = coalesce($verifiedBy, r.verifiedBy),
                r.verifiedAt = CASE WHEN $verifiedBy IS NULL THEN r.verifiedAt ELSE $now END
            RETURN count(r) AS c
            """;
        await connection.WriteAsync(write, new
        {
            id = relationId.ToString(),
            tenantId = tenantId.ToString(),
            evidences = JsonSerializer.Serialize(evidences),
            confidence = breakdown.Score,
            status = breakdown.Status.ToString(),
            now = now.ToString(Iso),
            verifiedBy,
        }, ct);

        return breakdown;
    }

    /// <summary>Contrôle qu'un label/type provient bien du registre d'ontologie avant interpolation.</summary>
    private static string SafeLabel(string name, Func<string, bool> isKnown)
    {
        if (!isKnown(name))
        {
            throw new InvalidOperationException($"Label d'ontologie non reconnu : '{name}'.");
        }

        return name;
    }
}
