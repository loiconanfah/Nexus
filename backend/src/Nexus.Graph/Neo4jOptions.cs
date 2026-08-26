namespace Nexus.Graph;

/// <summary>Configuration de connexion au knowledge graph Neo4j.</summary>
public sealed class Neo4jOptions
{
    public const string SectionName = "Nexus:Neo4j";

    public string Uri { get; set; } = "bolt://localhost:7687";
    public string User { get; set; } = "neo4j";
    public string Password { get; set; } = "nexus_dev_pwd";

    /// <summary>Base de données Neo4j cible (multi-db en édition Enterprise/Aura).</summary>
    public string Database { get; set; } = "neo4j";
}
