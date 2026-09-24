using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Graph;
using Nexus.Risk;

namespace Nexus.Api.Controllers;

/// <summary>
/// Dépendance humaine (article 29) : la connaissance opérationnelle réellement
/// détenue par trop peu de personnes.
///
/// Cet écran restait VIDE sur des documents d'entreprise réels, pour deux
/// raisons qui n'avaient rien à voir avec les données.
///
/// 1. Il n'acceptait que KNOWS et MAINTAINS, avec la personne en SOURCE. Or un
///    référentiel d'entreprise n'écrit jamais « Samuel connaît le core banking » :
///    il écrit « l'unité informatique est responsable PER-006 » et « le core
///    banking appartient à l'unité informatique ». La personne est donc la CIBLE
///    du lien, et le rattachement passe par son unité.
/// 2. Le poste n'était pas exploité : chaque personne s'affichait comme
///    « Knowledge Holder », alors que le document dit « Responsable
///    informatique ». Un écran de dépendance humaine sans les métiers ne se lit
///    pas : c'est le poste qui dit si la personne est remplaçable.
///
/// On accepte donc les deux directions, les liens de responsabilité, et UN saut
/// par l'unité d'organisation. Chaque rattachement dit par quel lien il a été
/// établi : un rattachement indirect n'est pas présenté comme un fait direct.
/// </summary>
[Route("api/v1/human-dependencies")]
public sealed class HumanDependencyController(
    ITenantProvider tenantProvider,
    IGraphRepository repository) : NexusController(tenantProvider)
{
    private static readonly HashSet<string> DocRelations = new(StringComparer.OrdinalIgnoreCase) { "DOCUMENTED_BY" };

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var entities = await repository.GetEntitiesAsync(tenant, ct: ct);
        var relations = await repository.GetRelationsAsync(tenant, ct: ct);
        var byId = entities.ToDictionary(e => e.Id);


        var holds = HumanKnowledgeMap.Build(entities, relations);


        var knowersBySystem = holds
            .GroupBy(h => h.SystemId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.PersonId).Distinct().Count());

        var documented = relations.Where(r => DocRelations.Contains(r.Type)).Select(r => r.Source).ToHashSet();

        var people = holds
            .GroupBy(h => h.PersonId)
            .Select(g =>
            {
                var person = byId[g.Key];
                var systems = g.Where(x => byId.ContainsKey(x.SystemId)).Select(x => byId[x.SystemId]).ToList();
                var soleSystems = systems.Count(s => knowersBySystem.GetValueOrDefault(s.Id, 1) <= 1);
                var minBackup = systems.Count == 0 ? 0 : systems.Min(s => Math.Max(0, knowersBySystem.GetValueOrDefault(s.Id, 1) - 1));
                var documentedCount = systems.Count(s => documented.Contains(s.Id));
                var docPercent = systems.Count == 0 ? 0 : (int)Math.Round(100.0 * documentedCount / systems.Count);
                var risk = soleSystems > 0 ? "CRITICAL" : minBackup == 0 ? "HIGH" : "MODERATE";

                return new
                {
                    id = person.Id,
                    name = person.Name,
                    // Le POSTE, tel que le document l'écrit. À défaut seulement, le
                    // libellé générique : mieux vaut « Responsable informatique ».
                    role = HumanKnowledgeMap.Job(person.Description) ?? "Knowledge Holder",
                    knownSystems = systems.Select(s => s.Name).ToList(),
                    // Les systèmes AVEC leur identifiant : sans lui, l'écran ne peut
                    // que passer un nom là où une simulation attend un identifiant.
                    systems = systems.Select(s => new { s.Id, s.Name, s.Criticality }).ToList(),
                    criticalSystems = systems.Count(s => s.Criticality >= 80),
                    soleKnowledgeSystems = soleSystems,
                    backupExperts = minBackup,
                    riskLevel = risk,
                    documentationPercent = docPercent,
                    indirectSystems = g.Count(x => !x.Direct),
                };
            })
            .OrderByDescending(p => p.soleKnowledgeSystems)
            .ThenByDescending(p => p.criticalSystems)
            .ToList();

        var edges = holds
            .Where(h => byId.ContainsKey(h.PersonId) && byId.ContainsKey(h.SystemId))
            .Select(h => new
            {
                person = byId[h.PersonId].Name,
                system = byId[h.SystemId].Name,
                systemCritical = byId[h.SystemId].Criticality >= 80,
                relation = h.Via,
                direct = h.Direct,
            })
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
