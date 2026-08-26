using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Infrastructure;

/// <summary>Enregistrement des services du module Infrastructure.</summary>
public static class DependencyInjection
{
    /// <summary>
    /// Enregistre le <see cref="NexusDbContext"/> (PostgreSQL + pgvector,
    /// nommage snake_case).
    /// </summary>
    public static IServiceCollection AddNexusInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<NexusDbContext>(options =>
            options
                .UseNpgsql(connectionString, npgsql => npgsql.UseVector())
                .UseSnakeCaseNamingConvention());

        return services;
    }
}
