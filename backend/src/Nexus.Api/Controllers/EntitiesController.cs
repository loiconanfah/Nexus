using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Domain.Ontology;
using Nexus.Graph;
using Nexus.Risk;
using Nexus.Risk.Scoring;

namespace Nexus.Api.Controllers;

/// <summary>Accès aux entités du graphe, à leurs dépendances et à leur risque.</summary>
[Route("api/v1/entities")]
public sealed class EntitiesController(
    ITenantProvider tenantProvider,
    IGraphRepository repository,
    IDependencyQueries queries,
    IEntityResolver resolver,
    RiskAnalyzer riskAnalyzer) : NexusController(tenantProvider)
{
    /// <summary>Liste les entités du tenant.</summary>
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return Ok(await repository.GetEntitiesAsync(tenant, ct: ct));
    }

    /// <summary>Supprime définitivement une entité (et ses relations) du tenant.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var deleted = await repository.DeleteEntityAsync(tenant, id, ct);
        return deleted ? NoContent() : NotFound(new { error = "entity_not_found" });
    }

    /// <summary>Liste les actifs « mis de côté » (désinstallés), réactivables.</summary>
    [HttpGet("archived")]
    public async Task<IActionResult> Archived(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return Ok(await repository.GetArchivedEntitiesAsync(tenant, ct: ct));
    }

    /// <summary>Met un actif de côté (« désinstalle ») : conservé mais exclu de l'impact, réactivable.</summary>
    [HttpPost("{id:guid}/decommission")]
    public async Task<IActionResult> Decommission(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var ok = await repository.DecommissionEntityAsync(tenant, id, ct);
        return ok ? NoContent() : NotFound(new { error = "entity_not_found" });
    }

    /// <summary>Réactive un actif mis de côté.</summary>
    [HttpPost("{id:guid}/reactivate")]
    public async Task<IActionResult> Reactivate(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var ok = await repository.ReactivateEntityAsync(tenant, id, ct);
        return ok ? NoContent() : NotFound(new { error = "entity_not_found" });
    }

    public sealed record SetCostRequest(double? CostPerHour);

    /// <summary>Définit le coût d'arrêt réel par heure (null / ≤ 0 = revenir à l'estimation par criticité).</summary>
    [HttpPatch("{id:guid}/cost")]
    public async Task<IActionResult> SetCost(Guid id, [FromBody] SetCostRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var ok = await repository.SetCostPerHourAsync(tenant, id, req?.CostPerHour, ct);
        return ok ? NoContent() : NotFound(new { error = "entity_not_found" });
    }

    /// <summary>Résout une entité par nom exact (+ type), ou renvoie des suggestions floues.</summary>
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string name, [FromQuery] string type, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var typeResult = EntityType.FromName(type ?? "");
        if (typeResult.IsFailure) return ToProblem(typeResult.Error);
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("name requis.");

        var id = await resolver.FindExistingAsync(tenant, typeResult.Value, name, [], ct);
        if (id is null)
        {
            return Ok(new { match = (object?)null, suggestions = await resolver.FindSimilarAsync(tenant, name, ct: ct) });
        }

        return Ok(new { match = await repository.GetEntityAsync(tenant, id.Value, ct) });
    }

    /// <summary>Détail d'une entité.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var entity = await repository.GetEntityAsync(tenant, id, ct);
        return entity is null ? NotFound() : Ok(entity);
    }

    /// <summary>Dépendances directes (ce dont dépend l'entité), avec confiance et statut.</summary>
    [HttpGet("{id:guid}/dependencies")]
    public async Task<IActionResult> Dependencies(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return Ok(await repository.GetDirectDependenciesAsync(tenant, id, ct));
    }

    /// <summary>Dépendants directs (ce qui dépend de l'entité).</summary>
    [HttpGet("{id:guid}/dependents")]
    public async Task<IActionResult> Dependents(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return Ok(await queries.GetDirectDependentsAsync(tenant, id, ct));
    }

    /// <summary>Évaluation de risque explicable de l'entité (score, bande, décomposition).</summary>
    [HttpGet("{id:guid}/risk")]
    public async Task<IActionResult> Risk(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var risk = await riskAnalyzer.AssessEntityAsync(tenant, id, weights: RiskWeights.Default, ct: ct);
        return risk is null ? NotFound() : Ok(risk);
    }
}
