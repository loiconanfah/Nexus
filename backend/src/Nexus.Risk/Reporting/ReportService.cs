using Nexus.Graph;
using Nexus.Risk.Spof;

namespace Nexus.Risk.Reporting;

/// <summary>
/// Construit le rapport exécutif de résilience à partir des moteurs
/// déterministes (article 40). Entièrement traçable : chaque chiffre provient
/// du graphe et des évaluations de risque.
/// </summary>
public sealed class ReportService(
    IGraphStats stats,
    IGraphRepository repository,
    IDependencyQueries queries,
    RiskAnalyzer riskAnalyzer,
    SpofAnalyzer spofAnalyzer)
{
    private static readonly HashSet<string> HumanRelations = new(StringComparer.OrdinalIgnoreCase) { "KNOWS", "MAINTAINS" };

    public async Task<ExecutiveReport> GenerateAsync(Guid tenantId, CancellationToken ct = default)
    {
        var graph = await stats.GetStatsAsync(tenantId, ct);
        var entities = await repository.GetEntitiesAsync(tenantId, ct: ct);
        var relations = await repository.GetRelationsAsync(tenantId, ct: ct);
        var byId = entities.ToDictionary(e => e.Id);
        var spofs = await spofAnalyzer.AnalyzeAsync(tenantId, limit: 15, ct: ct);

        // Risques par entité.
        var risks = new List<ReportRiskItem>();
        foreach (var e in entities)
        {
            var r = await riskAnalyzer.AssessEntityAsync(tenantId, e.Id, ct: ct);
            if (r is not null)
                risks.Add(new ReportRiskItem(e.Name, e.EntityType, r.Assessment.Score, r.Assessment.Band.ToString(),
                    r.DirectDependents, r.BlastRadius, r.HasRedundancy));
        }
        var topRisks = risks.OrderByDescending(r => r.Score).Take(8).ToList();

        var spofItems = spofs.Take(10).Select(s => new ReportRiskItem(
            s.Entity.Name, s.Entity.EntityType, s.Score, "—", s.DirectDependents, s.BlastRadius, false)).ToList();

        // Concentration fournisseurs.
        var suppliers = new List<ReportSupplier>();
        foreach (var s in entities.Where(e => e.EntityType == "Supplier"))
        {
            var deps = await queries.GetDirectDependentsAsync(tenantId, s.Id, ct);
            if (deps.Count > 0)
                suppliers.Add(new ReportSupplier(s.Name, deps.Count, deps.Select(d => d.Name).ToList()));
        }
        suppliers = suppliers.OrderByDescending(s => s.DependentSystems).ToList();

        // Dépendances humaines (KNOWS / MAINTAINS depuis une Person).
        var humanByPerson = relations
            .Where(e => HumanRelations.Contains(e.Type) && byId.TryGetValue(e.Source, out var p) && p.EntityType == "Person")
            .GroupBy(e => e.Source)
            .Select(g => new ReportHumanDependency(
                byId[g.Key].Name,
                g.Where(e => byId.ContainsKey(e.Target)).Select(e => byId[e.Target].Name).Distinct().ToList()))
            .ToList();

        // Dépendances non documentées / incertaines.
        var undocumented = relations
            .Where(e => e.Status is "Unknown" or "AiSuggested" || e.Confidence < 0.5)
            .Select(e => new ReportUndocumented(
                byId.TryGetValue(e.Source, out var sv) ? sv.Name : e.Source.ToString(),
                byId.TryGetValue(e.Target, out var tv) ? tv.Name : e.Target.ToString(),
                e.Type, e.Confidence, e.Status))
            .ToList();

        var health = ComputeHealth(spofs);
        var recommendations = BuildRecommendations(spofs, suppliers, humanByPerson, undocumented);

        return new ExecutiveReport(
            DateTimeOffset.UtcNow, health, graph.EntityCount, graph.RelationCount,
            spofs.Count, spofs.Count(s => s.Score >= 80),
            topRisks, spofItems, suppliers, humanByPerson, undocumented, recommendations);
    }

    private static int ComputeHealth(IReadOnlyList<SpofResult> spofs)
    {
        var top = spofs.Take(5).ToList();
        var avg = top.Count == 0 ? 0 : top.Average(s => s.Score);
        return (int)Math.Clamp(100 - avg * 0.6, 0, 100);
    }

    private static List<ReportRecommendation> BuildRecommendations(
        IReadOnlyList<SpofResult> spofs,
        IReadOnlyList<ReportSupplier> suppliers,
        IReadOnlyList<ReportHumanDependency> human,
        IReadOnlyList<ReportUndocumented> undocumented)
    {
        var recs = new List<ReportRecommendation>();

        foreach (var s in spofs.Where(s => s.Score >= 60).Take(3))
            recs.Add(new ReportRecommendation("Élevée",
                $"Ajouter une redondance à {s.Entity.Name}",
                $"{s.DirectDependents} actif(s) en dépendent sans reprise (portée {s.BlastRadius}). Une redondance réduit fortement le risque de rupture."));

        foreach (var sup in suppliers.Where(s => s.DependentSystems >= 2).Take(2))
            recs.Add(new ReportRecommendation("Moyenne",
                $"Réduire la concentration sur le fournisseur {sup.Name}",
                $"{sup.DependentSystems} système(s) en dépendent. Évaluer une alternative ou un plan de bascule."));

        foreach (var h in human.Take(2))
            recs.Add(new ReportRecommendation("Moyenne",
                $"Documenter la connaissance détenue par {h.Person}",
                $"Connaissance unique sur : {string.Join(", ", h.KnownSystems)}. Formaliser la documentation et former une seconde personne."));

        if (undocumented.Count > 0)
            recs.Add(new ReportRecommendation("Faible",
                $"Valider {undocumented.Count} dépendance(s) incertaine(s)",
                "Faire confirmer par un responsable pour fiabiliser l'analyse de risque."));

        return recs;
    }
}
