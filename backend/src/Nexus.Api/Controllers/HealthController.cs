using Microsoft.AspNetCore.Mvc;

namespace Nexus.Api.Controllers;

/// <summary>
/// Point de contrôle de santé du service (utilisé par les healthchecks Docker/Azure).
/// Endpoint minimal de la Phase 0 ; enrichi ultérieurement avec l'état de
/// PostgreSQL, Neo4j et des dépendances externes.
/// </summary>
[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        service = "Nexus.Api",
        status = "healthy",
        utc = DateTimeOffset.UtcNow
    });
}
