using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Risk.Spof;

namespace Nexus.Api.Controllers;

/// <summary>Analyses de risque transverses (SPOF, etc.).</summary>
[Route("api/v1/risks")]
public sealed class RisksController(
    ITenantProvider tenantProvider,
    SpofAnalyzer spofAnalyzer) : NexusController(tenantProvider)
{
    /// <summary>Single points of failure du tenant, classés par score (article 27).</summary>
    [HttpGet("spof")]
    public async Task<IActionResult> Spof([FromQuery] int limit = 25, CancellationToken ct = default)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return Ok(await spofAnalyzer.AnalyzeAsync(tenant, limit, ct: ct));
    }
}
