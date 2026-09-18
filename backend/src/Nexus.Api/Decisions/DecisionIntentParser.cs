using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Nexus.AI;
using Nexus.Risk.Decisions;

namespace Nexus.Api.Decisions;

/// <summary>Brouillon de décision tiré d'une phrase, à confirmer par l'utilisateur.</summary>
public sealed record DecisionDraft(DecisionSpec Spec, IReadOnlyList<NodeRef> Matched, bool UsedAi, string? Note);

/// <summary>
/// Transforme une phrase (« remplacer l'administrateur ERP qui part en juin »)
/// en décision structurée, en reconnaissant les éléments RÉELS du graphe.
///
/// Rôle de l'IA strictement limité : proposer un type et des éléments. Elle ne
/// produit aucun chiffre ; l'utilisateur voit et corrige le brouillon avant
/// toute analyse. Sans clé IA, des règles simples prennent le relais.
/// </summary>
public sealed class DecisionIntentParser(IChatCompletion chat)
{
    public async Task<DecisionDraft> ParseAsync(string text, GraphView g, string lang, CancellationToken ct)
    {
        if (chat.IsConfigured)
        {
            var ai = await TryAiAsync(text, g, lang, ct);
            if (ai is not null) return ai;
        }
        return Heuristic(text, g);
    }

    // ── Règles (sans IA) ────────────────────────────────────────────────────

    private static string Norm(string s)
    {
        var d = s.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(d.Length);
        foreach (var c in d) if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(char.ToLowerInvariant(c));
        return Regex.Replace(sb.ToString(), "[^a-z0-9]+", " ").Trim();
    }

    private static readonly (string Kind, string Pattern)[] Rules =
    [
        (DecisionKinds.Automate, @"\bautomatis|\bautomate"),
        (DecisionKinds.OpenSite, @"\b(ouvrir|ouverture|open(ing)?)\b.*\b(agence|site|bureau|succursale|boutique|magasin|usine|entrepot|branch|office|store|plant|warehouse)"),
        (DecisionKinds.CloseSite, @"\b(fermer|fermeture|close|closing)\b.*\b(agence|site|bureau|succursale|boutique|magasin|usine|entrepot|branch|office|store|plant|warehouse)"),
        (DecisionKinds.ChangeSupplier, @"\b(changer|changement)\b.*\b(fournisseur|prestataire|operateur|hebergeur|editeur)|\bswitch(ing)?\b.*\b(supplier|provider|vendor)"),
        (DecisionKinds.Upgrade, @"\b(mise a jour|mettre a jour|upgrade|update|nouvelle version|montee de version)"),
        // Un remplacement explicite l'emporte sur un départ (« remplacer X qui part à la retraite »).
        (DecisionKinds.Replace, @"\b(remplac|replac|substitu)"),
        (DecisionKinds.Hire, @"\b(recrut|embauch|engager|hire|hiring|recruit)"),
        (DecisionKinds.Departure, @"\b(depart|quitte|demission|retraite|licenci|leav|resign|retir)"),
        (DecisionKinds.NewTool, @"\b(acheter|acquerir|deployer|installer|mettre en place|adopter|introduire|souscrire|buy|deploy|install|adopt|implement|introduce|subscribe)"),
    ];

    private static DecisionDraft Heuristic(string text, GraphView g)
    {
        var t = Norm(text);
        var kind = Rules.FirstOrDefault(r => Regex.IsMatch(t, r.Pattern)).Kind ?? DecisionKinds.NewTool;

        // Éléments du graphe cités dans la phrase (le nom le plus long d'abord).
        var matched = g.Nodes
            .Select(n => (n, key: Norm(n.Name)))
            .Where(x => x.key.Length >= 3 && Regex.IsMatch(t, $@"\b{Regex.Escape(x.key)}\b"))
            .OrderByDescending(x => x.key.Length)
            .Select(x => x.n).ToList();

        GraphView.Node? subject = null;
        if (kind is DecisionKinds.Replace or DecisionKinds.Departure)
        {
            subject = matched.FirstOrDefault(n => g.IsPerson(n.Id)) ?? matched.FirstOrDefault();
            if (kind == DecisionKinds.Replace && subject is not null && !g.IsPerson(subject.Id))
                kind = g.IsSupplier(subject.Id) ? DecisionKinds.ChangeSupplier : DecisionKinds.ReplaceTool;
        }
        else if (kind is DecisionKinds.ChangeSupplier) subject = matched.FirstOrDefault(n => g.IsSupplier(n.Id));
        else if (kind is DecisionKinds.Automate) subject = matched.FirstOrDefault(n => g.IsActivity(n.Id)) ?? matched.FirstOrDefault();
        else if (kind is DecisionKinds.Upgrade) subject = matched.FirstOrDefault(n => !g.IsPerson(n.Id) && !g.IsActivity(n.Id));
        else if (kind is DecisionKinds.CloseSite) subject = matched.FirstOrDefault(n => n.Type == "Location");

        var others = matched.Where(n => n != subject).ToList();
        var serves = others.Where(n => g.IsActivity(n.Id)).Select(n => Guid.Parse(n.Id)).ToList();
        var uses = others.Where(n => !g.IsActivity(n.Id) && !g.IsPerson(n.Id)).Select(n => Guid.Parse(n.Id)).ToList();

        // Nom du nouvel élément : ce qui suit « par » (remplacement) ou le verbe principal.
        string? newName = null;
        var m = Regex.Match(text, @"\bpar\s+(?:un|une|le|la|l'|des)?\s*([^,.;]+?)(?:\s+(?:pour|afin|qui|dans|en|d'ici)\b|[,.;]|$)", RegexOptions.IgnoreCase);
        if (kind is DecisionKinds.Replace or DecisionKinds.ReplaceTool or DecisionKinds.ChangeSupplier && m.Success) newName = m.Groups[1].Value.Trim();
        if (newName is null && kind is DecisionKinds.Hire or DecisionKinds.NewTool or DecisionKinds.OpenSite or DecisionKinds.Automate)
        {
            var v = Regex.Match(text, @"(?:recruter|embaucher|engager|hire|recruit|acheter|acquérir|déployer|installer|mettre en place|adopter|introduire|ouvrir|open|buy|deploy|adopt|implement)\s+(?:un|une|le|la|l'|des|an?|the)?\s*([^,.;]+?)(?:\s+(?:pour|afin|qui|dans|à|a|to|for|in|that)\b|[,.;]|$)", RegexOptions.IgnoreCase);
            if (v.Success) newName = v.Groups[1].Value.Trim();
        }
        if (newName is { Length: > 0 }) newName = char.ToUpperInvariant(newName[0]) + newName[1..];

        var newType = kind switch
        {
            DecisionKinds.Hire => "Role",
            DecisionKinds.OpenSite => "Location",
            DecisionKinds.NewTool or DecisionKinds.Automate => Regex.IsMatch(t, @"\b(ia|ai|intelligence artificielle|chatbot|llm|machine learning)\b") ? "AiService" : "Application",
            _ => null,
        };

        var spec = new DecisionSpec(kind, SubjectId: subject is null ? null : Guid.Parse(subject.Id), NewName: newName, NewType: newType,
            Serves: serves, Uses: uses, OverlapMonths: kind == DecisionKinds.Replace ? 1 : null);
        return new DecisionDraft(spec, matched.Select(n => new NodeRef(n.Id, n.Name, n.Type)).ToList(), false,
            matched.Count == 0 ? "Aucun élément de votre graphe n'a été reconnu dans la phrase : choisissez-les dans le formulaire." : null);
    }

    // ── IA (facultative) ────────────────────────────────────────────────────

    private async Task<DecisionDraft?> TryAiAsync(string text, GraphView g, string lang, CancellationToken ct)
    {
        var catalog = string.Join("\n", g.Nodes.Take(400).Select(n => $"- {n.Name} [{n.Type}]"));
        var system =
            "Tu convertis une décision d'organisation en JSON strict, sans texte autour. Champs : " +
            $"kind (un parmi : {string.Join(", ", DecisionKinds.All)}), subject (nom EXACT d'un élément du catalogue concerné, ou null), " +
            "newName (nom du nouveau rôle, outil, fournisseur ou site, ou null), newType (Role, Application, AiService, CloudResource, Supplier, Location… ou null), " +
            "serves (noms EXACTS d'activités du catalogue servies), uses (noms EXACTS de systèmes/données du catalogue utilisés), " +
            "tools (tableau d'outils nouveaux à acquérir : {name, type, external (bool)}), overlapMonths (entier ou null). " +
            "N'invente AUCUN montant et n'invente aucun nom d'élément existant : n'utilise que le catalogue. " +
            "Choisis replace pour une personne remplacée, replace-tool pour un outil remplacé, change-supplier pour un fournisseur.";
        var user = $"Décision : « {text} »\nCatalogue des éléments existants :\n{catalog}";
        var raw = await chat.CompleteAsync(system, user, ct);
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try
        {
            var start = raw.IndexOf('{'); var end = raw.LastIndexOf('}');
            if (start < 0 || end <= start) return null;
            using var doc = JsonDocument.Parse(raw[start..(end + 1)]);
            var r = doc.RootElement;
            string? S(JsonElement e, string k) => e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            var byName = g.Nodes.GroupBy(n => Norm(n.Name)).ToDictionary(x => x.Key, x => x.First());
            GraphView.Node? Find(string? name) => name is null ? null : byName.GetValueOrDefault(Norm(name));
            List<GraphView.Node> FindAll(string k) => r.TryGetProperty(k, out var a) && a.ValueKind == JsonValueKind.Array
                ? a.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => Find(x.GetString())).OfType<GraphView.Node>().ToList() : [];

            var kind = S(r, "kind");
            if (kind is null || !DecisionKinds.All.Contains(kind)) return null;
            var subject = Find(S(r, "subject"));
            var serves = FindAll("serves"); var uses = FindAll("uses");
            var tools = r.TryGetProperty("tools", out var ta) && ta.ValueKind == JsonValueKind.Array
                ? ta.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.Object && S(x, "name") is { Length: > 0 })
                    .Select(x => new ToolSpec(S(x, "name")!, S(x, "type"), null, x.TryGetProperty("external", out var ex) && ex.ValueKind == JsonValueKind.True)).ToList()
                : [];
            int? overlap = r.TryGetProperty("overlapMonths", out var ov) && ov.ValueKind == JsonValueKind.Number ? ov.GetInt32() : null;

            var spec = new DecisionSpec(kind, SubjectId: subject is null ? null : Guid.Parse(subject.Id), NewName: S(r, "newName"), NewType: S(r, "newType"),
                Serves: serves.Select(n => Guid.Parse(n.Id)).ToList(), Uses: uses.Select(n => Guid.Parse(n.Id)).ToList(),
                Tools: tools.Count > 0 ? tools : null, OverlapMonths: overlap);
            var matched = new[] { subject }.OfType<GraphView.Node>().Concat(serves).Concat(uses).Distinct().Select(n => new NodeRef(n.Id, n.Name, n.Type)).ToList();
            return new DecisionDraft(spec, matched, true, null);
        }
        catch (JsonException) { return null; }
        catch (InvalidOperationException) { return null; }
    }
}
