using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Risk.Reporting;

namespace Nexus.Api.Controllers;

/// <summary>
/// Incident Early-Warning Center (article 30) : scenarios d'incident PREDITS a
/// partir de la topologie — SPOF, risques majeurs, concentration fournisseurs et
/// dependances humaines. Le controleur renvoie des DONNEES STRUCTUREES (faits +
/// codes) ; la phrase lisible est composee cote frontend dans la langue choisie.
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

        // 1. SPOF -> panne materielle/logicielle probable, rayon d'impact connu.
        foreach (var s in r.SinglePointsOfFailure)
        {
            var sev = s.Score >= 80 ? "CRITICAL" : s.Score >= 60 ? "HIGH" : "MODERATE";
            incidents.Add(new
            {
                id = $"spof-{s.Name}",
                category = "spof",
                severity = sev,
                probability = Math.Min(99, (int)s.Score),
                blastRadius = s.BlastRadius,
                affected = s.Dependents,
                entityName = s.Name,
                entityType = s.EntityType,
                dependents = s.Dependents,
                hasRedundancy = s.HasRedundancy,
                systems = Array.Empty<string>(),
            });
        }

        // 2. Concentration fournisseur -> panne fournisseur.
        foreach (var sup in r.SupplierConcentration.Where(x => x.DependentSystems >= 1))
        {
            incidents.Add(new
            {
                id = $"supplier-{sup.Name}",
                category = "supplier",
                severity = sup.DependentSystems >= 2 ? "HIGH" : "MODERATE",
                probability = Math.Min(90, 40 + 15 * sup.DependentSystems),
                blastRadius = sup.DependentSystems,
                affected = sup.DependentSystems,
                entityName = sup.Name,
                entityType = "Supplier",
                dependents = sup.DependentSystems,
                hasRedundancy = false,
                systems = sup.Dependents.ToArray(),
            });
        }

        // 3. Dependance humaine -> perte de savoir (employee loss).
        foreach (var h in r.HumanDependencies)
        {
            incidents.Add(new
            {
                id = $"human-{h.Person}",
                category = "human",
                severity = h.KnownSystems.Count >= 2 ? "HIGH" : "MODERATE",
                probability = 55,
                blastRadius = h.KnownSystems.Count,
                affected = h.KnownSystems.Count,
                entityName = h.Person,
                entityType = "Person",
                dependents = h.KnownSystems.Count,
                hasRedundancy = false,
                systems = h.KnownSystems.ToArray(),
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
