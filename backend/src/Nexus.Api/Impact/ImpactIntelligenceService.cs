using System.Text.Json;
using Nexus.AI;
using Nexus.Graph;
using Nexus.Risk;
using Nexus.Risk.Propagation;

namespace Nexus.Api.Impact;

/// <summary>Cible d'impact résolue depuis une question en langage naturel.</summary>
public sealed record ResolvedTarget(
    Guid Id, string Name, string EntityType, int Criticality, double MatchScore, bool Resolved);

/// <summary>Élément critique affecté par la cascade.</summary>
public sealed record CriticalItem(Guid Id, string Name, string Type, int Depth, int Criticality, long NodeImpact);

/// <summary>Dépendance dangereuse : nœud affecté qui est aussi un point unique de défaillance.</summary>
public sealed record DangerousDependency(Guid Id, string Name, string Type, int DirectDependents);

/// <summary>Résultat complet de l'analyse d'impact transversale.</summary>
public sealed record ImpactAnalysis(
    ResolvedTarget Target,
    string Scenario,
    int AffectedTotal,
    int MaxDepth,
    IReadOnlyDictionary<string, int> AffectedByType,
    long PerHourImpact,
    long WorstCaseImpact,
    long ExpectedImpact,
    double MaxRecoveryHours,
    string Currency,
    IReadOnlyList<CriticalItem> CriticalItems,
    IReadOnlyList<DangerousDependency> DangerousDependencies,
    IReadOnlyList<string> Mitigations,
    string Narrative,
    bool AiUsed,
    IReadOnlyList<FuzzyMatch> Alternatives);

/// <summary>
/// Intelligence d'impact transversale — LA couche qui relie une question métier en
/// langage naturel (« que se passe-t-il si nous perdons le fournisseur X ? ») au
/// graphe de dépendances : résolution de la cible → cascade (Propagation Engine) →
/// impact financier (BusinessImpactModel) → éléments critiques → dépendances
/// dangereuses (SPOF) → mitigations. L'IA ne fait que RÉSOUDRE la cible et
/// REFORMULER ; tous les chiffres restent déterministes et traçables.
/// </summary>
public sealed class ImpactIntelligenceService(
    IEntityResolver resolver,
    IDependencyQueries queries,
    PropagationEngine propagation,
    IChatCompletion chat)
{
    private const string Currency = "CAD";

    public async Task<ImpactAnalysis> AnalyzeAsync(Guid tenant, string question, string lang, CancellationToken ct)
    {
        // 1. Extraire le SUJET (nom d'entité) et un éventuel type de scénario.
        var (subject, scenarioHint) = await ExtractAsync(question, lang, ct);

        // 2. Résoudre le sujet vers un nœud réel du graphe (recherche floue full-text).
        var matches = await resolver.FindSimilarAsync(tenant, string.IsNullOrWhiteSpace(subject) ? question : subject, 5, ct);
        if (matches.Count == 0)
        {
            var empty = new ResolvedTarget(Guid.Empty, subject, "—", 0, 0, false);
            return new ImpactAnalysis(empty, "—", 0, 0, new Dictionary<string, int>(), 0, 0, 0, 0, Currency,
                [], [], [Fallback(lang, "no_target")], NarrativeUnresolved(lang, subject), false, []);
        }

        var best = matches[0];
        var scenario = ResolveScenario(scenarioHint, best.EntityType);

        // 3. Cascade transversale (dépendants transitifs).
        var prop = await propagation.SimulateFailureAsync(tenant, best.Id, scenario, 10, ct);

        // 4. Impact financier par nœud (coût/h × RTO × probabilité de propagation).
        var nodes = prop.Affected.Select(b =>
        {
            var cost = BusinessImpactModel.CostPerHour(b.Entity.Criticality);
            var rto = BusinessImpactModel.RtoHours(b.Entity.EntityType, b.Entity.Criticality);
            var prob = BusinessImpactModel.FailureProbability(b.Depth);
            return (b.Entity, b.Depth, cost, rto, prob, nodeImpact: (long)Math.Round(cost * rto));
        }).ToList();

        var perHour = nodes.Sum(n => n.cost);
        var worst = nodes.Sum(n => n.nodeImpact);
        var expected = (long)Math.Round(nodes.Sum(n => n.cost * n.rto * n.prob));
        var maxRecovery = nodes.Count == 0 ? 0 : nodes.Max(n => n.rto);

        // 5. Éléments critiques : les plus critiques d'abord.
        var critical = nodes
            .OrderByDescending(n => n.Entity.Criticality).ThenByDescending(n => n.nodeImpact)
            .Take(12)
            .Select(n => new CriticalItem(n.Entity.Id, n.Entity.Name, n.Entity.EntityType, n.Depth, n.Entity.Criticality, n.nodeImpact))
            .ToList();

        // 6. Dépendances dangereuses : nœuds affectés qui sont AUSSI des SPOF (sans redondance, beaucoup de dépendants).
        var affectedIds = prop.Affected.Select(a => a.Entity.Id).ToHashSet();
        var spofs = await queries.FindSpofCandidatesAsync(tenant, 50, ct);
        var dangerous = spofs
            .Where(s => affectedIds.Contains(s.Entity.Id))
            .OrderByDescending(s => s.DirectDependents)
            .Take(6)
            .Select(s => new DangerousDependency(s.Entity.Id, s.Entity.Name, s.Entity.EntityType, s.DirectDependents))
            .ToList();

        // 7. Récit + mitigations : IA si configurée, sinon repli déterministe.
        var (narrative, mitigations, aiUsed) = await NarrateAsync(
            best, scenario, prop.AffectedTotal, prop.AffectedByType, worst, expected, critical, dangerous, lang, ct);

        return new ImpactAnalysis(
            new ResolvedTarget(best.Id, best.Name, best.EntityType, MatchCriticality(critical, best.Id), best.Score, true),
            scenario.ToString(), prop.AffectedTotal, prop.MaxDepth, prop.AffectedByType,
            perHour, worst, expected, maxRecovery, Currency,
            critical, dangerous, mitigations, narrative, aiUsed,
            matches.Skip(1).ToList());
    }

    private static int MatchCriticality(IReadOnlyList<CriticalItem> critical, Guid id)
        => critical.FirstOrDefault(c => c.Id == id)?.Criticality ?? 0;

    // ── Extraction du sujet + scénario depuis la question ──
    private async Task<(string Subject, string? Scenario)> ExtractAsync(string question, string lang, CancellationToken ct)
    {
        if (chat.IsConfigured)
        {
            var system =
                "Tu extrais d'une question d'impact d'entreprise le SUJET central (le nom de l'élément qui tombe/disparaît/change) " +
                "et le TYPE de scénario. Réponds UNIQUEMENT en JSON strict : {\"subject\":\"...\",\"scenario\":\"supplier|employee|database|application|server|network|location|cloud|cyber|data|power|communication|generic\"}. " +
                "Le subject doit être le NOM PROPRE ou l'expression la plus discriminante (ex. « fournisseur Acme » → subject:\"Acme\"). " +
                "Si aucun scénario évident, mets \"generic\".";
            var raw = await chat.CompleteAsync(system, $"Question : « {question} »", ct);
            var parsed = TryParseExtract(raw);
            if (parsed is not null) return parsed.Value;
        }
        return (HeuristicSubject(question), HeuristicScenario(question));
    }

    private static (string, string?)? TryParseExtract(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var json = ExtractJson(raw);
        if (json is null) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var subject = root.TryGetProperty("subject", out var s) ? s.GetString() ?? "" : "";
            var scenario = root.TryGetProperty("scenario", out var sc) ? sc.GetString() : null;
            if (string.IsNullOrWhiteSpace(subject)) return null;
            return (subject.Trim(), scenario);
        }
        catch (JsonException) { return null; }
    }

    private static string? ExtractJson(string raw)
    {
        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        return start >= 0 && end > start ? raw[start..(end + 1)] : null;
    }

    // Repli sans IA : retire les mots interrogatifs, garde les termes porteurs.
    private static string HeuristicSubject(string q)
    {
        var stop = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "que","se","passe","t","il","si","nous","perdons","perd","on","le","la","les","du","de","des","notre","nos",
            "un","une","et","à","a","est","quel","quelle","quels","impact","what","happens","if","we","lose","our","the",
            "a","an","of","is","impact","disparaît","disparait","tombe","en","panne","arrête","arrete","d","l","au","aux",
        };
        var tokens = q.Split([' ', '\'', '’', '?', '.', ',', '!', ';', ':', '«', '»', '"'], StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 1 && !stop.Contains(w));
        var subject = string.Join(' ', tokens).Trim();
        return subject.Length == 0 ? q.Trim() : subject;
    }

    private static string? HeuristicScenario(string q)
    {
        var l = q.ToLowerInvariant();
        if (l.Contains("fournisseur") || l.Contains("supplier")) return "supplier";
        if (l.Contains("employ") || l.Contains("personne") || l.Contains("équipe") || l.Contains("equipe") || l.Contains("staff")) return "employee";
        if (l.Contains("base de don") || l.Contains("database")) return "database";
        if (l.Contains("appli") || l.Contains("logiciel") || l.Contains("app ")) return "application";
        if (l.Contains("serveur") || l.Contains("server")) return "server";
        if (l.Contains("réseau") || l.Contains("reseau") || l.Contains("network")) return "network";
        if (l.Contains("site") || l.Contains("bureau") || l.Contains("location") || l.Contains("usine")) return "location";
        if (l.Contains("cloud") || l.Contains("région") || l.Contains("region")) return "cloud";
        if (l.Contains("cyber") || l.Contains("attaque") || l.Contains("ransom")) return "cyber";
        if (l.Contains("donnée") || l.Contains("data")) return "data";
        return null;
    }

    private static ScenarioType ResolveScenario(string? hint, string entityType)
    {
        var byHint = hint?.ToLowerInvariant() switch
        {
            "supplier" => ScenarioType.SupplierFailure,
            "employee" => ScenarioType.EmployeeLoss,
            "database" => ScenarioType.DatabaseFailure,
            "application" => ScenarioType.ApplicationFailure,
            "server" => ScenarioType.ServerFailure,
            "network" => ScenarioType.NetworkFailure,
            "location" => ScenarioType.LocationFailure,
            "cloud" => ScenarioType.CloudRegionFailure,
            "cyber" => ScenarioType.CyberIncident,
            "data" => ScenarioType.DataLoss,
            "power" => ScenarioType.PowerOutage,
            "communication" => ScenarioType.CommunicationFailure,
            _ => (ScenarioType?)null,
        };
        if (byHint is not null) return byHint.Value;

        // Sinon déduit du type de l'entité résolue.
        return entityType switch
        {
            "Supplier" or "AiProvider" => ScenarioType.SupplierFailure,
            "Person" or "Role" or "Team" => ScenarioType.EmployeeLoss,
            "Database" or "DataStore" or "Dataset" => ScenarioType.DatabaseFailure,
            "Application" or "Service" or "System" or "AiModel" or "AiService" or "ModelEndpoint" or "AiAgent" or "AiWorkflow" => ScenarioType.ApplicationFailure,
            "Server" => ScenarioType.ServerFailure,
            "Network" => ScenarioType.NetworkFailure,
            "Location" => ScenarioType.LocationFailure,
            "CloudResource" => ScenarioType.CloudRegionFailure,
            _ => ScenarioType.ServerFailure,
        };
    }

    // ── Récit + mitigations ──
    private async Task<(string Narrative, IReadOnlyList<string> Mitigations, bool AiUsed)> NarrateAsync(
        FuzzyMatch target, ScenarioType scenario, int affectedTotal, IReadOnlyDictionary<string, int> byType,
        long worst, long expected, IReadOnlyList<CriticalItem> critical, IReadOnlyList<DangerousDependency> dangerous,
        string lang, CancellationToken ct)
    {
        if (chat.IsConfigured)
        {
            var ctx = new
            {
                target = new { target.Name, target.EntityType },
                scenario = scenario.ToString(),
                affectedTotal,
                byType,
                worstCaseImpact = worst,
                expectedImpact = expected,
                topCritical = critical.Take(6).Select(c => new { c.Name, c.Type, c.Criticality, c.Depth }),
                dangerousDependencies = dangerous.Select(d => new { d.Name, d.Type, d.DirectDependents }),
                currency = Currency,
            };
            var system =
                "Tu es un analyste d'impact d'entreprise. À partir du CONTEXTE STRUCTURÉ (déjà calculé, ne recalcule rien), " +
                "produis un JSON strict {\"narrative\":\"2-3 phrases\",\"mitigations\":[\"...\",\"...\",\"...\"]}. " +
                "La narrative explique en langage métier ce qui est exposé et pourquoi c'est grave (chiffres à l'appui). " +
                "Donne EXACTEMENT 3 mitigations concrètes et actionnables, priorisées, liées aux dépendances dangereuses si présentes. " +
                $"Rédige en {(lang == "en" ? "anglais" : "français")}.";
            var raw = await chat.CompleteAsync(system, JsonSerializer.Serialize(ctx), ct);
            var parsed = TryParseNarrative(raw);
            if (parsed is not null) return (parsed.Value.Item1, parsed.Value.Item2, true);
        }
        return (HeuristicNarrative(target, affectedTotal, worst, expected, lang),
                HeuristicMitigations(dangerous, lang), false);
    }

    private static (string, IReadOnlyList<string>)? TryParseNarrative(string? raw)
    {
        var json = raw is null ? null : ExtractJson(raw);
        if (json is null) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var narrative = root.TryGetProperty("narrative", out var n) ? n.GetString() ?? "" : "";
            var mits = root.TryGetProperty("mitigations", out var m) && m.ValueKind == JsonValueKind.Array
                ? m.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToList()
                : [];
            if (string.IsNullOrWhiteSpace(narrative) || mits.Count == 0) return null;
            return (narrative, mits);
        }
        catch (JsonException) { return null; }
    }

    private static string HeuristicNarrative(FuzzyMatch t, int affected, long worst, long expected, string lang)
        => lang == "en"
            ? $"Losing {t.Name} propagates to {affected} dependent element(s). Worst-case exposure ≈ {worst:N0} {Currency}, probability-weighted ≈ {expected:N0} {Currency}."
            : $"La perte de {t.Name} se propage à {affected} élément(s) dépendant(s). Exposition pire cas ≈ {worst:N0} {Currency}, pondérée par la probabilité ≈ {expected:N0} {Currency}.";

    private static IReadOnlyList<string> HeuristicMitigations(IReadOnlyList<DangerousDependency> dangerous, string lang)
    {
        var list = new List<string>();
        if (dangerous.Count > 0)
        {
            var d = dangerous[0];
            list.Add(lang == "en"
                ? $"Add redundancy/backup for «{d.Name}» ({d.DirectDependents} dependents) — highest single point of failure."
                : $"Ajouter une redondance/reprise pour «{d.Name}» ({d.DirectDependents} dépendants) — principal point unique de défaillance.");
        }
        list.Add(lang == "en"
            ? "Establish a qualified alternative and a documented switchover runbook."
            : "Qualifier une alternative et documenter une procédure de bascule.");
        list.Add(lang == "en"
            ? "Contractualize SLAs and monitor the most critical dependents in real time."
            : "Contractualiser des SLA et surveiller en temps réel les dépendants les plus critiques.");
        return list;
    }

    private static string Fallback(string lang, string _)
        => lang == "en" ? "No matching element found in the graph." : "Aucun élément correspondant trouvé dans le graphe.";

    private static string NarrativeUnresolved(string lang, string subject)
        => lang == "en"
            ? $"Could not resolve «{subject}» to an element in your dependency graph. Import or name the element, then retry."
            : $"Impossible de relier «{subject}» à un élément de votre graphe de dépendances. Importez ou nommez l'élément, puis réessayez.";
}
