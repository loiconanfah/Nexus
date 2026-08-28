using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Nexus.AI;

namespace Nexus.Api.Controllers;

/// <summary>
/// Analyse assistée par IA d'un échantillon de fichier : classe les données
/// (entités vs relations) et propose le mapping vers l'ontologie NEXUS. Utilise
/// le LLM configuré ; si aucune clé, renvoie usedAi=false et le frontend retombe
/// sur son heuristique déterministe.
/// </summary>
[ApiController]
[Route("api/v1/imports/analyze")]
public sealed class ImportAnalyzeController(IChatCompletion chat) : ControllerBase
{
    public sealed record AnalyzeRequest(string Sample);

    private const string EntityTypes = "Server, Database, Application, Service, System, BusinessProcess, BusinessService, Process, Supplier, Contract, Person, Role, Team, Network, Device, CloudResource, DataStore, Infrastructure, Asset, Location, Control";
    private const string RelationTypes = "DEPENDS_ON, RUNS_ON, HOSTS, USES, SUPPLIED_BY, AUTHENTICATES, KNOWS, MAINTAINS, CONNECTS_TO, STORES, PROTECTS, PART_OF, LOCATED_IN";

    [HttpPost]
    public async Task<IActionResult> Analyze([FromBody] AnalyzeRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Sample))
            return BadRequest(new { error = "sample_required" });

        if (!chat.IsConfigured)
            return Ok(new { usedAi = false, message = "Aucun modèle IA configuré — mapping heuristique.", mapping = (object?)null });

        var system =
            "Tu es un assistant de mapping de données pour la plateforme NEXUS (graphe de dépendances). " +
            "On te donne l'entête et quelques lignes d'un fichier CSV. Détermine s'il décrit des ENTITÉS (actifs/systèmes) " +
            "ou des RELATIONS (dépendances entre actifs), puis associe chaque rôle à un NOM DE COLONNE EXACT de l'entête " +
            "(ou une chaîne vide si absent). Réponds STRICTEMENT en JSON, sans texte autour, avec ce schéma : " +
            "{\"kind\":\"entities|relations\",\"name\":\"\",\"type\":\"\",\"crit\":\"\",\"source\":\"\",\"sourceType\":\"\"," +
            "\"target\":\"\",\"targetType\":\"\",\"relation\":\"UNE_DES_RELATIONS\",\"confidence\":\"\",\"defaultEntityType\":\"UN_DES_TYPES\"}. " +
            $"Types d'entités autorisés : {EntityTypes}. Types de relations autorisés : {RelationTypes}. " +
            "N'invente jamais un nom de colonne. Choisis le defaultEntityType le plus probable pour ces données.";

        var completion = await chat.CompleteAsync(system, "Échantillon :\n" + Truncate(req.Sample, 2500), ct);
        if (string.IsNullOrWhiteSpace(completion))
            return Ok(new { usedAi = false, message = "Le modèle n'a pas répondu — mapping heuristique.", mapping = (object?)null });

        var json = ExtractJson(completion);
        if (json is null)
            return Ok(new { usedAi = false, message = "Réponse IA non exploitable — mapping heuristique.", mapping = (object?)null });

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var mapping = new
            {
                kind = Str(root, "kind") == "relations" ? "relations" : "entities",
                name = Str(root, "name"),
                type = Str(root, "type"),
                crit = Str(root, "crit"),
                source = Str(root, "source"),
                sourceType = Str(root, "sourceType"),
                target = Str(root, "target"),
                targetType = Str(root, "targetType"),
                relation = Allowed(Str(root, "relation"), RelationTypes, "DEPENDS_ON"),
                confidence = Str(root, "confidence"),
                defaultEntityType = Allowed(Str(root, "defaultEntityType"), EntityTypes, "Asset"),
            };
            return Ok(new { usedAi = true, message = "Mapping proposé par l'IA.", mapping });
        }
        catch (JsonException)
        {
            return Ok(new { usedAi = false, message = "JSON IA invalide — mapping heuristique.", mapping = (object?)null });
        }
    }

    private static string Str(JsonElement e, string prop) => e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static string Allowed(string value, string csv, string fallback)
    {
        var v = value.Trim();
        foreach (var a in csv.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            if (string.Equals(a, v, StringComparison.OrdinalIgnoreCase)) return a;
        return fallback;
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];

    private static string? ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        return start >= 0 && end > start ? text[start..(end + 1)] : null;
    }
}
