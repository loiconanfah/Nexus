using Nexus.Graph;

namespace Nexus.Tests.Integration;

/// <summary>
/// Configuration des dépendances pour les tests d'intégration. Les valeurs
/// pointent par défaut vers les conteneurs docker-compose locaux ; elles sont
/// surchargeables par variables d'environnement (CI). Les tests se *skippent*
/// si la dépendance n'est pas joignable (pas d'échec en l'absence de Docker).
/// </summary>
internal static class IntegrationEnv
{
    public static string PostgresConnectionString =>
        Environment.GetEnvironmentVariable("ConnectionStrings__Postgres")
        ?? "Host=localhost;Port=5432;Database=nexus;Username=nexus;Password=nexus_dev_pwd";

    public static Neo4jOptions Neo4j => new()
    {
        Uri = Environment.GetEnvironmentVariable("Nexus__Neo4j__Uri") ?? "bolt://localhost:7687",
        User = Environment.GetEnvironmentVariable("Nexus__Neo4j__User") ?? "neo4j",
        Password = Environment.GetEnvironmentVariable("Nexus__Neo4j__Password") ?? "nexus_dev_pwd",
        Database = "neo4j"
    };
}
