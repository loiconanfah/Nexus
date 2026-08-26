using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Graph;
using Nexus.Risk;
using Nexus.Risk.Spof;

namespace Nexus.Api.Controllers;

/// <summary>Analyses de risque transverses (Risk Center, SPOF — articles 27, 37).</summary>
[Route("api/v1/risks")]
public sealed class RisksController(
    ITenantProvider tenantProvider,
    IGraphRepository repository,
    RiskAnalyzer riskAnalyzer,
    SpofAnalyzer spofAnalyzer) : NexusController(tenantProvider)
{
    /// <summary>Single points of failure du tenant, classés par score (article 27).</summary>
    [HttpGet("spof")]
    public async Task<IActionResult> Spof([FromQuery] int limit = 25, CancellationToken ct = default)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return Ok(await spofAnalyzer.AnalyzeAsync(tenant, limit, ct: ct));
    }

    /// <summary>Toutes les entités classées par risque (Risk Center, article 37).</summary>
    [HttpGet("entities")]
    public async Task<IActionResult> Entities(CancellationToken ct = default)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var entities = await repository.GetEntitiesAsync(tenant, ct: ct);
        var rows = new List<object>(entities.Count);

        foreach (var entity in entities)
        {
            var risk = await riskAnalyzer.AssessEntityAsync(tenant, entity.Id, ct: ct);
            if (risk is null) continue;

            rows.Add(new
            {
                id = entity.Id,
                name = entity.Name,
                entityType = entity.EntityType,
                score = risk.Assessment.Score,
                band = risk.Assessment.Band,
                effectiveCriticality = risk.EffectiveCriticality,
                directDependents = risk.DirectDependents,
                blastRadius = risk.BlastRadius,
                hasRedundancy = risk.HasRedundancy,
            });
        }

        return Ok(rows.OrderByDescending(r => ((dynamic)r).score));
    }
}
