using System.Text;
using Nexus.Graph;
using Nexus.Risk;
using Nexus.Risk.Propagation;
using Nexus.Risk.Spof;

namespace Nexus.AI;

/// <summary>
/// AI Analyst (articles 19-22). Détecte l'intention, rassemble un contexte
/// STRUCTURÉ depuis les moteurs déterministes, construit une réponse ancrée
/// (evidence + confiance + sources) puis, si un LLM est configuré, la reformule
/// sans jamais s'écarter du contexte. Ne raisonne pas seul, n'invente pas.
/// </summary>
public sealed class AiOrchestrator(
    IGraphRepository repository,
    IDependencyQueries queries,
    RiskAnalyzer riskAnalyzer,
    SpofAnalyzer spofAnalyzer,
    PropagationEngine propagation,
    IChatCompletion chat)
{
    public async Task<AiAnswer> AskAsync(Guid tenantId, string question, CancellationToken ct = default)
    {
        var q = (question ?? string.Empty).Trim();
        var lower = q.ToLowerInvariant();
        var intent = DetectIntent(lower);
        var entities = await repository.GetEntitiesAsync(tenantId, ct: ct);
        var mentioned = FindMentioned(lower, entities);

        var answer = intent switch
        {
            AiIntent.SinglePointsOfFailure => await SpofAnswer(tenantId, q, ct),
            AiIntent.TopRisks => await TopRisksAnswer(tenantId, q, entities, ct),
            AiIntent.ExplainCriticality => await ExplainAnswer(tenantId, q, mentioned, ct),
            AiIntent.SimulateFailure => await SimulateAnswer(tenantId, q, mentioned, ct),
            AiIntent.UndocumentedDependencies => await UndocumentedAnswer(tenantId, q, entities, ct),
            _ => await OverviewAnswer(tenantId, q, entities, ct),
        };

        return await Naturalize(answer, ct);
    }

    // ---------- Détection ----------
    private static AiIntent DetectIntent(string q)
    {
        bool Has(params string[] terms) => terms.Any(q.Contains);

        if (Has("spof", "single point", "point de défaillance", "point unique", "défaillance unique"))
            return AiIntent.SinglePointsOfFailure;
        if (Has("non documenté", "non documentée", "undocumented", "inconnue", "unknown", "mal documenté"))
            return AiIntent.UndocumentedDependencies;
        if ((Has("si ") && Has("tombe", "panne", "indisponible", "échoue")) || Has("what happens if", "que se passe", "what if"))
            return AiIntent.SimulateFailure;
        if (Has("pourquoi", "why") && Has("critique", "critical", "important"))
            return AiIntent.ExplainCriticality;
        if (Has("risque", "risk") && Has("plus grand", "biggest", "top", "principaux", "majeurs", "importants", "prioritaire"))
            return AiIntent.TopRisks;
        if (Has("risque", "risk"))
            return AiIntent.TopRisks;
        return AiIntent.Overview;
    }

    private static GraphEntityRecord? FindMentioned(string q, IReadOnlyList<GraphEntityRecord> entities)
    {
        // Correspondance sur le nom ou un alias, la plus longue d'abord (évite les sous-chaînes).
        return entities
            .Where(e => q.Contains(e.Name.ToLowerInvariant()) || e.Aliases.Any(a => q.Contains(a.ToLowerInvariant())))
            .OrderByDescending(e => e.Name.Length)
            .FirstOrDefault();
    }

    // ---------- Réponses déterministes ----------
    private async Task<AiAnswer> SpofAnswer(Guid tenant, string q, CancellationToken ct)
    {
        var spofs = await spofAnalyzer.AnalyzeAsync(tenant, limit: 10, ct: ct);
        if (spofs.Count == 0)
            return Grounded(q, AiIntent.SinglePointsOfFailure, "Aucun single point of failure détecté : chaque actif dont dépendent d'autres dispose d'une redondance.", 0.9, [], [], [], null);

        var sb = new StringBuilder();
        sb.AppendLine($"{spofs.Count} single point(s) of failure identifié(s), sans redondance et dont dépendent d'autres actifs :");
        foreach (var s in spofs.Take(5))
            sb.AppendLine($"• {s.Entity.Name} ({s.Entity.EntityType}) — score {s.Score}, {s.DirectDependents} dépendants directs, portée {s.BlastRadius}.");

        var evidence = spofs.Take(5).Select(s =>
            new AiEvidence($"SPOF · {s.Entity.Name}", $"score {s.Score}, portée {s.BlastRadius}, aucune redondance")).ToList();
        var sources = spofs.Take(5).Select(s => new AiSource("graph:entity", s.Entity.Id.ToString())).ToList();

        return Grounded(q, AiIntent.SinglePointsOfFailure, sb.ToString().TrimEnd(), 0.9, evidence, sources,
            spofs.Take(5).Select(s => s.Entity.Name).ToList(),
            "Prioriser l'ajout d'une redondance (backup / reprise) sur les SPOF au score le plus élevé.");
    }

    private async Task<AiAnswer> TopRisksAnswer(Guid tenant, string q, IReadOnlyList<GraphEntityRecord> entities, CancellationToken ct)
    {
        var risks = new List<(GraphEntityRecord E, double Score, string Band, string TopFactor)>();
        foreach (var e in entities)
        {
            var r = await riskAnalyzer.AssessEntityAsync(tenant, e.Id, ct: ct);
            if (r is not null)
                risks.Add((e, r.Assessment.Score, r.Assessment.Band.ToString(), r.Assessment.Breakdown.FirstOrDefault()?.Factor ?? "—"));
        }
        var top = risks.OrderByDescending(x => x.Score).Take(5).ToList();
        if (top.Count == 0)
            return Grounded(q, AiIntent.TopRisks, "Aucune donnée de risque disponible : importez d'abord des actifs et leurs dépendances.", 0.4, [], [], [], null);

        var sb = new StringBuilder("Principaux risques opérationnels (score déterministe 0-100) :\n");
        foreach (var t in top)
            sb.AppendLine($"• {t.E.Name} ({t.E.EntityType}) — {t.Score:0.#} [{t.Band}], facteur dominant : {t.TopFactor}.");

        var evidence = top.Select(t => new AiEvidence($"Risque · {t.E.Name}", $"{t.Score:0.#} [{t.Band}], dominé par {t.TopFactor}")).ToList();
        var sources = top.Select(t => new AiSource("graph:entity", t.E.Id.ToString())).ToList();

        return Grounded(q, AiIntent.TopRisks, sb.ToString().TrimEnd(), 0.9, evidence, sources,
            top.Select(t => t.E.Name).ToList(),
            $"Traiter en priorité {top[0].E.Name} (score {top[0].Score:0.#}).");
    }

    private async Task<AiAnswer> ExplainAnswer(Guid tenant, string q, GraphEntityRecord? entity, CancellationToken ct)
    {
        if (entity is null)
            return NeedEntity(q, AiIntent.ExplainCriticality);

        var r = await riskAnalyzer.AssessEntityAsync(tenant, entity.Id, ct: ct);
        if (r is null) return NeedEntity(q, AiIntent.ExplainCriticality);

        var dependents = await queries.GetDirectDependentsAsync(tenant, entity.Id, ct);
        var top = r.Assessment.Breakdown.Where(b => b.Points > 0).Take(3).ToList();

        var sb = new StringBuilder();
        sb.AppendLine($"{entity.Name} présente un risque de {r.Assessment.Score:0.#}/100 ({r.Assessment.Band}). Facteurs principaux :");
        foreach (var b in top)
            sb.AppendLine($"• {b.Factor} : {b.Points:0.#} points (valeur {b.Value:0.00}).");
        sb.AppendLine($"{dependents.Count} actif(s) en dépendent directement ; rayon d'explosion {r.BlastRadius}. " +
                      (r.HasRedundancy ? "Une redondance existe." : "Aucune redondance : c'est un point unique de défaillance."));

        var evidence = top.Select(b => new AiEvidence($"Facteur · {b.Factor}", $"{b.Points:0.#} pts (valeur {b.Value:0.00}, poids {b.Weight:0.00})")).ToList();
        evidence.Add(new AiEvidence("Dépendants directs", $"{dependents.Count}"));

        return Grounded(q, AiIntent.ExplainCriticality, sb.ToString().TrimEnd(), 0.9, evidence,
            [new AiSource("graph:entity", entity.Id.ToString()), new AiSource("risk:assessment", entity.Name)],
            dependents.Select(d => d.Name).ToList(),
            r.HasRedundancy ? null : $"Ajouter une redondance à {entity.Name} pour réduire son risque.");
    }

    private async Task<AiAnswer> SimulateAnswer(Guid tenant, string q, GraphEntityRecord? entity, CancellationToken ct)
    {
        if (entity is null)
            return NeedEntity(q, AiIntent.SimulateFailure);

        var result = await propagation.SimulateFailureAsync(tenant, entity.Id, ScenarioType.ServerFailure, ct: ct);
        var byType = string.Join(", ", result.AffectedByType.Select(kv => $"{kv.Key} : {kv.Value}"));

        var text = result.AffectedTotal == 0
            ? $"Une panne de {entity.Name} n'affecte aucun autre actif : rien n'en dépend."
            : $"Une panne de {entity.Name} affecterait {result.AffectedTotal} actif(s) (profondeur max {result.MaxDepth}). " +
              $"Répartition : {byType}. Impact opérationnel estimé : {result.EstimatedOperationalImpact} (somme des criticités).";

        var evidence = result.Affected.Take(8)
            .Select(a => new AiEvidence($"Affecté · {a.Entity.Name}", $"{a.Entity.EntityType}, niveau {a.Depth}, criticité {a.Entity.Criticality}"))
            .ToList();

        return Grounded(q, AiIntent.SimulateFailure, text, 0.9, evidence,
            [new AiSource("simulation", entity.Name)],
            result.Affected.Select(a => a.Entity.Name).ToList(),
            result.AffectedTotal > 0 ? $"Prévoir un plan de continuité pour les {result.AffectedTotal} actifs dépendant de {entity.Name}." : null);
    }

    private async Task<AiAnswer> UndocumentedAnswer(Guid tenant, string q, IReadOnlyList<GraphEntityRecord> entities, CancellationToken ct)
    {
        var edges = await repository.GetRelationsAsync(tenant, ct: ct);
        var byId = entities.ToDictionary(e => e.Id);
        var weak = edges.Where(e => e.Status is "Unknown" or "AiSuggested" || e.Confidence < 0.5).ToList();

        if (weak.Count == 0)
            return Grounded(q, AiIntent.UndocumentedDependencies, "Aucune dépendance non documentée ou incertaine : toutes les relations sont importées ou vérifiées avec une confiance suffisante.", 0.85, [], [], [], null);

        var sb = new StringBuilder($"{weak.Count} dépendance(s) incertaine(s) ou non documentée(s) :\n");
        foreach (var e in weak.Take(8))
        {
            var s = byId.TryGetValue(e.Source, out var sv) ? sv.Name : e.Source.ToString();
            var t = byId.TryGetValue(e.Target, out var tv) ? tv.Name : e.Target.ToString();
            sb.AppendLine($"• {s} → {t} ({e.Type}, confiance {e.Confidence:0.00}, statut {e.Status}).");
        }

        var evidence = weak.Take(8).Select(e => new AiEvidence("Relation incertaine", $"{e.Type}, confiance {e.Confidence:0.00}, statut {e.Status}", e.Confidence)).ToList();
        return Grounded(q, AiIntent.UndocumentedDependencies, sb.ToString().TrimEnd(), 0.8, evidence,
            weak.Take(8).Select(e => new AiSource("graph:edge", e.Id.ToString())).ToList(), [],
            "Faire valider ces relations par un responsable pour les promouvoir en VERIFIED.");
    }

    private async Task<AiAnswer> OverviewAnswer(Guid tenant, string q, IReadOnlyList<GraphEntityRecord> entities, CancellationToken ct)
    {
        var spofs = await spofAnalyzer.AnalyzeAsync(tenant, limit: 3, ct: ct);
        var text = new StringBuilder($"L'organisation compte {entities.Count} actifs modélisés. ");
        if (spofs.Count > 0)
            text.Append($"Le principal point de vigilance est {spofs[0].Entity.Name} (SPOF, score {spofs[0].Score}). ");
        text.Append("Posez une question comme « pourquoi X est-il critique ? », « que se passe-t-il si X tombe ? » ou « quels sont nos plus grands risques ? ».");

        var evidence = spofs.Take(3).Select(s => new AiEvidence($"SPOF · {s.Entity.Name}", $"score {s.Score}")).ToList();
        return Grounded(q, AiIntent.Overview, text.ToString(), 0.7, evidence,
            spofs.Take(3).Select(s => new AiSource("graph:entity", s.Entity.Id.ToString())).ToList(),
            spofs.Take(3).Select(s => s.Entity.Name).ToList(), null);
    }

    // ---------- Naturalisation LLM (optionnelle) ----------
    private async Task<AiAnswer> Naturalize(AiAnswer answer, CancellationToken ct)
    {
        if (!chat.IsConfigured)
            return answer;

        var context = new StringBuilder();
        context.AppendLine("FAITS (ne rien ajouter au-delà) :");
        context.AppendLine(answer.Answer);
        foreach (var e in answer.Evidence)
            context.AppendLine($"- {e.Label} : {e.Detail}");

        const string system =
            "Tu es NEXUS Analyst. Réponds en français, de façon concise et professionnelle, " +
            "UNIQUEMENT à partir des FAITS fournis. N'invente aucune donnée. Ne contredis jamais les chiffres.";

        var completion = await chat.CompleteAsync(system, $"Question : {answer.Question}\n\n{context}", ct);
        return string.IsNullOrWhiteSpace(completion)
            ? answer
            : answer with { Answer = completion.Trim(), LlmNaturalized = true };
    }

    // ---------- Fabriques ----------
    private static AiAnswer Grounded(string q, AiIntent intent, string text, double confidence,
        IReadOnlyList<AiEvidence> evidence, IReadOnlyList<AiSource> sources, IReadOnlyList<string> affected, string? action)
        => new(q, intent, text, confidence, evidence, sources, affected, action, LlmNaturalized: false);

    private static AiAnswer NeedEntity(string q, AiIntent intent)
        => new(q, intent, "Je n'ai pas identifié d'actif précis dans la question. Précisez son nom exact (ex : « SQL01 »).",
            0.3, [], [], [], null, false);
}
