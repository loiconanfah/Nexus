using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Risk;
using Nexus.Risk.Propagation;

namespace Nexus.Api.Controllers;

/// <summary>Requête de simulation de défaillance (What-If, article 16).</summary>
public sealed record SimulateFailureRequest(
    Guid AssetId,
    ScenarioType Scenario = ScenarioType.ServerFailure,
    int MaxDepth = 10,
    int DurationHours = 8);

/// <summary>Moteur What-If : simulation de défaillance et cascade d'impacts.</summary>
[Route("api/v1/simulations")]
public sealed class SimulationsController(
    ITenantProvider tenantProvider,
    PropagationEngine propagation) : NexusController(tenantProvider)
{
    /// <summary>Simule la défaillance d'un actif et renvoie la propagation + l'impact financier estimé.</summary>
    [HttpPost]
    public async Task<IActionResult> Simulate([FromBody] SimulateFailureRequest request, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (request.AssetId == Guid.Empty)
        {
            return BadRequest("assetId requis.");
        }

        var result = await propagation.SimulateFailureAsync(tenant, request.AssetId, request.Scenario, request.MaxDepth, ct);

        // Modèle réaliste : coût horaire, RTO (temps de rétablissement) et
        // probabilité de propagation par actif → impact pire cas et attendu.
        var nodes = result.Affected.Select(b =>
        {
            var cost = BusinessImpactModel.CostPerHour(b.Entity.Criticality);
            var rto = BusinessImpactModel.RtoHours(b.Entity.EntityType, b.Entity.Criticality);
            var prob = BusinessImpactModel.FailureProbability(b.Depth);
            return new
            {
                id = b.Entity.Id, name = b.Entity.Name, type = b.Entity.EntityType,
                depth = b.Depth, criticality = b.Entity.Criticality,
                hourlyCost = cost, rtoHours = rto, probability = prob,
                nodeImpact = (long)Math.Round(cost * rto),
            };
        }).ToList();

        var perHour = nodes.Sum(n => n.hourlyCost);
        var worstCase = nodes.Sum(n => n.nodeImpact);                                   // tout casse, chacun jusqu'à son rétablissement
        var expected = (long)Math.Round(nodes.Sum(n => n.hourlyCost * n.rtoHours * n.probability)); // pondéré par la probabilité
        var maxRecovery = nodes.Count == 0 ? 0 : nodes.Max(n => n.rtoHours);
        var avgProbability = nodes.Count == 0 ? 0 : Math.Round(nodes.Average(n => n.probability), 2);

        return Ok(new
        {
            result.AssetId,
            result.Scenario,
            result.MaxDepth,
            result.AffectedTotal,
            result.AffectedByType,
            result.EstimatedOperationalImpact,
            result.Affected,
            estimatedFinancialImpactPerHour = perHour,
            worstCaseImpact = worstCase,
            expectedImpact = expected,
            maxRecoveryHours = maxRecovery,
            avgProbability,
            currency = "CAD",
            nodeDetails = nodes,
        });
    }
}
