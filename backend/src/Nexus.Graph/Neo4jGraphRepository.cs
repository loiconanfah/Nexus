using System.Text.Json;
using Neo4j.Driver;
using Nexus.Domain.Graph;
using Nexus.Domain.Ontology;

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
            ["aliases"] = entity.Aliases.ToArray(),
            ["attributes"] = JsonSerializer.Serialize(entity.Attributes),
            ["sourceSystem"] = entity.SourceSystem,
            ["createdAt"] = entity.CreatedAt.ToString(Iso),
            ["updatedAt"] = entity.UpdatedAt.ToString(Iso),
            ["validFrom"] = entity.ValidFrom.ToString(Iso),
            ["validUntil"] = entity.ValidUntil?.ToString(Iso)
        };

        // Le label générique :Entity + le label de type (contrôlé) sont posés au MERGE.
        var cypher = $$"""
            MERGE (n:Entity { id: $props.id })
            SET n += $props
            SET n:`{{label}}`
            """;

        await connection.WriteAsync(cypher, new { props }, ct);
    }

    public async Task UpsertRelationAsync(GraphRelation relation, CancellationToken ct = default)
    {
        var relType = SafeLabel(relation.Type.Name, RelationType.IsKnown);

        var props = new Dictionary<string, object?>
        {
            ["id"] = relation.Id.ToString(),
            ["tenantId"] = relation.TenantId.ToString(),
            ["type"] = relation.Type.Name,
            ["confidence"] = relation.Confidence.Value,
            ["status"] = relation.Status.ToString(),
            ["sourceSystem"] = relation.SourceSystem,
            ["sourceRecord"] = relation.SourceRecord,
            ["evidence"] = relation.Evidence,
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

    public async Task<GraphEntityRecord?> GetEntityAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        const string cypher = """
            MATCH (n:Entity { id: $id, tenantId: $tenantId })
            WHERE n.validUntil IS NULL
            RETURN n.id AS id, n.tenantId AS tenantId, n.entityType AS entityType,
                   n.name AS name, n.criticality AS criticality, n.aliases AS aliases,
                   n.description AS description, n.sourceSystem AS sourceSystem
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
