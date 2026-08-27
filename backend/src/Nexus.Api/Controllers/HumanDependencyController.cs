using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Graph;

namespace Nexus.Api.Controllers;

/// <summary>
/// Human Dependency Engine (article 28) : identifie la connaissance critique
/// détenue par trop peu de personnes (relations KNOWS / MAINTAINS).
/// </summary>
[Route("api/v1/human-dependencies")]
public sealed class HumanDependencyController(
    ITenantProvider tenantProvider,
    IGraphRepository repository) : NexusController(tenantProvider)
{
    private static readonly HashSet<string> HumanRelations = new(StringComparer.OrdinalIgnoreCase) { "KNOWS", "MAINTAINS" };
    private static readonly HashSet<string> DocRelations = new(StringComparer.OrdinalIgnoreCase) { "DOCUMENTED_BY" };

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var entities = await repository.GetEntitiesAsync(tenant, ct: ct);
        var relations = await repository.GetRelationsAsync(tenant, ct: ct);
        var byId = entities.ToDictionary(e => e.Id);

        // Relations de connaissance humaine dont la source est une Person.
        var humanRels = relations
            .Where(r => HumanRelations.Contains(r.Type) && byId.TryGetValue(r.Source, out var p) && p.EntityType == "Person")
            .ToList();

        // Combien de personnes connaissent chaque système.
        var knowersBySystem = humanRels
            .GroupBy(r => r.Target)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Source).Distinct().Count());

        // Systèmes documentés (DOCUMENTED_BY sortant).
        var documented = relations.Where(r => DocRelations.Contains(r.Type)).Select(r => r.Source).ToHashSet();

        var people = humanRels
            .GroupBy(r => r.Source)
            .Select(g =>
            {
                var person = byId[g.Key];
                var systems = g.Where(x => byId.ContainsKey(x.Target)).Select(x => byId[x.Target]).ToList();
                var soleSystems = systems.Count(s => knowersBySystem.GetValueOrDefault(s.Id, 1) <= 1);
                var minBackup = systems.Count == 0 ? 0 : systems.Min(s => Math.Max(0, knowersBySystem.GetValueOrDefault(s.Id, 1) - 1));
                var documentedCount = systems.Count(s => documented.Contains(s.Id));
                var docPercent = systems.Count == 0 ? 0 : (int)Math.Round(100.0 * documentedCount / systems.Count);
                var risk = soleSystems > 0 ? "CRITICAL" : minBackup == 0 ? "HIGH" : "MODERATE";

                return new
                {
                    id = person.Id,
                    name = person.Name,
                    role = "Knowledge Holder",
                    knownSystems = systems.Select(s => s.Name).ToList(),
                    criticalSystems = systems.Count(s => s.Criticality >= 80),
                    soleKnowledgeSystems = soleSystems,
                    backupExperts = minBackup,
                    riskLevel = risk,
                    documentationPercent = docPercent,
                };
            })
            .OrderByDescending(p => p.soleKnowledgeSystems)
            .ThenByDescending(p => p.criticalSystems)
            .ToList();

        var edges = humanRels
            .Where(r => byId.ContainsKey(r.Source) && byId.ContainsKey(r.Target))
            .Select(r => new { person = byId[r.Source].Name, system = byId[r.Target].Name, systemCritical = byId[r.Target].Criticality >= 80, relation = r.Type })
            .ToList();

        return Ok(new
        {
            summary = new
            {
                criticalKnowledgeAreas = knowersBySystem.Count(kv => kv.Value <= 1),
                singleKnowledgeOwners = people.Count(p => p.soleKnowledgeSystems > 0),
                undocumentedProcesses = knowersBySystem.Keys.Count(s => !documented.Contains(s)),
                keyDependencyEmployees = people.Count,
            },
            people,
            edges,
        });
    }
}
