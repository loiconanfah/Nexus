using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Graph;
using Nexus.Risk;

namespace Nexus.Api.Controllers;

/// <summary>
/// Supplier Intelligence (article 29) : concentration et risque fournisseurs.
/// </summary>
[Route("api/v1/suppliers")]
public sealed class SuppliersController(
    ITenantProvider tenantProvider,
    IGraphRepository repository,
    IDependencyQueries queries,
    RiskAnalyzer riskAnalyzer) : NexusController(tenantProvider)
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var entities = await repository.GetEntitiesAsync(tenant, ct: ct);
        var entityCount = entities.Count;
        var suppliers = entities.Where(e => e.EntityType == "Supplier").ToList();

        // Nombre de fournisseurs dont dépend chaque actif (pour les alternatives).
        var supplierDependents = new Dictionary<string, List<Guid>>();

        var result = new List<dynamic>();
        var edges = new List<object>();

        foreach (var s in suppliers)
        {
            var dependents = await queries.GetDirectDependentsAsync(tenant, s.Id, ct);
            var blast = await queries.GetBlastRadiusAsync(tenant, s.Id, ct: ct);
            var risk = await riskAnalyzer.AssessEntityAsync(tenant, s.Id, ct: ct);

            foreach (var dep in dependents)
            {
                if (!supplierDependents.TryGetValue(dep.Name, out var list)) supplierDependents[dep.Name] = list = new();
                list.Add(s.Id);
                edges.Add(new { supplier = s.Name, asset = dep.Name, assetCritical = dep.Criticality >= 80 });
            }

            result.Add(new
            {
                id = s.Id,
                name = s.Name,
                riskScore = risk?.Assessment.Score ?? 0,
                riskBand = risk?.Assessment.Band.ToString() ?? "Low",
                criticalServices = dependents.Count(d => d.Criticality >= 80),
                dependencies = dependents.Count,
                connectedAssets = blast.Count,
                concentrationPercent = entityCount == 0 ? 0 : (int)Math.Round(100.0 * dependents.Count / entityCount),
                dependents = dependents.Select(d => d.Name).ToList(),
            });
        }

        var ordered = result.OrderByDescending(r => (double)r.riskScore).ToList();

        // Alternatives : nb d'autres fournisseurs partageant ≥1 actif dépendant.
        var withAlternatives = ordered.Select(r =>
        {
            var deps = ((List<string>)r.dependents);
            var others = deps
                .SelectMany(d => supplierDependents.GetValueOrDefault(d, new()))
                .Distinct()
                .Count(id => id != (Guid)r.id);
            return new
            {
                r.id, r.name, r.riskScore, r.riskBand, r.criticalServices, r.dependencies,
                r.connectedAssets, r.concentrationPercent, r.dependents, alternatives = others,
            };
        }).ToList();

        // Actifs dépendant d'un seul fournisseur (single dependency).
        var singleDeps = supplierDependents.Count(kv => kv.Value.Distinct().Count() == 1);

        return Ok(new
        {
            summary = new
            {
                criticalSuppliers = withAlternatives.Count(s => s.criticalServices > 0 || s.riskBand is "High" or "Critical"),
                singleDependencies = singleDeps,
                concentrationPercent = withAlternatives.Count == 0 ? 0 : withAlternatives.Max(s => s.concentrationPercent),
                contractsExpiring = entities.Count(e => e.EntityType == "Contract"),
            },
            suppliers = withAlternatives,
            edges,
        });
    }
}
