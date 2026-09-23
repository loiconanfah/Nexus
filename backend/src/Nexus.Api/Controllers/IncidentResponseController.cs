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
/// Mode incident : « ce système est tombé », et tout ce qu'il faut savoir dans
/// les trois minutes qui suivent.
///
/// C'est le moment où la cartographie vaut le plus cher, et c'est précisément
/// celui où personne n'a le temps de naviguer dans six écrans. Une seule
/// réponse, dans l'ordre où les questions se posent vraiment : qu'est-ce qui
/// tombe avec, combien ça coûte par heure, qui j'appelle, qu'est-ce qui prend
/// le relais, que dit le plan.
///
/// Rien n'est calculé ici : la cascade vient du moteur de propagation, le coût
/// du modèle d'impact, et les personnes, les secours et les plans sont LUS dans
/// le graphe. Aucun appel à un modèle : un incident ne s'accommode ni d'une
/// latence ni d'une approximation.
/// </summary>
[Route("api/v1/incident")]
public sealed class IncidentResponseController(
    ITenantProvider tenantProvider,
    PropagationEngine propagation,
    IGraphRepository graph,
    ImpactConfigStore impactConfig,
    OrganizationStore organization) : NexusController(tenantProvider)
{
    /// <summary>Qui prévenir : les liens qui désignent une personne responsable.</summary>
    private static readonly HashSet<string> PeopleLinks = new(StringComparer.Ordinal)
    {
        "MANAGED_BY", "RESPONSIBLE_FOR", "MAINTAINS", "KNOWS", "OWNED_BY", "OPERATED_BY",
    };

    private static readonly HashSet<string> PeopleTypes = new(StringComparer.Ordinal)
    {
        "Person", "Role", "Team", "BusinessUnit",
    };

    /// <summary>Ce qui documente la conduite à tenir.</summary>
    private static readonly HashSet<string> PlanLinks = new(StringComparer.Ordinal)
    {
        "PROTECTS", "RECOVERS_WITH", "DOCUMENTED_BY",
    };

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, [FromQuery] int depth, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var fallen = await graph.GetEntityAsync(tenant, id, ct);
        if (fallen is null) return NotFound(new { error = "entity_not_found" });

        var result = await propagation.SimulateFailureAsync(tenant, id, ScenarioType.ServerFailure,
            maxDepth: Math.Clamp(depth == 0 ? 4 : depth, 1, 10), ct);
        var tuning = await impactConfig.GetEffectiveAsync(tenant, ct);

        var entities = await graph.GetEntitiesAsync(tenant, ct: ct);
        var edges = await graph.GetRelationsAsync(tenant, ct: ct);
        var byId = entities.ToDictionary(e => e.Id);

        // Le périmètre touché : l'élément tombé et tout ce que la cascade atteint.
        var scope = new HashSet<Guid> { id };
        foreach (var a in result.Affected) scope.Add(a.Entity.Id);

        var perHour = result.Affected
            .Sum(a => (double)BusinessImpactModel.CostPerHour(a.Entity.Criticality, a.Entity.CostPerHour, tuning))
            + (double)BusinessImpactModel.CostPerHour(fallen.Criticality, fallen.CostPerHour, tuning);

        // Qui appeler, et qui le remplace s'il n'est pas joignable. Le suppléant
        // est la moitié la plus souvent oubliée d'un annuaire de crise.
        var backups = edges
            .Where(e => e.Type == "BACKED_UP_BY")
            .GroupBy(e => e.Source)
            .ToDictionary(g => g.Key, g => g.Select(e => byId.GetValueOrDefault(e.Target)?.Name).OfType<string>().ToList());

        var people = edges
            .Where(e => PeopleLinks.Contains(e.Type) && scope.Contains(e.Source))
            .Select(e => new { Edge = e, Target = byId.GetValueOrDefault(e.Target), Via = byId.GetValueOrDefault(e.Source) })
            .Where(x => x.Target is not null && x.Via is not null && PeopleTypes.Contains(x.Target!.EntityType))
            .GroupBy(x => x.Target!.Id)
            .Select(g => new
            {
                id = g.Key,
                name = g.First().Target!.Name,
                type = g.First().Target!.EntityType,
                role = g.First().Target!.Description,
                via = g.Select(x => x.Via!.Name).Distinct().Take(3).ToList(),
                link = g.First().Edge.Type,
                backup = backups.GetValueOrDefault(g.Key) ?? [],
            })
            .Take(12)
            .ToList();

        // Ce qui prend le relais. L'absence de secours est une réponse en soi,
        // et c'est celle qu'il vaut mieux connaître avant la panne.
        var alternatives = edges
            .Where(e => e.Type == "BACKED_UP_BY" && e.Source == id)
            .Select(e => byId.GetValueOrDefault(e.Target))
            .OfType<GraphEntityRecord>()
            .Select(e => new { e.Id, e.Name, e.EntityType })
            .ToList();

        // Ce que dit le plan : plans de continuité, de reprise, contrôles.
        var plans = edges
            .Where(e => PlanLinks.Contains(e.Type) && (scope.Contains(e.Target) || scope.Contains(e.Source)))
            .Select(e => scope.Contains(e.Target) ? byId.GetValueOrDefault(e.Source) : byId.GetValueOrDefault(e.Target))
            .OfType<GraphEntityRecord>()
            .Where(e => e.EntityType is "Document" or "Control" or "Policy")
            .DistinctBy(e => e.Id)
            .Select(e => new { e.Id, e.Name, e.EntityType, e.Description })
            .Take(8)
            .ToList();

        // Les fournisseurs du périmètre : les appels à passer hors de la maison.
        var suppliers = edges
            .Where(e => e.Type == "SUPPLIED_BY" && scope.Contains(e.Source))
            .Select(e => byId.GetValueOrDefault(e.Target))
            .OfType<GraphEntityRecord>()
            .DistinctBy(e => e.Id)
            .Select(e => new { e.Id, e.Name, e.Description })
            .Take(8)
            .ToList();

        var top = result.Affected
            .OrderByDescending(a => a.Entity.Criticality)
            .Take(12)
            .Select(a => new
            {
                a.Entity.Id,
                a.Entity.Name,
                type = a.Entity.EntityType,
                a.Entity.Criticality,
                a.Depth,
                hourlyCost = BusinessImpactModel.CostPerHour(a.Entity.Criticality, a.Entity.CostPerHour, tuning),
            })
            .ToList();

        return Ok(new
        {
            entity = new { fallen.Id, fallen.Name, type = fallen.EntityType, fallen.Criticality, fallen.Description },
            affectedCount = result.AffectedTotal,
            estimatedHourlyCost = (long)Math.Round(perHour),
            currency = await organization.CurrencyAsync(tenant, ct),
            top,
            people,
            alternatives,
            plans,
            suppliers,
        });
    }
}
