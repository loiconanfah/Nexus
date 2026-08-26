using Microsoft.AspNetCore.Mvc;
using Nexus.Graph;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Controllers;

/// <summary>
/// Contrôles de santé du service (liveness + readiness des dépendances).
/// Utilisé par les healthchecks Docker/Azure.
/// </summary>
[ApiController]
[Route("health")]
public sealed class HealthController(NexusDbContext db, INeo4jConnection graph) : ControllerBase
{
    /// <summary>Liveness : le service répond.</summary>
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        service = "Nexus.Api",
        status = "healthy",
        utc = DateTimeOffset.UtcNow
    });

    /// <summary>Readiness : PostgreSQL et Neo4j sont joignables.</summary>
    [HttpGet("ready")]
    public async Task<IActionResult> Ready(CancellationToken ct)
    {
        var postgresOk = await db.Database.CanConnectAsync(ct);
        var neo4jOk = await graph.VerifyConnectivityAsync(ct);
        var ready = postgresOk && neo4jOk;

        var payload = new
        {
            status = ready ? "ready" : "degraded",
            dependencies = new { postgres = postgresOk, neo4j = neo4jOk },
            utc = DateTimeOffset.UtcNow
        };

        return ready ? Ok(payload) : StatusCode(503, payload);
    }
}
