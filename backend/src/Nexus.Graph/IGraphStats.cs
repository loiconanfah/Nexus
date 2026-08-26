using Neo4j.Driver;

namespace Nexus.Graph;

/// <summary>Statistiques agrégées du graphe d'un tenant (pour le tableau de bord).</summary>
public sealed record GraphStats(
    int EntityCount,
    int RelationCount,
    IReadOnlyDictionary<string, int> EntitiesByType);

public interface IGraphStats
{
    Task<GraphStats> GetStatsAsync(Guid tenantId, CancellationToken ct = default);
}

/// <summary>Implémentation Neo4j des statistiques de graphe.</summary>
public sealed class Neo4jGraphStats(INeo4jConnection connection) : IGraphStats
{
    public async Task<GraphStats> GetStatsAsync(Guid tenantId, CancellationToken ct = default)
    {
        const string byTypeCypher = """
            MATCH (n:Entity { tenantId: $t })
            WHERE n.validUntil IS NULL
            RETURN n.entityType AS type, count(*) AS c
            """;

        const string relCypher = """
            MATCH ()-[r]->()
            WHERE r.tenantId = $t AND r.validUntil IS NULL
            RETURN count(r) AS c
            """;

        var byTypeRecords = await connection.ReadAsync(byTypeCypher, new { t = tenantId.ToString() }, ct);
        var byType = byTypeRecords.ToDictionary(
            r => r["type"].As<string>(),
            r => Convert.ToInt32(r["c"].As<long>()));

        var relRecords = await connection.ReadAsync(relCypher, new { t = tenantId.ToString() }, ct);
        var relationCount = relRecords.Count == 0 ? 0 : Convert.ToInt32(relRecords[0]["c"].As<long>());

        return new GraphStats(byType.Values.Sum(), relationCount, byType);
    }
}
