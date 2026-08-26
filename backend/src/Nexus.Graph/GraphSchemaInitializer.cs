namespace Nexus.Graph;

/// <summary>
/// Applique les contraintes et index du knowledge graph au démarrage
/// (idempotent, IF NOT EXISTS). Miroir de database/neo4j/01_constraints.cypher.
/// </summary>
public sealed class GraphSchemaInitializer(INeo4jConnection connection)
{
    private static readonly string[] Statements =
    [
        "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE",
        "CREATE INDEX entity_tenant IF NOT EXISTS FOR (n:Entity) ON (n.tenantId)",
        "CREATE INDEX entity_tenant_type IF NOT EXISTS FOR (n:Entity) ON (n.tenantId, n.entityType)",
        "CREATE INDEX entity_name IF NOT EXISTS FOR (n:Entity) ON (n.name)",
        "CREATE FULLTEXT INDEX entity_search IF NOT EXISTS FOR (n:Entity) ON EACH [n.name, n.aliases, n.description]",
        "CREATE INDEX rel_depends_confidence IF NOT EXISTS FOR ()-[r:DEPENDS_ON]-() ON (r.confidence)",
        "CREATE INDEX rel_depends_tenant IF NOT EXISTS FOR ()-[r:DEPENDS_ON]-() ON (r.tenantId)",
        "CREATE INDEX rel_depends_status IF NOT EXISTS FOR ()-[r:DEPENDS_ON]-() ON (r.status)"
    ];

    public async Task InitializeAsync(CancellationToken ct = default)
    {
        foreach (var statement in Statements)
        {
            await connection.WriteAsync(statement, new { }, ct);
        }
    }
}
