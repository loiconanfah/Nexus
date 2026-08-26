using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Graph;

namespace Nexus.Api.Controllers;

/// <summary>Export du knowledge graph pour l'explorateur (article 35).</summary>
[Route("api/v1/graph")]
public sealed class GraphController(
    ITenantProvider tenantProvider,
    IGraphRepository repository) : NexusController(tenantProvider)
{
    /// <summary>Nœuds + arêtes du tenant (graphe complet, borné).</summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var nodes = await repository.GetEntitiesAsync(tenant, ct: ct);
        var edges = await repository.GetRelationsAsync(tenant, ct: ct);
        return Ok(new { nodes, edges });
    }
}
