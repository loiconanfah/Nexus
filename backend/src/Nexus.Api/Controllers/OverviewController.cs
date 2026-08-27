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

    private static List<object> BuildPriorityIntelligence(ExecutiveReport r)
    {
        var items = new List<object>();

        foreach (var s in r.SinglePointsOfFailure.Take(2))
            items.Add(new
            {
                severity = s.Score >= 80 ? "SEV_CRIT" : "SEV_HIGH",
                confidence = Math.Min(99, s.Score),
                text = $"{s.Name} ({s.EntityType}) is a single point of failure — {s.Dependents} asset(s) depend on it with no redundancy.",
            });

        var topSupplier = r.SupplierConcentration.FirstOrDefault();
        if (topSupplier is not null && topSupplier.DependentSystems >= 2)
            items.Add(new
            {
                severity = "SEV_HIGH",
                confidence = r.EntityCount == 0 ? 50 : Math.Min(99, 100 * topSupplier.DependentSystems / r.EntityCount + 40),
                text = $"Supplier '{topSupplier.Name}' supports {topSupplier.DependentSystems} critical system(s) — concentration risk.",
            });

        var human = r.HumanDependencies.FirstOrDefault();
        if (human is not null)
            items.Add(new
            {
                severity = "SEV_HIGH",
                confidence = 87,
                text = $"{human.Person} holds critical knowledge concentration for {string.Join(", ", human.KnownSystems)}.",
            });

        if (r.UndocumentedCount > 0)
            items.Add(new
            {
                severity = "SEV_WARN",
                confidence = 42,
                text = $"{r.UndocumentedCount} mapped dependency(ies) have low confidence scores based on recent scan data.",
            });

        return items;
    }
}
