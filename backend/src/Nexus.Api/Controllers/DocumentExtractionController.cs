using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Nexus.AI;
using Nexus.Api.Tenancy;
using Nexus.Domain.Graph;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;
using Nexus.Ingestion.Normalization;

namespace Nexus.Api.Controllers;

/// <summary>
/// Extraction de dépendances depuis un document (article 12 / P5). L'IA propose
/// des entités et relations à partir d'un texte ; l'utilisateur les ingère dans
/// le graphe, marquées « Suggéré par IA » (faible confiance) pour validation via
/// le centre Confiance & audit. Rien n'est écrit sans confirmation explicite.
/// </summary>
[Route("api/v1/documents")]
public sealed class DocumentExtractionController(
    ITenantProvider tenantProvider,
    IChatCompletion chat,
    IGraphRepository repository) : NexusController(tenantProvider)
{
    private const string Source = "Document Intelligence";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public sealed record ExtractRequest(string Text);
    public sealed record ExtractedEntity(string Name, string Type, int Criticality);
    public sealed record ExtractedRelation(string Source, string SourceType, string Target, string TargetType, string RelationType, double Confidence, string? Evidence);
    public sealed record IngestRequest(List<ExtractedEntity> Entities, List<ExtractedRelation> Relations);

    private const string EntityTypes = "Server, Database, Application, Service, System, BusinessProcess, BusinessService, Supplier, Contract, Person, Network, CloudResource, Location, Control";
    private const string RelationTypes = "DEPENDS_ON, RUNS_ON, HOSTS, USES, SUPPLIED_BY, AUTHENTICATES, KNOWS, MAINTAINS, STORES, PROTECTS";

    /// <summary>Extrait des candidats (entités + relations) — ne modifie PAS le graphe.</summary>
    [HttpPost("extract")]
    public async Task<IActionResult> Extract([FromBody] ExtractRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out _, out var error)) return error;
        if (string.IsNullOrWhiteSpace(req?.Text)) return BadRequest(new { error = "text_required" });
        if (!chat.IsConfigured) return Ok(new { usedAi = false, message = "Aucun modèle IA configuré (voir Admin → Intégrations IA).", entities = Array.Empty<object>(), relations = Array.Empty<object>() });

        var system =
            "Tu extrais un graphe de dépendances opérationnelles depuis un document. " +
            "Renvoie STRICTEMENT du JSON : {\"entities\":[{\"name\":\"\",\"type\":\"\",\"criticality\":0}]," +
            "\"relations\":[{\"source\":\"\",\"sourceType\":\"\",\"target\":\"\",\"targetType\":\"\",\"relationType\":\"\",\"confidence\":0.5,\"evidence\":\"citation courte\"}]}. " +
            $"Types d'entités : {EntityTypes}. Types de relations : {RelationTypes}. " +
            "criticality 0-100 (estime selon l'importance décrite). confidence 0-1 (à quel point le document l'affirme). " +
            "N'invente rien qui ne soit pas dans le texte. Utilise les noms exacts mentionnés.";

        var completion = await chat.CompleteAsync(system, req.Text.Length > 6000 ? req.Text[..6000] : req.Text, ct);
        if (string.IsNullOrWhiteSpace(completion)) return Ok(new { usedAi = false, message = "Le modèle n'a pas répondu.", entities = Array.Empty<object>(), relations = Array.Empty<object>() });

        var json = ExtractJson(completion);
        if (json is null) return Ok(new { usedAi = false, message = "Réponse IA non exploitable.", entities = Array.Empty<object>(), relations = Array.Empty<object>() });

        try
        {
            using var doc = JsonDocument.Parse(json);
            var entities = ReadArray(doc.RootElement, "entities").Select(e => new
            {
                name = Str(e, "name"),
                type = OntologyResolver.ResolveEntityType(Str(e, "type")).Name,
                criticality = Math.Clamp(Int(e, "criticality"), 0, 100),
            }).Where(e => !string.IsNullOrWhiteSpace(e.name)).ToList();

            var relations = ReadArray(doc.RootElement, "relations").Select(r => new
            {
                source = Str(r, "source"),
                sourceType = OntologyResolver.ResolveEntityType(Str(r, "sourceType")).Name,
                target = Str(r, "target"),
                targetType = OntologyResolver.ResolveEntityType(Str(r, "targetType")).Name,
                relationType = OntologyResolver.ResolveRelationType(Str(r, "relationType")).Name,
                confidence = Math.Clamp(Dbl(r, "confidence", 0.4), 0.05, 0.95),
                evidence = Str(r, "evidence"),
            }).Where(r => !string.IsNullOrWhiteSpace(r.source) && !string.IsNullOrWhiteSpace(r.target)).ToList();

            return Ok(new { usedAi = true, message = $"{entities.Count} entité(s), {relations.Count} relation(s) proposée(s).", entities, relations });
        }
        catch (JsonException)
        {
            return Ok(new { usedAi = false, message = "JSON IA invalide.", entities = Array.Empty<object>(), relations = Array.Empty<object>() });
        }
    }

    /// <summary>Ingère les candidats validés dans le graphe (statut « Suggéré par IA »).</summary>
    [HttpPost("ingest")]
    public async Task<IActionResult> Ingest([FromBody] IngestRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (req is null) return BadRequest(new { error = "body_required" });

        var existing = await repository.GetEntitiesAsync(tenant, ct: ct);
        var byName = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in existing) byName[e.Name] = e.Id;

        int entitiesCreated = 0, relationsCreated = 0, unresolved = 0;

        foreach (var e in req.Entities ?? [])
        {
            if (string.IsNullOrWhiteSpace(e.Name) || byName.ContainsKey(e.Name)) continue;
            var type = OntologyResolver.ResolveEntityType(e.Type);
            var crit = Criticality.Create(Math.Clamp(e.Criticality, 0, 100));
            var ge = GraphEntity.Create(tenant, type, e.Name, criticality: crit.IsSuccess ? crit.Value : null, sourceSystem: Source);
            if (ge.IsFailure) continue;
            await repository.UpsertEntityAsync(ge.Value, ct);
            byName[e.Name] = ge.Value.Id;
            entitiesCreated++;
        }

        foreach (var r in req.Relations ?? [])
        {
            if (!byName.TryGetValue(r.Source, out var sid) || !byName.TryGetValue(r.Target, out var tid)) { unresolved++; continue; }
            if (sid == tid) { unresolved++; continue; }
            var relType = OntologyResolver.ResolveRelationType(r.RelationType);
            var conf = Confidence.Create(Math.Clamp(r.Confidence, 0.05, 0.95));
            var rel = GraphRelation.Create(tenant, sid, tid, relType,
                conf.IsSuccess ? conf.Value : Confidence.Create(0.4).Value,
                ConfidenceStatus.AiSuggested, sourceSystem: Source, evidence: string.IsNullOrWhiteSpace(r.Evidence) ? null : r.Evidence);
            if (rel.IsFailure) { unresolved++; continue; }
            await repository.UpsertRelationAsync(rel.Value, ct);
            relationsCreated++;
        }

        return Ok(new { entitiesCreated, relationsCreated, unresolved });
    }

    private static IEnumerable<JsonElement> ReadArray(JsonElement root, string prop)
        => root.TryGetProperty(prop, out var a) && a.ValueKind == JsonValueKind.Array ? a.EnumerateArray() : [];
    private static string Str(JsonElement e, string p) => e.TryGetProperty(p, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
    private static int Int(JsonElement e, string p) => e.TryGetProperty(p, out var v) && v.TryGetInt32(out var i) ? i : 0;
    private static double Dbl(JsonElement e, string p, double def) => e.TryGetProperty(p, out var v) && v.TryGetDouble(out var d) ? d : def;
    private static string? ExtractJson(string text)
    {
        var s = text.IndexOf('{'); var e = text.LastIndexOf('}');
        return s >= 0 && e > s ? text[s..(e + 1)] : null;
    }
}
