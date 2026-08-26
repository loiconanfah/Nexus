using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Nexus.Infrastructure.Persistence;

/// <summary>
/// Fabrique design-time pour les commandes EF Core (migrations). Utilise la
/// variable d'environnement <c>ConnectionStrings__Postgres</c> si présente,
/// sinon la chaîne de développement local (docker-compose). Jamais utilisée à
/// l'exécution — le runtime configure le DbContext via l'injection de dépendances.
/// </summary>
public sealed class NexusDbContextFactory : IDesignTimeDbContextFactory<NexusDbContext>
{
    public NexusDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__Postgres")
            ?? "Host=localhost;Port=5432;Database=nexus;Username=nexus;Password=nexus_dev_pwd";

        var options = new DbContextOptionsBuilder<NexusDbContext>()
            .UseNpgsql(connectionString, o => o.UseVector())
            .UseSnakeCaseNamingConvention()
            .Options;

        return new NexusDbContext(options);
    }
}
