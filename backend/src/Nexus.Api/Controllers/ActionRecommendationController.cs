using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Nexus.AI;
using Nexus.Api.Impact;
using Nexus.Api.Organization;
using Nexus.Api.Tenancy;
using Nexus.Graph;
using Nexus.Risk;

namespace Nexus.Api.Controllers;

/// <summary>
/// Que faire, précisément, pour un élément donné.
///
/// L'écran affichait « Introduire de la redondance pour X afin d'éliminer ce
/// point unique de défaillance » sur CHAQUE carte : une phrase vraie, générique,
/// et sans valeur. Elle ne dit ni ce qui dépend de X, ni ce que son arrêt coûte,
/// ni qu'un plan existe déjà, ni par quoi commencer lundi matin.
///
/// Ici, le déterministe RASSEMBLE les faits (dépendants nommés, coût horaire,
/// secours existant ou non, fournisseur, personnes, plans déjà rattachés) et le
/// modèle, s'il est disponible, les TRANSFORME en étapes concrètes. Sans modèle,
/// les étapes restent produites par des règles : moins bien tournées, mais tout
/// aussi spécifiques, parce qu'elles nomment les mêmes faits.
/// </summary>
[Route("api/v1/actions")]
public sealed class ActionRecommendationController(
    ITenantProvider tenantProvider,
    IGraphRepository repository,
    ImpactConfigStore impactConfig,
    OrganizationStore organization,
    IChatCompletion chat) : NexusController(tenantProvider)
{
    public sealed record RecommendRequest(Guid EntityId, string? Lang);

    public sealed record Recommendation(
        string Title, string Why, IReadOnlyList<string> Steps, string ExpectedGain, string Source);

    [HttpPost("recommend")]
    public async Task<IActionResult> Recommend([FromBody] RecommendRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        // Un corps absent ou un identifiant illisible doit donner une réponse
        // claire, pas le rapport de validation brut du cadriciel.
        if (req is null || req.EntityId == Guid.Empty) return BadRequest(new { error = "entity_required" });
        var lang = req.Lang == "en" ? "en" : "fr";

        var entity = await repository.GetEntityAsync(tenant, req.EntityId, ct);
        if (entity is null) return NotFound(new { error = "entity_not_found" });

        var facts = await GatherAsync(tenant, entity, ct);
        var rules = FromRules(facts, lang);

        // Le modèle ne décide de rien : il met en forme des faits déjà établis.
        if (chat.IsConfigured)
        {
            var ai = await FromModelAsync(facts, rules, lang, ct);
            if (ai is not null) return Ok(ai);
        }
        return Ok(rules);
    }

    private sealed record Facts(
        GraphEntityRecord Entity, string Currency, long HourlyCost,
        List<string> Dependents, List<string> Backups, List<string> Suppliers,
        List<string> People, List<string> Plans, int UnverifiedLinks);

    /// <summary>Les faits, lus dans le graphe. Rien d'inventé, rien de générique.</summary>
    private async Task<Facts> GatherAsync(Guid tenant, GraphEntityRecord entity, CancellationToken ct)
    {
        var entities = await repository.GetEntitiesAsync(tenant, ct: ct);
        var edges = await repository.GetRelationsAsync(tenant, ct: ct);
        var byId = entities.ToDictionary(e => e.Id);
        var tuning = await impactConfig.GetEffectiveAsync(tenant, ct);

        string? Name(Guid id) => byId.TryGetValue(id, out var e) ? e.Name : null;

        var dependents = edges
            .Where(e => e.Target == entity.Id && e.Type is "DEPENDS_ON" or "RUNS_ON" or "USES" or "SUPPLIED_BY")
            .Select(e => Name(e.Source)).OfType<string>().Distinct().Take(8).ToList();

        var backups = edges
            .Where(e => e.Source == entity.Id && e.Type == "BACKED_UP_BY")
            .Select(e => Name(e.Target)).OfType<string>().Distinct().ToList();

        var suppliers = edges
            .Where(e => e.Source == entity.Id && e.Type == "SUPPLIED_BY")
            .Select(e => Name(e.Target)).OfType<string>().Distinct().ToList();

        var people = edges
            .Where(e => e.Source == entity.Id && e.Type is "MANAGED_BY" or "MAINTAINS" or "KNOWS" or "RESPONSIBLE_FOR" or "OWNED_BY")
            .Select(e => byId.GetValueOrDefault(e.Target))
            .Where(e => e is not null && e.EntityType is "Person" or "Role" or "Team" or "BusinessUnit")
            .Select(e => e!.Name).Distinct().Take(5).ToList();

        var plans = edges
            .Where(e => e.Target == entity.Id && e.Type is "PROTECTS" or "RECOVERS_WITH" or "DOCUMENTED_BY")
            .Select(e => byId.GetValueOrDefault(e.Source))
            .Where(e => e is not null && e.EntityType is "Document" or "Control" or "Policy")
            .Select(e => e!.Name).Distinct().Take(5).ToList();

        var unverified = edges.Count(e =>
            (e.Source == entity.Id || e.Target == entity.Id)
            && !string.Equals(e.Status, "Verified", StringComparison.OrdinalIgnoreCase));

        var cost = (long)Math.Round((double)BusinessImpactModel.CostPerHour(entity.Criticality, entity.CostPerHour, tuning));
        return new Facts(entity, await organization.CurrencyAsync(tenant, ct), cost,
            dependents, backups, suppliers, people, plans, unverified);
    }

    /// <summary>
    /// Étapes produites par des règles. Elles nomment les faits : c'est ce qui
    /// les rend utilisables même sans modèle.
    /// </summary>
    private static Recommendation FromRules(Facts f, string lang)
    {
        var en = lang == "en";
        var e = f.Entity;
        var steps = new List<string>();
        var why = new StringBuilder();

        why.Append(en
            ? $"{f.Dependents.Count} element(s) depend on {e.Name}"
            : $"{f.Dependents.Count} élément(s) dépendent de {e.Name}");
        if (f.Dependents.Count > 0) why.Append(en ? $" ({string.Join(", ", f.Dependents.Take(4))})" : $" ({string.Join(", ", f.Dependents.Take(4))})");
        why.Append(en
            ? $". Its outage is priced at {f.HourlyCost} {f.Currency} per hour."
            : $". Son arrêt est chiffré à {f.HourlyCost} {f.Currency} par heure.");
        why.Append(f.Backups.Count == 0
            ? (en ? " No backup is declared." : " Aucun secours n'est déclaré.")
            : (en ? $" Declared backup: {string.Join(", ", f.Backups)}." : $" Secours déclaré : {string.Join(", ", f.Backups)}."));

        if (f.Backups.Count == 0)
        {
            steps.Add(en
                ? $"Name a candidate that could take over from {e.Name}, even in degraded mode, and write down what it cannot do."
                : $"Nommer un candidat capable de prendre le relais de {e.Name}, même en mode dégradé, et écrire ce qu'il ne saura pas faire.");
            steps.Add(en
                ? $"Test the switchover once, on the {(f.Dependents.Count > 0 ? f.Dependents[0] : e.Name)} path, and time it."
                : $"Tester la bascule une fois, sur le chemin {(f.Dependents.Count > 0 ? f.Dependents[0] : e.Name)}, et la chronométrer.");
            steps.Add(en
                ? "Record the measured time as the recovery objective, then declare the backup in the map."
                : "Consigner le temps mesuré comme objectif de reprise, puis déclarer le secours dans la cartographie.");
        }
        else
        {
            steps.Add(en
                ? $"Test the switchover to {f.Backups[0]} and check the measured time against the stated objective."
                : $"Tester la bascule vers {f.Backups[0]} et comparer le temps mesuré à l'objectif annoncé.");
        }

        if (f.Suppliers.Count > 0)
            steps.Add(en
                ? $"Ask {string.Join(", ", f.Suppliers)} for their own continuity commitment, in writing."
                : $"Demander à {string.Join(", ", f.Suppliers)} son engagement de continuité, par écrit.");

        if (f.People.Count == 0)
            steps.Add(en
                ? $"Name someone responsible for {e.Name}: nobody is attached to it today."
                : $"Nommer un responsable pour {e.Name} : personne n'y est rattaché aujourd'hui.");
        else if (f.People.Count == 1)
            steps.Add(en
                ? $"Cross-train a second person alongside {f.People[0]}, the only one attached to it."
                : $"Former une seconde personne aux côtés de {f.People[0]}, seul rattaché à cet élément.");

        if (f.Plans.Count == 0)
            steps.Add(en
                ? $"Write a one-page procedure for {e.Name} and attach it to the map."
                : $"Rédiger une procédure d'une page pour {e.Name} et la rattacher à la cartographie.");
        else
            steps.Add(en
                ? $"Re-read {f.Plans[0]} and check it still describes the current setup."
                : $"Relire {f.Plans[0]} et vérifier qu'il décrit encore l'installation actuelle.");

        if (f.UnverifiedLinks > 0)
            steps.Add(en
                ? $"Confirm the {f.UnverifiedLinks} unverified dependency(ies) of this element, so the figures hold up."
                : $"Confirmer les {f.UnverifiedLinks} dépendance(s) non vérifiées de cet élément, pour que les chiffres tiennent.");

        var gain = f.Backups.Count == 0
            ? (en ? $"Removes one single point of failure and {f.HourlyCost} {f.Currency} per hour of unprotected exposure."
                  : $"Supprime un point unique de défaillance et {f.HourlyCost} {f.Currency} par heure d'exposition non couverte.")
            : (en ? "Turns a declared backup into a tested one." : "Transforme un secours déclaré en secours éprouvé.");

        var title = f.Backups.Count == 0
            ? (en ? $"Give {e.Name} a way out" : $"Donner une issue de secours à {e.Name}")
            : (en ? $"Prove the backup of {e.Name}" : $"Éprouver le secours de {e.Name}");

        return new Recommendation(title, why.ToString(), steps, gain, "rules");
    }

    /// <summary>
    /// Le modèle reformule les MÊMES faits en étapes exécutables. Une réponse
    /// inexploitable ne fait rien perdre : les étapes des règles restent.
    /// </summary>
    private async Task<Recommendation?> FromModelAsync(Facts f, Recommendation rules, string lang, CancellationToken ct)
    {
        var language = lang == "en" ? "anglais" : "français";
        var system =
            "Tu es responsable de la continuité d'activité. On te donne des FAITS établis sur un élément d'une " +
            "cartographie de dépendances, et un plan de secours rédigé par des règles. " +
            "Réécris ce plan en actions CONCRÈTES, exécutables par une équipe cette semaine. " +
            "Renvoie STRICTEMENT du JSON : {\"title\":\"\",\"why\":\"\",\"steps\":[\"\"],\"expectedGain\":\"\"}\n" +
            "Règles :\n" +
            "1. N'invente AUCUN fait, aucun nom, aucun chiffre qui ne soit dans les faits fournis.\n" +
            "2. 3 à 5 étapes, chacune commençant par un verbe à l'infinitif, chacune vérifiable.\n" +
            "3. Nomme les éléments concernés. Une étape qui vaudrait pour n'importe quel système est à jeter.\n" +
            $"4. Écris en {language}. title : moins de 70 caractères.";

        var facts = JsonSerializer.Serialize(new
        {
            element = f.Entity.Name,
            type = f.Entity.EntityType,
            criticite = f.Entity.Criticality,
            coutHoraire = $"{f.HourlyCost} {f.Currency}",
            dependants = f.Dependents,
            secours = f.Backups,
            fournisseurs = f.Suppliers,
            personnes = f.People,
            plans = f.Plans,
            dependancesNonVerifiees = f.UnverifiedLinks,
            planParRegles = rules.Steps,
        });

        var raw = await chat.CompleteAsync(system, facts, ct, CompletionOptions.Structured);
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try
        {
            var start = raw.IndexOf('{');
            var end = raw.LastIndexOf('}');
            if (start < 0 || end <= start) return null;
            using var doc = JsonDocument.Parse(raw[start..(end + 1)]);
            var root = doc.RootElement;
            var steps = root.TryGetProperty("steps", out var s) && s.ValueKind == JsonValueKind.Array
                ? s.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 3).Take(6).ToList()
                : [];
            if (steps.Count == 0) return null;
            return new Recommendation(
                Text(root, "title") ?? rules.Title,
                Text(root, "why") ?? rules.Why,
                steps,
                Text(root, "expectedGain") ?? rules.ExpectedGain,
                "ai");
        }
        catch (JsonException) { return null; }
    }

    private static string? Text(JsonElement root, string name)
        => root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String && v.GetString() is { Length: > 2 } s ? s : null;
}
