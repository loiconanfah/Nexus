using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;
using Nexus.Infrastructure.Persistence.Entities;

namespace Nexus.Tests.Integration;

/// <summary>
/// Tests d'intégration du plan de contrôle contre un PostgreSQL réel
/// (docker-compose). Valide la connectivité et un aller-retour d'écriture/lecture.
/// </summary>
[Trait("Category", "Integration")]
public class PostgresIntegrationTests
{
    private static NexusDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<NexusDbContext>()
            .UseNpgsql(IntegrationEnv.PostgresConnectionString, o => o.UseVector())
            .UseSnakeCaseNamingConvention()
            .Options;

        return new NexusDbContext(options);
    }

    [SkippableFact]
    public async Task Insert_and_read_tenant_round_trip()
    {
        await using var db = CreateContext();
        Skip.IfNot(await db.Database.CanConnectAsync(), "PostgreSQL non joignable — test d'intégration ignoré.");

        var tenant = new Tenant
        {
            Name = "ACME Test",
            Slug = $"acme-{Guid.NewGuid():N}"
        };

        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        try
        {
            var read = await db.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Id == tenant.Id);
            Assert.NotNull(read);
            Assert.Equal("ACME Test", read!.Name);
            Assert.Equal("saas", read.DeploymentMode);   // valeur par défaut
            Assert.Equal("active", read.Status);
        }
        finally
        {
            db.Tenants.Remove(tenant);
            await db.SaveChangesAsync();
        }
    }
}
