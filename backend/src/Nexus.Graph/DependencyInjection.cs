using Microsoft.Extensions.DependencyInjection;

namespace Nexus.Graph;

/// <summary>Enregistrement des services du module Graph (Neo4j).</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddNexusGraph(this IServiceCollection services, Action<Neo4jOptions> configure)
    {
        services.Configure(configure);

        // Le driver Neo4j est thread-safe et coûteux : connexion en singleton.
        services.AddSingleton<INeo4jConnection, Neo4jConnection>();
        services.AddScoped<IGraphRepository, Neo4jGraphRepository>();
        services.AddScoped<GraphSchemaInitializer>();

        return services;
    }
}
