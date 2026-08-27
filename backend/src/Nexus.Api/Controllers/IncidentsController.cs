using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Risk.Reporting;

namespace Nexus.Api.Controllers;

/// <summary>
/// Incident Early-Warning Center (article 30) : scénarios d'incident PREDITS à
/// partir de la topologie — SPOF, risques majeurs, concentration fournisseurs et
/// dépendances humaines. NEXUS ne collecte pas d'incidents passés : il anticipe
/// les défaillances probables avant qu'elles ne surviennent.
/// </summary>
[Route("api/v1/incidents")]
public sealed class IncidentsController(
    ITenantProvider tenantProvider,
    ReportService reportService) : NexusController(tenantProvider)
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var r = await reportService.GenerateAsync(tenant, ct);
        var incidents = new List<object>();

        // 1. SPOF -> panne matérielle/logicielle probable, rayon d'impact connu.
        foreach (var s in r.SinglePointsOfFailure)
        {
            var sev = s.Score >= 80 ? "CRITICAL" : s.Score >= 60 ? "HIGH" : "MODERATE";
            incidents.Add(new
            {
                id = $"spof-{s.Name}",
                title = $"{s.Name} outage",
                category = "Single Point of Failure",
                severity = sev,
                probability = Math.Min(99, (int)s.Score),
                blastRadius = s.BlastRadius,
                affected = s.Dependents,
                entityType = s.EntityType,
                trigger = $"{s.Name} ({s.EntityType}) has {s.Dependents} dependent(s) and no redundancy.",
                recommendation = s.HasRedundancy
                    ? "Validate failover paths and RTO."
                    : $"Introduce redundancy for {s.Name} to remove this single point of failure.",
            });
        }

        // 2. Concentration fournisseur -> panne fournisseur.
        foreach (var sup in r.SupplierConcentration.Where(x => x.DependentSystems >= 1))
        {
            incidents.Add(new
            {
                id = $"supplier-{sup.Name}",
                title = $"{sup.Name} service disruption",
                category = "Supplier Failure",
                severity = sup.DependentSystems >= 2 ? "HIGH" : "MODERATE",
                probability = Math.Min(90, 40 + 15 * sup.DependentSystems),
                blastRadius = sup.DependentSystems,
                affected = sup.DependentSystems,
                entityType = "Supplier",
                trigger = $"{sup.Name} supports {sup.DependentSystems} system(s): {string.Join(", ", sup.Dependents)}.",
                recommendation = $"Identify an alternative supplier for {sup.Name} and formalise SLAs.",
            });
        }

        // 3. Dependance humaine -> perte de savoir (employee loss).
        foreach (var h in r.HumanDependencies)
        {
            incidents.Add(new
            {
                id = $"human-{h.Person}",
                title = $"Knowledge loss — {h.Person} unavailable",
                category = "Human Dependency",
                severity = h.KnownSystems.Count >= 2 ? "HIGH" : "MODERATE",
                probability = 55,
                blastRadius = h.KnownSystems.Count,
                affected = h.KnownSystems.Count,
                entityType = "Person",
                trigger = $"{h.Person} is the sole knowledge holder for {string.Join(", ", h.KnownSystems)}.",
                recommendation = $"Document {string.Join(", ", h.KnownSystems)} and cross-train a backup expert.",
            });
        }

        var ordered = incidents
            .OrderByDescending(i => SevRank((string)((dynamic)i).severity))
            .ThenByDescending(i => (int)((dynamic)i).probability)
            .ToList();

        return Ok(new
        {
            summary = new
            {
                total = ordered.Count,
                critical = ordered.Count(i => (string)((dynamic)i).severity == "CRITICAL"),
                high = ordered.Count(i => (string)((dynamic)i).severity == "HIGH"),
                topBlastRadius = ordered.Count == 0 ? 0 : ordered.Max(i => (int)((dynamic)i).blastRadius),
                healthScore = r.OrganizationHealthScore,
            },
            incidents = ordered,
        });
    }

    private static int SevRank(string s) => s switch
    {
        "CRITICAL" => 3,
        "HIGH" => 2,
        "MODERATE" => 1,
        _ => 0,
    };
}
