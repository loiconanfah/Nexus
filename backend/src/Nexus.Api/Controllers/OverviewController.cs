using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Graph;
using Nexus.Risk.Spof;

namespace Nexus.Api.Controllers;

/// <summary>Synthèse organisationnelle pour le tableau de bord (article 34).</summary>
[Route("api/v1/overview")]
public sealed class OverviewController(
    ITenantProvider tenantProvider,
    IGraphStats stats,
    SpofAnalyzer spofAnalyzer) : NexusController(tenantProvider)
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var graph = await stats.GetStatsAsync(tenant, ct);
        var spofs = await spofAnalyzer.AnalyzeAsync(tenant, limit: 10, ct: ct);

        // Health score : 100 moins la sévérité moyenne des principaux SPOF (heuristique explicable).
        var top = spofs.Take(5).ToList();
        var avgSpof = top.Count == 0 ? 0 : top.Average(s => s.Score);
        var health = (int)Math.Clamp(100 - avgSpof * 0.6, 0, 100);

        return Ok(new
        {
            organizationHealthScore = health,
            entityCount = graph.EntityCount,
            relationCount = graph.RelationCount,
            entitiesByType = graph.EntitiesByType,
            spofCount = spofs.Count,
            criticalSpofCount = spofs.Count(s => s.Score >= 80),
            topSpofs = spofs.Take(8).Select(s => new
            {
                id = s.Entity.Id,
                name = s.Entity.Name,
                entityType = s.Entity.EntityType,
                score = s.Score,
                directDependents = s.DirectDependents,
                blastRadius = s.BlastRadius,
                criticality = s.Entity.Criticality
            })
        });
    }
}
