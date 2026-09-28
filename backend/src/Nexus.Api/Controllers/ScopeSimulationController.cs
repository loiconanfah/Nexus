using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Impact;
using Nexus.Api.Organization;
using Nexus.Api.Tenancy;
using Nexus.Domain.Ontology;
using Nexus.Graph;
using Nexus.Risk;
using Nexus.Risk.Propagation;

namespace Nexus.Api.Controllers;

/// <summary>
/// Simuler un PÉRIMÈTRE plutôt qu'un actif.
///
/// Une simulation ne portait que sur un élément à la fois : pour savoir lequel
/// d'un ensemble fait le plus de dégâts, il fallait les essayer un par un et
/// tenir le score de tête. Avec un graphe personnalisé enregistré, la question
/// naturelle devient « dans CE périmètre, quelle panne coûte le plus cher »,
/// et elle se répond en une fois.
///
/// Chaque élément du périmètre est mis en panne à son tour, isolément : ce n'est
/// pas un scénario où tout tombe ensemble, mais un classement des pires cas
/// individuels. Le nombre d'éléments est borné, parce que chaque simulation
/// interroge le graphe et qu'un périmètre de deux mille actifs rendrait l'écran
/// inutilisable sans rien apprendre de plus.
/// </summary>
[Route("api/v1/simulations")]
public sealed class ScopeSimulationController(
    ITenantProvider tenantProvider,
    PropagationEngine propagation,
    IGraphRepository graph,
    ImpactConfigStore impactConfig,
    OrganizationStore organization) : NexusController(tenantProvider)
{
    private const int MaxEntities = 25;
    private const int MaxConcurrency = 4;

    public sealed record ScopeRequest(List<Guid>? EntityIds, string? Name, int? Depth);

    [HttpPost("scope")]
    public async Task<IActionResult> Scope([FromBody] ScopeRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var ids = (req?.EntityIds ?? []).Where(id => id != Guid.Empty).Distinct().ToList();
        if (ids.Count == 0) return BadRequest(new { error = "scope_required" });

        var entities = await graph.GetEntitiesAsync(tenant, ct: ct);
        var byId = entities.ToDictionary(e => e.Id);
        var tuning = await impactConfig.GetEffectiveAsync(tenant, ct);
        var depth = Math.Clamp(req?.Depth ?? 4, 1, 10);

        // Les plus critiques d'abord : si le périmètre dépasse le plafond, c'est
        // sur eux que la question porte.
        var targets = ids
            .Where(byId.ContainsKey)
            .OrderByDescending(id => byId[id].Criticality)
            .Take(MaxEntities)
            .ToList();

        using var gate = new SemaphoreSlim(MaxConcurrency);
        var results = await Task.WhenAll(targets.Select(async id =>
        {
            await gate.WaitAsync(ct);
            try
            {
                var entity = byId[id];
                var r = await propagation.SimulateFailureAsync(tenant, id, ScenarioType.ServerFailure, depth, ct);
                var perHour = r.Affected
                    .Sum(a => (double)BusinessImpactModel.CostPerHour(a.Entity.Criticality, a.Entity.CostPerHour, tuning))
                    + (double)BusinessImpactModel.CostPerHour(entity.Criticality, entity.CostPerHour, tuning);
                var worst = r.Affected.Sum(a =>
                    (double)BusinessImpactModel.CostPerHour(a.Entity.Criticality, a.Entity.CostPerHour, tuning)
                    * BusinessImpactModel.RtoHours(a.Entity.EntityType, a.Entity.Criticality, tuning));

                return new
                {
                    id,
                    name = entity.Name,
                    type = entity.EntityType,
                    entity.Criticality,
                    affected = r.AffectedTotal,
                    hourlyCost = (long)Math.Round(perHour),
                    worstCaseCost = (long)Math.Round(worst),
                    // Les trois éléments touchés les plus critiques : de quoi
                    // comprendre le classement sans ouvrir chaque simulation.
                    top = r.Affected
                        .OrderByDescending(a => a.Entity.Criticality)
                        .Take(3)
                        .Select(a => a.Entity.Name)
                        .ToList(),
                };
            }
            finally { gate.Release(); }
        }));

        var ranked = results.OrderByDescending(x => x.hourlyCost).ToList();
        return Ok(new
        {
            name = string.IsNullOrWhiteSpace(req?.Name) ? null : req!.Name!.Trim(),
            requested = ids.Count,
            simulated = ranked.Count,
            truncated = ids.Count > ranked.Count,
            currency = await organization.CurrencyAsync(tenant, ct),
            totalHourlyCost = ranked.Sum(x => x.hourlyCost),
            results = ranked,
        });
    }
}
