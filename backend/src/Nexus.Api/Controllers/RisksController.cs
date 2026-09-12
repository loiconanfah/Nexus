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

    /// <summary>Nombre d'évaluations menées de front (borne la charge sur Neo4j).</summary>
    private const int MaxConcurrentAssessments = 12;

    /// <summary>Ligne du Risk Center.</summary>
    private sealed record RiskRow(
        Guid Id, string Name, string EntityType, double Score, string Band,
        int EffectiveCriticality, int DirectDependents, int BlastRadius, bool HasRedundancy);

    /// <summary>Toutes les entités classées par risque (Risk Center, article 37).</summary>
    [HttpGet("entities")]
    public async Task<IActionResult> Entities(CancellationToken ct = default)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var entities = await repository.GetEntitiesAsync(tenant, ct: ct);

        // Évaluer le risque d'un actif demande plusieurs requêtes Neo4j (dépendants,
        // rayon d'impact, redondance). En séquentiel, le temps croît linéairement
        // avec le parc : ~5 s pour 119 actifs, plus d'une minute pour 2 000 — la
        // page devient inutilisable. Le pilote Neo4j ouvrant une session par
        // requête, on borne la concurrence au lieu de sérialiser.
        using var gate = new SemaphoreSlim(MaxConcurrentAssessments);
        var assessed = await Task.WhenAll(entities.Select(async entity =>
        {
            await gate.WaitAsync(ct);
            try
            {
                var risk = await riskAnalyzer.AssessEntityAsync(tenant, entity.Id, ct: ct);
                return risk is null ? null : new RiskRow(
                    entity.Id, entity.Name, entity.EntityType,
                    risk.Assessment.Score, risk.Assessment.Band.ToString(),
                    risk.EffectiveCriticality, risk.DirectDependents,
                    risk.BlastRadius, risk.HasRedundancy);
            }
            finally { gate.Release(); }
        }));

        return Ok(assessed.Where(r => r is not null).OrderByDescending(r => r!.Score));
    }
}
