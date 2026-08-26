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
