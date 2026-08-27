using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Risk.Reporting;

namespace Nexus.Api.Controllers;

/// <summary>Synthèse organisationnelle pour le Command Center (articles 34, 40).</summary>
[Route("api/v1/overview")]
public sealed class OverviewController(
    ITenantProvider tenantProvider,
    ReportService reportService) : NexusController(tenantProvider)
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var r = await reportService.GenerateAsync(tenant, ct);
        var priority = BuildPriorityIntelligence(r);

        return Ok(new
        {
            organizationHealthScore = r.OrganizationHealthScore,
            entityCount = r.EntityCount,
            relationCount = r.RelationCount,
            criticalRiskCount = r.CriticalRiskCount,
            highRiskCount = r.HighRiskCount,
            criticalAssetCount = r.CriticalAssetCount,
            unknownDependencyCount = r.UndocumentedCount,
            spofCount = r.SpofCount,
            criticalSpofCount = r.CriticalSpofCount,
            supplierConcentrationPercent = r.SupplierConcentrationPercent,
            topSpofs = r.SinglePointsOfFailure.Take(8).Select(s => new
            {
                name = s.Name, entityType = s.EntityType, score = s.Score,
                directDependents = s.Dependents, blastRadius = s.BlastRadius,
            }),
            priorityIntelligence = priority,
        });
    }

    // Renvoie des codes + parametres ; la phrase lisible est composee cote
    // frontend dans la langue active (voir architecture i18n).
    private static List<object> BuildPriorityIntelligence(ExecutiveReport r)
    {
        var items = new List<object>();

        foreach (var s in r.SinglePointsOfFailure.Take(2))
            items.Add(new
            {
                severity = s.Score >= 80 ? "SEV_CRIT" : "SEV_HIGH",
                confidence = Math.Min(99, s.Score),
                code = "spof",
                name = s.Name,
                entityType = s.EntityType,
                count = s.Dependents,
                systems = Array.Empty<string>(),
            });

        var topSupplier = r.SupplierConcentration.FirstOrDefault();
        if (topSupplier is not null && topSupplier.DependentSystems >= 2)
            items.Add(new
            {
                severity = "SEV_HIGH",
                confidence = r.EntityCount == 0 ? 50 : Math.Min(99, 100 * topSupplier.DependentSystems / r.EntityCount + 40),
                code = "supplier",
                name = topSupplier.Name,
                entityType = "Supplier",
                count = topSupplier.DependentSystems,
                systems = Array.Empty<string>(),
            });

        var human = r.HumanDependencies.FirstOrDefault();
        if (human is not null)
            items.Add(new
            {
                severity = "SEV_HIGH",
                confidence = 87,
                code = "human",
                name = human.Person,
                entityType = "Person",
                count = human.KnownSystems.Count,
                systems = human.KnownSystems.ToArray(),
            });

        if (r.UndocumentedCount > 0)
            items.Add(new
            {
                severity = "SEV_WARN",
                confidence = 42,
                code = "undocumented",
                name = "",
                entityType = "",
                count = r.UndocumentedCount,
                systems = Array.Empty<string>(),
            });

        return items;
    }
}
