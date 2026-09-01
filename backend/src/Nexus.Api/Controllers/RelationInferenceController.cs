using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Nexus.AI;
using Nexus.Api.Tenancy;
using Nexus.Domain.Graph;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;
using Nexus.Ingestion.Normalization;

namespace Nexus.Api.Controllers;

/// <summary>
/// Inférence de dépendances (le « moat ») : au lieu d'un graphe rempli à la main,
/// l'IA LIT les entités déjà présentes dans le graphe du tenant et PROPOSE les
/// arêtes de dépendance manquantes, avec justification et confiance. Rien n'est
/// écrit sans validation : conforme à la gouvernance (propose, ne décide pas —
/// statut « Suggéré par IA », faible confiance, revue via Confiance & audit).
/// </summary>
[Route("api/v1/inference")]
public sealed class RelationInferenceController(
    ITenantProvider tenantProvider,
    IChatCompletion chat,
    IGraphRepository repository) : NexusController(tenantProvider)
{
    private const string Source = "Relation Inference";
    private const string RelationTypes = "DEPENDS_ON, RUNS_ON, HOSTS, USES, SUPPLIED_BY, AUTHENTICATES, MAINTAINS, CONNECTS_TO, STORES, PROTECTS, PART_OF, LOCATED_IN";

    public sealed record ProposedRelation(
        string Source, string SourceType, string Target, string TargetType,
        string RelationType, double Confidence, string Rationale);

    public sealed record IngestRequest(List<ProposedRelation> Relations);

    /// <summary>Analyse le graphe existant et propose des dépendances manquantes — n'écrit RIEN.</summary>
    [HttpPost("relations")]
    public async Task<IActionResult> Infer(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var entities = await repository.GetEntitiesAsync(tenant, ct: ct);
        if (entities.Count < 2)
            return Ok(new { usedAi = false, message = "Pas assez d'entités pour inférer des dépendances.", proposals = Array.Empty<object>() });

        if (!chat.IsConfigured)
            return Ok(new { usedAi = false, message = "Aucun modèle IA configuré (voir Admin → Intégrations IA).", proposals = Array.Empty<object>() });

        var edges = await repository.GetRelationsAsync(tenant, ct: ct);
        var byId = entities.ToDictionary(e => e.Id, e => e);
        var byName = new Dictionary<string, GraphEntityRecord>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in entities) byName[e.Name] = e;
        var existingPairs = new HashSet<(Guid, Guid)>();
        foreach (var edge in edges) existingPairs.Add((edge.Source, edge.Target));

        // Échantillon borné pour rester dans une fenêtre de tokens raisonnable.
        var sample = entities.Take(160).ToList();
        var catalog = new StringBuilder();
        foreach (var e in sample)
        {
            catalog.Append("- ").Append(e.Name).Append(" [").Append(e.EntityType).Append(']');
            if (!string.IsNullOrWhiteSpace(e.Description)) catalog.Append(" — ").Append(Truncate(e.Description!, 90));
            catalog.Append('\n');
        }
        var existingList = new StringBuilder();
        foreach (var edge in edges.Take(400))
            if (byId.TryGetValue(edge.Source, out var s) && byId.TryGetValue(edge.Target, out var tg))
                existingList.Append(s.Name).Append(" -").Append(edge.Type).Append("-> ").Append(tg.Name).Append('\n');

        var system =
            "Tu es un ingénieur en fiabilité qui reconstruit le graphe de dépendances opérationnelles d'une organisation. " +
            "On te donne le CATALOGUE des entités existantes et les RELATIONS DÉJÀ CONNUES. " +
            "Propose UNIQUEMENT des relations de dépendance MANQUANTES et PLAUSIBLES entre des entités du catalogue, " +
            "en utilisant EXACTEMENT les noms fournis (jamais d'entité inexistante, jamais une relation déjà connue). " +
            "Réponds STRICTEMENT en JSON : {\"relations\":[{\"source\":\"\",\"sourceType\":\"\",\"target\":\"\",\"targetType\":\"\"," +
            "\"relationType\":\"UNE_DES_RELATIONS\",\"confidence\":0.6,\"rationale\":\"raison courte\"}]}. " +
            $"Types de relations autorisés : {RelationTypes}. La sémantique est « source DÉPEND DE target » (l'appli dépend de la base, " +
            "le service dépend du serveur, l'organisation dépend du fournisseur…). confidence 0-1 selon la vraisemblance. " +
            "Sois pertinent et prudent : propose au plus 25 relations, les plus probables d'abord. Rédige rationale en français.";

        var user = $"CATALOGUE ({sample.Count} entités) :\n{catalog}\nRELATIONS DÉJÀ CONNUES :\n{(existingList.Length == 0 ? "(aucune)" : existingList.ToString())}";

        var completion = await chat.CompleteAsync(system, Truncate(user, 9000), ct);
        if (string.IsNullOrWhiteSpace(completion))
            return Ok(new { usedAi = false, message = "Le modèle n'a pas répondu.", proposals = Array.Empty<object>() });

        var json = ExtractJson(completion);
        if (json is null)
            return Ok(new { usedAi = false, message = "Réponse IA non exploitable.", proposals = Array.Empty<object>() });

        try
        {
            using var doc = JsonDocument.Parse(json);
            var arr = doc.RootElement.TryGetProperty("relations", out var a) && a.ValueKind == JsonValueKind.Array
                ? a.EnumerateArray() : Enumerable.Empty<JsonElement>();

            var seen = new HashSet<(Guid, Guid)>();
            var proposals = new List<ProposedRelation>();
            foreach (var r in arr)
            {
                var sName = Str(r, "source"); var tName = Str(r, "target");
                if (!byName.TryGetValue(sName, out var s) || !byName.TryGetValue(tName, out var tgt)) continue; // entité inconnue
                if (s.Id == tgt.Id) continue;
                if (existingPairs.Contains((s.Id, tgt.Id))) continue;                                          // déjà connue
                if (!seen.Add((s.Id, tgt.Id))) continue;                                                       // doublon dans la réponse
                proposals.Add(new ProposedRelation(
                    s.Name, s.EntityType, tgt.Name, tgt.EntityType,
                    OntologyResolver.ResolveRelationType(Str(r, "relationType")).Name,
                    Math.Clamp(Dbl(r, "confidence", 0.5), 0.05, 0.95),
                    Str(r, "rationale")));
            }

            return Ok(new
            {
                usedAi = true,
                message = $"{proposals.Count} dépendance(s) proposée(s) à partir de {sample.Count} entités.",
                entitiesScanned = sample.Count,
                existingRelations = edges.Count,
                proposals,
            });
        }
        catch (JsonException)
        {
            return Ok(new { usedAi = false, message = "JSON IA invalide.", proposals = Array.Empty<object>() });
        }
    }

    /// <summary>Ingère les relations validées dans le graphe (statut « Suggéré par IA »).</summary>
    [HttpPost("relations/ingest")]
    public async Task<IActionResult> Ingest([FromBody] IngestRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (req?.Relations is null || req.Relations.Count == 0) return BadRequest(new { error = "relations_required" });

        var entities = await repository.GetEntitiesAsync(tenant, ct: ct);
        var byName = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in entities) byName[e.Name] = e.Id;

        int created = 0, unresolved = 0;
        foreach (var r in req.Relations)
        {
            if (!byName.TryGetValue(r.Source, out var sid) || !byName.TryGetValue(r.Target, out var tid)) { unresolved++; continue; }
            if (sid == tid) { unresolved++; continue; }
            var relType = OntologyResolver.ResolveRelationType(r.RelationType);
            var conf = Confidence.Create(Math.Clamp(r.Confidence, 0.05, 0.95));
            var rel = GraphRelation.Create(tenant, sid, tid, relType,
                conf.IsSuccess ? conf.Value : Confidence.Create(0.4).Value,
                ConfidenceStatus.AiSuggested, sourceSystem: Source,
                evidence: string.IsNullOrWhiteSpace(r.Rationale) ? null : r.Rationale);
            if (rel.IsFailure) { unresolved++; continue; }
            await repository.UpsertRelationAsync(rel.Value, ct);
            created++;
        }
        return Ok(new { created, unresolved });
    }

    private static string Str(JsonElement e, string p) => e.TryGetProperty(p, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
    private static double Dbl(JsonElement e, string p, double def) => e.TryGetProperty(p, out var v) && v.TryGetDouble(out var d) ? d : def;
    private static string Truncate(string s, int n) => s.Length <= n ? s : s[..n];

    private static string? ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        return start >= 0 && end > start ? text[start..(end + 1)] : null;
    }
}
