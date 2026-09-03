using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Nexus.AI;
using Nexus.Api.Tenancy;

namespace Nexus.Api.Controllers;

/// <summary>
/// Analyse IA d'une simulation d'ATTAQUE (chaîne de compromission / kill-chain).
/// Reformule un résultat structuré en récit d'attaque + risques + contre-mesures.
/// Déterministe côté calcul ; l'IA ne fait que raconter.
/// </summary>
[Route("api/v1/attacks")]
public sealed class AttacksController(ITenantProvider tenantProvider, IChatCompletion chat) : NexusController(tenantProvider)
{
    public sealed record ChainStep(string Name, string Type, string? Via);
    public sealed record ExplainRequest(
        string EntryName, string EntryType, string Scenario,
        int Compromised, int ServicesExposed, int DataExposed,
        long WorstCase, long Expected, string Currency,
        Dictionary<string, int>? ByType, List<ChainStep>? Chain, string? Lang);

    [HttpPost("explain")]
    public async Task<IActionResult> Explain([FromBody] ExplainRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out _, out var error)) return error;
        if (req is null || string.IsNullOrWhiteSpace(req.EntryName)) return BadRequest(new { error = "entry_required" });
        var lang = req.Lang == "en" ? "en" : "fr";

        if (!chat.IsConfigured)
            return Ok(new { usedAi = false, narrative = Heuristic(req, lang), risks = Array.Empty<string>(), countermeasures = Mitigations(req, lang) });

        var ctx = new
        {
            scenario = req.Scenario,
            entry = new { req.EntryName, req.EntryType },
            impact = new { req.Compromised, req.ServicesExposed, req.DataExposed, worstCase = req.WorstCase, expected = req.Expected, req.Currency },
            byType = req.ByType,
            attackChain = req.Chain,
        };
        var system =
            "Tu es un analyste en cybersécurité spécialisé dans les chaînes d'attaque (kill-chain) et le mouvement latéral. " +
            "À partir du CONTEXTE STRUCTURÉ d'une simulation d'attaque (déjà calculé, ne recalcule rien), produis un JSON strict " +
            "{\"narrative\":\"2-3 phrases\",\"risks\":[\"...\"],\"countermeasures\":[\"...\"]}. " +
            "La narrative RACONTE la chaîne : point d'entrée → pivots (accès, données, agents) → services et données atteints, chiffres à l'appui. " +
            "risks = 2-3 risques concrets (exfiltration de données, mouvement latéral, détournement d'agent, persistance). " +
            "countermeasures = 3 contre-mesures actionnables et PRIORISÉES (isoler tel élément, révoquer un accès, segmenter, surveiller, limiter les permissions d'agent). " +
            $"Sois concret et opérationnel. Rédige en {(lang == "en" ? "anglais" : "français")}.";
        var raw = await chat.CompleteAsync(system, JsonSerializer.Serialize(ctx), ct);
        var parsed = TryParse(raw);
        if (parsed is null)
            return Ok(new { usedAi = false, narrative = Heuristic(req, lang), risks = Array.Empty<string>(), countermeasures = Mitigations(req, lang) });
        return Ok(new { usedAi = true, narrative = parsed.Value.Item1, risks = parsed.Value.Item2, countermeasures = parsed.Value.Item3 });
    }

    private static (string, List<string>, List<string>)? TryParse(string? raw)
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
            var cm = root.TryGetProperty("countermeasures", out var c) && c.ValueKind == JsonValueKind.Array
                ? c.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToList() : [];
            if (string.IsNullOrWhiteSpace(narrative)) return null;
            return (narrative, risks, cm);
        }
        catch (JsonException) { return null; }
    }

    private static string Heuristic(ExplainRequest r, string lang)
        => lang == "en"
            ? $"“{r.Scenario}” starting at {r.EntryName} spreads to {r.Compromised} element(s), exposing {r.ServicesExposed} service(s) and {r.DataExposed} data store(s). Probability-weighted exposure ≈ {r.Expected:N0} {r.Currency} (worst case {r.WorstCase:N0})."
            : $"« {r.Scenario} » depuis {r.EntryName} se propage à {r.Compromised} élément(s), exposant {r.ServicesExposed} service(s) et {r.DataExposed} donnée(s). Exposition pondérée ≈ {r.Expected:N0} {r.Currency} (pire cas {r.WorstCase:N0}).";

    private static List<string> Mitigations(ExplainRequest r, string lang)
        => lang == "en"
            ? new() { $"Isolate {r.EntryName} and revoke its access immediately.", "Segment the network / least-privilege the AI agents.", "Monitor lateral movement on the exposed services in real time." }
            : new() { $"Isoler {r.EntryName} et révoquer ses accès immédiatement.", "Segmenter le réseau / réduire les permissions des agents IA.", "Surveiller le mouvement latéral sur les services exposés en temps réel." };
}
