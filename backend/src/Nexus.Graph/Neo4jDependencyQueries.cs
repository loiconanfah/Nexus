using Neo4j.Driver;
using Nexus.Domain.Ontology;

namespace Nexus.Graph;

/// <summary>Implémentation Neo4j des traversées du Dependency Engine.</summary>
public sealed class Neo4jDependencyQueries(INeo4jConnection connection) : IDependencyQueries
{
    // Types « source dépend de cible » (validés par le registre d'ontologie).
    private static readonly string[] DepTypes = RelationType.DependencyTraversalTypes.ToArray();
    private static readonly string DepPipe = string.Join("|", DepTypes);
    private const string Redundancy = "BACKED_UP_BY|REPLACED_BY|RECOVERS_WITH";

    private const string EntityCols =
        "d.id AS id, d.tenantId AS tenantId, d.entityType AS entityType, d.name AS name, " +
        "d.criticality AS criticality, d.aliases AS aliases, d.description AS description, d.sourceSystem AS sourceSystem";

    public async Task<IReadOnlyList<GraphEntityRecord>> GetDirectDependentsAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        var cypher = $$"""
            MATCH (d:Entity)-[r]->(x:Entity { id: $id, tenantId: $t })
            WHERE type(r) IN $depTypes AND r.tenantId = $t AND r.validUntil IS NULL AND d.validUntil IS NULL
            RETURN DISTINCT {{EntityCols}}
            """;

        var records = await connection.ReadAsync(cypher,
            new { id = id.ToString(), t = tenantId.ToString(), depTypes = DepTypes }, ct);

        return records.Select(GraphRecordMapper.MapEntity).ToList();
    }

    public async Task<IReadOnlyList<BlastNode>> GetBlastRadiusAsync(Guid tenantId, Guid id, int maxDepth = 10, CancellationToken ct = default)
    {
        var depth = Math.Clamp(maxDepth, 1, 25);

        // Var-length sur les relations de dépendance ; profondeur minimale par dépendant.
        var cypher = $$"""
            MATCH path = (d:Entity)-[:{{DepPipe}}*1..{{depth}}]->(x:Entity { id: $id, tenantId: $t })
            WHERE d.tenantId = $t AND d.validUntil IS NULL
                  AND all(rel IN relationships(path) WHERE rel.tenantId = $t AND rel.validUntil IS NULL)
            RETURN {{EntityCols}}, min(length(path)) AS depth
            """;

        var records = await connection.ReadAsync(cypher,
            new { id = id.ToString(), t = tenantId.ToString() }, ct);

        return records
            .Select(r => new BlastNode(GraphRecordMapper.MapEntity(r), Convert.ToInt32(r["depth"].As<long>())))
            .ToList();
    }

    public async Task<bool> HasRedundancyAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        var cypher = $$"""
            MATCH (x:Entity { id: $id, tenantId: $t })-[r:{{Redundancy}}]->()
            WHERE r.validUntil IS NULL
            RETURN count(r) AS c
            """;

        var records = await connection.ReadAsync(cypher,
            new { id = id.ToString(), t = tenantId.ToString() }, ct);

        return records.Count > 0 && records[0]["c"].As<long>() > 0;
    }

    public async Task<IReadOnlyList<SpofRecord>> FindSpofCandidatesAsync(Guid tenantId, int limit = 50, CancellationToken ct = default)
    {
        var take = Math.Clamp(limit, 1, 500);

        // Entités sans redondance dont dépendent ≥1 autre entité, triées par dépendants directs.
        var cypher = $$"""
            MATCH (dep:Entity)-[r]->(x:Entity { tenantId: $t })
            WHERE type(r) IN $depTypes AND r.tenantId = $t AND r.validUntil IS NULL
                  AND x.validUntil IS NULL AND dep.validUntil IS NULL
            WITH x, count(DISTINCT dep) AS deps
            WHERE deps > 0 AND NOT EXISTS {
                MATCH (x)-[b:{{Redundancy}}]->() WHERE b.validUntil IS NULL
            }
            RETURN x.id AS id, x.tenantId AS tenantId, x.entityType AS entityType, x.name AS name,
                   x.criticality AS criticality, x.aliases AS aliases, x.description AS description,
                   x.sourceSystem AS sourceSystem, deps AS directDependents
            ORDER BY deps DESC, x.criticality DESC
            LIMIT {{take}}
            """;

        var records = await connection.ReadAsync(cypher,
            new { t = tenantId.ToString(), depTypes = DepTypes }, ct);

        return records.Select(r => new SpofRecord(
            GraphRecordMapper.MapEntity(r),
            Convert.ToInt32(r["directDependents"].As<long>()))).ToList();
    }
}
