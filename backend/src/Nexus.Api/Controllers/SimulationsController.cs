using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Nexus.AI;
using Nexus.Api.Tenancy;
using Nexus.Risk;
using Nexus.Risk.Propagation;

namespace Nexus.Api.Controllers;

/// <summary>Requête de simulation de défaillance (What-If, article 16).</summary>
public sealed record SimulateFailureRequest(
    Guid AssetId,
    ScenarioType Scenario = ScenarioType.ServerFailure,
    int MaxDepth = 10,
    int DurationHours = 8);

/// <summary>Moteur What-If : simulation de défaillance et cascade d'impacts.</summary>
[Route("api/v1/simulations")]
public sealed class SimulationsController(
    ITenantProvider tenantProvider,
    PropagationEngine propagation,
    IChatCompletion chat) : NexusController(tenantProvider)
{
    /// <summary>Simule la défaillance d'un actif et renvoie la propagation + l'impact financier estimé.</summary>
    [HttpPost]
    public async Task<IActionResult> Simulate([FromBody] SimulateFailureRequest request, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (request.AssetId == Guid.Empty)
        {
            return BadRequest("assetId requis.");
        }

        var result = await propagation.SimulateFailureAsync(tenant, request.AssetId, request.Scenario, request.MaxDepth, ct);

        // Modèle réaliste : coût horaire, RTO (temps de rétablissement) et
        // probabilité de propagation par actif → impact pire cas et attendu.
        var nodes = result.Affected.Select(b =>
        {
            var cost = BusinessImpactModel.CostPerHour(b.Entity.Criticality);
            var rto = BusinessImpactModel.RtoHours(b.Entity.EntityType, b.Entity.Criticality);
            var prob = BusinessImpactModel.FailureProbability(b.Depth);
            return new
            {
                id = b.Entity.Id, name = b.Entity.Name, type = b.Entity.EntityType,
                depth = b.Depth, criticality = b.Entity.Criticality,
                hourlyCost = cost, rtoHours = rto, probability = prob,
                nodeImpact = (long)Math.Round(cost * rto),
            };
        }).ToList();

        var perHour = nodes.Sum(n => n.hourlyCost);
        var worstCase = nodes.Sum(n => n.nodeImpact);                                   // tout casse, chacun jusqu'à son rétablissement
        var expected = (long)Math.Round(nodes.Sum(n => n.hourlyCost * n.rtoHours * n.probability)); // pondéré par la probabilité
        var maxRecovery = nodes.Count == 0 ? 0 : nodes.Max(n => n.rtoHours);
        var avgProbability = nodes.Count == 0 ? 0 : Math.Round(nodes.Average(n => n.probability), 2);

        return Ok(new
        {
            result.AssetId,
            result.Scenario,
            result.MaxDepth,
            result.AffectedTotal,
            result.AffectedByType,
            result.EstimatedOperationalImpact,
            result.Affected,
            estimatedFinancialImpactPerHour = perHour,
            worstCaseImpact = worstCase,
            expectedImpact = expected,
            maxRecoveryHours = maxRecovery,
            avgProbability,
            currency = "CAD",
            nodeDetails = nodes,
        });
    }

    // ── Explication IA d'une simulation (récit clair + risques + mitigations) ──
    public sealed record TopElement(string Name, string Type, bool Direct, int Criticality);
    public sealed record ExplainRequest(
        string OriginName, string OriginType, string Action, string ActionLabel,
        int Direct, int Indirect, int Spared, long WorstCase, long Expected, string Currency,
        Dictionary<string, int>? ByType, List<TopElement>? TopElements, string? Lang);

    /// <summary>Reformule un résultat de simulation en analyse claire (IA si configurée, sinon repli).</summary>
    [HttpPost("explain")]
    public async Task<IActionResult> Explain([FromBody] ExplainRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out _, out var error)) return error;
        if (req is null || string.IsNullOrWhiteSpace(req.OriginName)) return BadRequest(new { error = "origin_required" });
        var lang = req.Lang == "en" ? "en" : "fr";

        if (!chat.IsConfigured)
            return Ok(new { usedAi = false, narrative = HeuristicNarrative(req, lang), risks = Array.Empty<string>(), mitigations = HeuristicMitigations(req, lang) });

        var ctx = new
        {
            incident = req.ActionLabel,
            origin = new { req.OriginName, req.OriginType },
            impact = new { req.Direct, req.Indirect, req.Spared, worstCase = req.WorstCase, expected = req.Expected, req.Currency },
            byType = req.ByType,
            topElements = req.TopElements,
        };
        var system =
            "Tu es un analyste de résilience opérationnelle. À partir du CONTEXTE STRUCTURÉ d'une simulation d'incident " +
            "(déjà chiffré, ne recalcule rien), produis un JSON strict {\"narrative\":\"2-3 phrases claires et précises\"," +
            "\"risks\":[\"...\"],\"mitigations\":[\"...\"]}. La narrative explique en langage métier CE QUI casse et POURQUOI " +
            "(directs vs indirects, chiffres à l'appui), et pourquoi certains éléments sont épargnés par CE type d'incident. " +
            "Donne 2-3 risques concrets et 3 mitigations actionnables et priorisées. " +
            $"Sois concret, sans jargon inutile. Rédige en {(lang == "en" ? "anglais" : "français")}.";
        var raw = await chat.CompleteAsync(system, JsonSerializer.Serialize(ctx), ct);
        var parsed = TryParse(raw);
        if (parsed is null)
            return Ok(new { usedAi = false, narrative = HeuristicNarrative(req, lang), risks = Array.Empty<string>(), mitigations = HeuristicMitigations(req, lang) });

        return Ok(new { usedAi = true, narrative = parsed.Value.Narrative, risks = parsed.Value.Risks, mitigations = parsed.Value.Mitigations });
    }

    private static (string Narrative, List<string> Risks, List<string> Mitigations)? TryParse(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.IndexOf('{'); var e = raw.LastIndexOf('}');
        if (s < 0 || e <= s) return null;
        try
        {
            using var doc = JsonDocument.Parse(raw[s..(e + 1)]);
            var root = doc.RootElement;
            var narrative = root.TryGetProperty("narrative", out var n) ? n.GetString() ?? "" : "";
            var risks = root.TryGetProperty("risks", out var r) && r.ValueKind == JsonValueKind.Array
                ? r.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToList() : [];
            var mits = root.TryGetProperty("mitigations", out var m) && m.ValueKind == JsonValueKind.Array
                ? m.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToList() : [];
            if (string.IsNullOrWhiteSpace(narrative)) return null;
            return (narrative, risks, mits);
        }
        catch (JsonException) { return null; }
    }

    private static string HeuristicNarrative(ExplainRequest r, string lang)
    {
        var total = r.Direct + r.Indirect;
        return lang == "en"
            ? $"“{r.ActionLabel}” on {r.OriginName} impacts {total} element(s) ({r.Direct} direct, {r.Indirect} indirect); {r.Spared} dependent element(s) are spared by this incident type. Probability-weighted exposure ≈ {r.Expected:N0} {r.Currency} (worst case {r.WorstCase:N0})."
            : $"« {r.ActionLabel} » sur {r.OriginName} impacte {total} élément(s) ({r.Direct} direct(s), {r.Indirect} indirect(s)) ; {r.Spared} élément(s) dépendant(s) sont épargnés par ce type d'incident. Exposition pondérée ≈ {r.Expected:N0} {r.Currency} (pire cas {r.WorstCase:N0}).";
    }

    private static List<string> HeuristicMitigations(ExplainRequest r, string lang)
        => lang == "en"
            ? new() { $"Add redundancy/failover for {r.OriginName}.", "Qualify an alternative and document a switchover runbook.", "Monitor the most critical direct dependents in real time." }
            : new() { $"Ajouter une redondance/reprise pour {r.OriginName}.", "Qualifier une alternative et documenter une procédure de bascule.", "Surveiller en temps réel les dépendants directs les plus critiques." };
}
