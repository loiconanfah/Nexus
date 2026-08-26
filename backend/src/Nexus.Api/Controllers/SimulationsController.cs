using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Risk.Propagation;

namespace Nexus.Api.Controllers;

/// <summary>Requête de simulation de défaillance (What-If, article 16).</summary>
public sealed record SimulateFailureRequest(Guid AssetId, ScenarioType Scenario = ScenarioType.ServerFailure, int MaxDepth = 10);

/// <summary>Moteur What-If : simulation de défaillance et cascade d'impacts.</summary>
[Route("api/v1/simulations")]
public sealed class SimulationsController(
    ITenantProvider tenantProvider,
    PropagationEngine propagation) : NexusController(tenantProvider)
{
    /// <summary>Simule la défaillance d'un actif et renvoie la propagation.</summary>
    [HttpPost]
    public async Task<IActionResult> Simulate([FromBody] SimulateFailureRequest request, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        if (request.AssetId == Guid.Empty)
        {
            return BadRequest("assetId requis.");
        }

        var result = await propagation.SimulateFailureAsync(tenant, request.AssetId, request.Scenario, request.MaxDepth, ct);
        return Ok(result);
    }
}
