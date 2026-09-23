using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Nexus.Risk;
using Nexus.Risk.Decisions;

namespace Nexus.AI.Decisions;

/// <summary>Un champ complété par l'assistant, avec sa source et sa justification.</summary>
public sealed record FieldSuggestion(string Field, string Source, string Reason);

/// <summary>Correction proposée par un angle mort, applicable en un clic.</summary>
public sealed record DecisionPatch(
    string Field, string? Text = null, double? Number = null, bool? Flag = null,
    IReadOnlyList<Guid>? AddIds = null, ToolSpec? AddTool = null);

/// <summary>
/// Angle mort : ce que la phrase ne dit pas et que le décideur doit trancher.
/// <c>Source</c> : graph (révélé par le graphe / le moteur) ou ai (contexte, métier).
/// </summary>
public sealed record BlindSpot(
    string Id, string Severity, string Title, string Detail, string? Question,
    IReadOnlyList<NodeRef> Nodes, DecisionPatch? Patch, string Source);

/// <summary>Brouillon de décision prêt à être vérifié par l'utilisateur.</summary>
public sealed record DecisionDraft(
    DecisionSpec Spec,
    IReadOnlyList<NodeRef> Matched,
    bool UsedAi,
    string? Note,
    string? Understanding,
    IReadOnlyList<FieldSuggestion> Suggestions,
    IReadOnlyList<BlindSpot> BlindSpots);

/// <summary>
/// Assistant de préparation d'une décision.
///
/// À partir d'une phrase, il :
/// 1. reconnaît le type de décision et les éléments RÉELS du graphe cités ;
/// 2. complète les champs par suggestion — d'abord ce que le graphe établit
///    (systèmes dont dépend l'activité servie, durée de bascule typique…), puis,
///    si une IA est configurée, des estimations argumentées (salaire, coûts,
///    outils nécessaires) ;
/// 3. fait ressortir les ANGLES MORTS : un pré-passage du moteur de décision sur
///    le brouillon (savoir détenu par une seule personne, fournisseur ajouté…),
///    complété par l'IA sur ce que le graphe ne peut pas savoir (conduite du
///    changement, réglementation du secteur, saisonnalité…).
///
/// Toute valeur proposée est marquée « suggérée » avec sa justification, et le
/// reste jusque dans le chiffrage tant que l'utilisateur ne l'a pas confirmée.
/// </summary>
public sealed class DecisionAssistant(IChatCompletion chat)
{
    public async Task<DecisionDraft> PrepareAsync(string text, GraphView g, DecisionContext ctx, string? sector, string lang, CancellationToken ct)
    {
        var en = lang == "en";
        string L(string fr, string e) => en ? e : fr;

        // 1. Lecture déterministe de la phrase.
        var (spec, matched) = Heuristic(text, g);
        var suggestions = new List<FieldSuggestion>();

        // 2. Ce que le graphe établit.
        spec = GraphSuggest(spec, g, ctx, suggestions, L);

        // 3. Pré-analyse : les constats du moteur deviennent des angles morts.
        var blind = PreAnalysis(spec, g, ctx, lang);

        var usedAi = false;
        string? understanding = null;
        if (chat.IsConfigured)
        {
            var ai = await TryAiAsync(text, spec, g, ctx, sector, blind, lang, ct);
            if (ai is not null)
            {
                usedAi = true;
                understanding = ai.Understanding;
                spec = Merge(spec, ai, suggestions);
                matched = matched.Concat(ai.Matched).DistinctBy(n => n.Id).ToList();
                // Les angles morts du moteur sont recalculés sur le brouillon enrichi.
                blind = PreAnalysis(spec, g, ctx, lang);
                blind.AddRange(ai.BlindSpots);
            }
        }

        spec = spec with { Suggested = suggestions.Select(s => s.Field).Distinct().ToList() };
        var note = matched.Count == 0
            ? L("Aucun élément de votre graphe n'a été reconnu dans la phrase : choisissez-les dans le formulaire.",
                "No element of your graph was recognised in the sentence: pick them in the form.")
            : null;
        return new DecisionDraft(spec, matched, usedAi, note, understanding, suggestions, blind);
    }

    // ── Lecture de la phrase (règles) ───────────────────────────────────────

    internal static string Norm(string s)
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

    internal static (DecisionSpec Spec, List<NodeRef> Matched) Heuristic(string text, GraphView g)
    {
        var t = Norm(text);
        var kind = Rules.FirstOrDefault(r => Regex.IsMatch(t, r.Pattern)).Kind ?? DecisionKinds.NewTool;

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
            Serves: serves, Uses: uses);
        return (spec, matched.Select(n => new NodeRef(n.Id, n.Name, n.Type)).ToList());
    }

    // ── Ce que le graphe établit ────────────────────────────────────────────

    private static DecisionSpec GraphSuggest(DecisionSpec s, GraphView g, DecisionContext ctx, List<FieldSuggestion> sug, Func<string, string, string> L)
    {
        var serves = (s.Serves ?? []).Select(x => x.ToString()).ToList();

        // Automatiser une activité : elle est le périmètre servi.
        if (s.Kind == DecisionKinds.Automate && s.SubjectId is { } proc && serves.Count == 0) serves = [proc.ToString()];

        // Les systèmes dont dépend déjà l'activité servie sont ceux que le nouvel
        // élément devra utiliser ou auxquels il devra se connecter.
        if (s.Kind is DecisionKinds.Hire or DecisionKinds.NewTool or DecisionKinds.Automate or DecisionKinds.OpenSite
            && (s.Uses?.Count ?? 0) == 0 && serves.Count > 0)
        {
            var deps = serves.SelectMany(g.DirectDependencies).Distinct()
                .Where(d => g.Get(d) is { } n && !g.IsPerson(d) && !g.IsActivity(d) && !g.IsSupplier(d)).Take(6).ToList();
            if (deps.Count > 0)
            {
                s = s with { Uses = deps.Select(Guid.Parse).ToList() };
                var act = string.Join(", ", serves.Select(x => g.Get(x)?.Name).Where(x => x is not null));
                sug.Add(new FieldSuggestion("uses", "graph", L(
                    $"{act} s'appuie aujourd'hui sur {string.Join(", ", deps.Select(d => g.Get(d)!.Name))} : ce sont les systèmes à relier.",
                    $"{act} currently relies on {string.Join(", ", deps.Select(d => g.Get(d)!.Name))}: these are the systems to connect.")));
            }
        }

        // Remplacement d'une personne qui détient seule un savoir : un recouvrement s'impose.
        if (s.Kind == DecisionKinds.Replace && s.SubjectId is { } pid && s.OverlapMonths is null)
        {
            var sole = g.HeldBy(pid.ToString()).Where(h => g.Holders(h).Count == 1).ToList();
            if (sole.Count > 0)
            {
                s = s with { OverlapMonths = Math.Min(3, 1 + sole.Count) };
                sug.Add(new FieldSuggestion("overlapMonths", "graph", L(
                    $"Seule personne à maîtriser {string.Join(", ", sole.Select(x => g.Get(x)!.Name))} : un recouvrement de {s.OverlapMonths} mois limite le risque de transition.",
                    $"Only person mastering {string.Join(", ", sole.Select(x => g.Get(x)!.Name))}: a {s.OverlapMonths}-month overlap limits transition risk.")));
            }
        }

        // Bascule : durée typique de rétablissement pour ce type d'élément.
        if (s.Kind is DecisionKinds.ReplaceTool or DecisionKinds.Upgrade or DecisionKinds.ChangeSupplier
            && s.CutoverHours is null && g.Get(s.SubjectId) is { } sub)
        {
            var h = (int)Math.Ceiling(BusinessImpactModel.RtoHours(sub.Type, sub.Criticality > 0 ? sub.Criticality : 60, ctx.Tuning));
            s = s with { CutoverHours = h };
            sug.Add(new FieldSuggestion("cutoverHours", "graph", L(
                $"Délai de rétablissement usuel d'un élément de ce type ({h} h), selon vos réglages d'impact.",
                $"Usual recovery time for an element of this type ({h} h), per your impact settings.")));
        }

        // Un service IA ou cloud est en général fourni par un prestataire externe.
        if (s.Kind is DecisionKinds.NewTool or DecisionKinds.Automate or DecisionKinds.ReplaceTool && !s.External
            && s.NewType is "AiService" or "CloudResource")
        {
            s = s with { External = true };
            sug.Add(new FieldSuggestion("external", "graph", L(
                "Un service IA ou cloud est presque toujours fourni par un prestataire externe : un fournisseur sera ajouté.",
                "An AI or cloud service is almost always provided by an external vendor: a supplier will be added.")));
        }

        // Salaire : sans salaire moyen connu, une estimation tirée du profil vaut mieux
        // qu'un champ vide — elle reste signalée comme suggestion.
        if (s.Kind is DecisionKinds.Hire or DecisionKinds.Replace or DecisionKinds.OpenSite
            && s.AnnualSalary is null && ctx.AverageSalary is null && ctx.AnnualRevenue > 0 && ctx.Headcount > 0)
        {
            s = s with { AnnualSalary = Math.Round(ctx.AnnualRevenue * 0.35 / ctx.Headcount / 1000) * 1000 };
            sug.Add(new FieldSuggestion("annualSalary", "graph", L(
                "Estimation à partir de votre profil : 35 % du chiffre d'affaires ÷ effectif. Remplacez-la par le salaire réel du poste.",
                "Estimate from your profile: 35% of revenue ÷ headcount. Replace it with the role's actual salary.")));
        }

        return s with { Serves = serves.Select(Guid.Parse).ToList() };
    }

    // ── Pré-analyse par le moteur ───────────────────────────────────────────

    private static List<BlindSpot> PreAnalysis(DecisionSpec s, GraphView g, DecisionContext ctx, string lang)
    {
        var list = new List<BlindSpot>();
        DecisionReport r;
        try { r = new DecisionEngine(g, ctx, lang).Analyze(s); }
        catch (ArgumentException) { return list; }

        var en = lang == "en";
        foreach (var f in r.Findings.Where(f => f.Severity is "danger" or "warning" && !f.Code.StartsWith("resilience.", StringComparison.Ordinal)))
        {
            list.Add(new BlindSpot("graph:" + f.Code, f.Severity, Title(f.Code, en), f.Text, null, f.Nodes, PatchFor(f.Code, s), "graph"));
        }
        list.AddRange(ChainBlindSpots(s, g, en));
        foreach (var m in r.MissingInputs.Take(4))
            list.Add(new BlindSpot("missing:" + Math.Abs(m.GetHashCode()), "info", en ? "Information missing" : "Information manquante", m,
                en ? "Can you provide it, even as an order of magnitude?" : "Pouvez-vous la fournir, même en ordre de grandeur ?", [], null, "graph"));
        return list;
    }

    /// <summary>
    /// Ce que la décision ne traite pas : les autres fragilités des activités
    /// qu'elle touche, et les personnes qui y travaillent déjà.
    /// </summary>
    private static IEnumerable<BlindSpot> ChainBlindSpots(DecisionSpec s, GraphView g, bool en)
    {
        var subject = s.SubjectId?.ToString();
        var touched = new HashSet<string>((s.Uses ?? []).Select(x => x.ToString()));
        if (subject is not null) touched.Add(subject);

        var activities = (s.Serves ?? []).Select(x => x.ToString()).ToList();
        if (subject is not null)
        {
            if (g.IsActivity(subject)) activities.Add(subject);
            activities.AddRange(g.Dependents(subject).Keys.Where(g.IsActivity));
        }

        foreach (var a in activities.Distinct().Where(a => g.Get(a) is not null).Take(3))
        {
            var name = g.Get(a)!.Name;
            var fragile = g.Dependencies(a).Where(x => !touched.Contains(x) && !g.IsPerson(x) && g.IsSinglePointOfFailure(x)).Take(4).ToList();
            if (fragile.Count > 0)
            {
                var list = string.Join(", ", fragile.Select(x => g.Get(x)!.Name));
                yield return new BlindSpot("graph:chain:" + a, "warning",
                    en ? $"Other weak links of {name}" : $"Autres maillons fragiles de « {name} »",
                    en ? $"{name} also depends on {list}: single points of failure that this decision does not address."
                       : $"{name} dépend aussi de {list} : des points uniques de défaillance que cette décision ne traite pas.",
                    en ? "Should they be part of this decision, or handled separately?" : "Faut-il les inclure dans cette décision, ou les traiter à part ?",
                    fragile.Select(x => g.Get(x)!).Select(n => new NodeRef(n.Id, n.Name, n.Type)).ToList(),
                    // Seuls des systèmes peuvent être « utilisés » : un fournisseur fragile se traite à part.
                    s.Kind is DecisionKinds.Hire or DecisionKinds.NewTool or DecisionKinds.Automate
                        && fragile.Where(x => !g.IsSupplier(x)).Select(Guid.Parse).ToList() is { Count: > 0 } sys
                        ? new DecisionPatch("uses", AddIds: sys) : null,
                    "graph");
            }

            var people = g.PeopleAround([a]).Where(p => p != subject).Take(4).ToList();
            if (people.Count > 0 && s.Kind is DecisionKinds.Hire or DecisionKinds.Automate or DecisionKinds.NewTool)
            {
                var list = string.Join(", ", people.Select(x => g.Get(x)!.Name));
                yield return new BlindSpot("graph:people:" + a, "info",
                    en ? $"Who already works on {name}" : $"Qui travaille déjà sur « {name} »",
                    en ? $"{list} already contribute to {name}: their role alongside the decision must be clarified."
                       : $"{list} contribue(nt) déjà à « {name} » : leur rôle aux côtés de la décision est à clarifier.",
                    en ? "Complement, replacement, or supervision?" : "Complément, remplacement, ou encadrement ?",
                    people.Select(x => g.Get(x)!).Select(n => new NodeRef(n.Id, n.Name, n.Type)).ToList(), null, "graph");
            }
        }
    }

    private static string Title(string code, bool en) => code switch
    {
        "person.sole-holder" => en ? "Knowledge held by a single person" : "Savoir détenu par une seule personne",
        "person.departure-gap" => en ? "Orphan systems" : "Systèmes orphelins",
        "person.no-overlap" => en ? "No handover period" : "Aucune période de transmission",
        "person.activities" => en ? "Activities exposed" : "Activités exposées",
        "hire.new-key-person" => en ? "A new key person" : "Une nouvelle personne clé",
        "hire.ai-no-data" => en ? "No data identified" : "Aucune donnée identifiée",
        "hire.unanchored" => en ? "Role not anchored" : "Poste non rattaché",
        "tool.overlap" => en ? "Possible duplicate tool" : "Doublon d'outil possible",
        "tool.new-spof" => en ? "New single point of failure" : "Nouveau point unique de défaillance",
        "tool.supplier-concentration" or "supplier.concentration" => en ? "Supplier concentration" : "Concentration fournisseur",
        "replace.blast" => en ? "Links to rebuild" : "Liaisons à refaire",
        "upgrade.regression" => en ? "Regression risk" : "Risque de régression",
        "site.inherits" => en ? "Inherited fragility" : "Fragilité héritée",
        "site.systems" => en ? "Systems to relocate" : "Systèmes à déménager",
        "auto.dependency" => en ? "Process dependent on a tool" : "Processus dépendant d'un outil",
        _ => en ? "Point of attention" : "Point d'attention",
    };

    /// <summary>Correction automatique quand elle est évidente.</summary>
    private static DecisionPatch? PatchFor(string code, DecisionSpec s) => code switch
    {
        "person.no-overlap" => new DecisionPatch("overlapMonths", Number: 2),
        "person.departure-gap" => null,
        _ => null,
    };

    // ── IA ──────────────────────────────────────────────────────────────────

    private sealed record AiDraft(
        string? Kind, GraphView.Node? Subject, string? NewName, string? NewType,
        List<GraphView.Node> Serves, List<GraphView.Node> Uses, List<ToolSpec> Tools,
        Dictionary<string, JsonElement> Values, Dictionary<string, string> Reasons,
        string? Understanding, List<BlindSpot> BlindSpots, List<NodeRef> Matched);

    private static readonly string[] NumberFields =
    [
        "annualSalary", "headcount", "oneOffCost", "annualCost", "annualCostRemoved", "overlapMonths", "cutoverHours",
        "trainingHoursPerPerson", "integrationDaysEach", "dayRate", "expectedAnnualGain", "hoursSavedPerMonth",
    ];

    private async Task<AiDraft?> TryAiAsync(string text, DecisionSpec draft, GraphView g, DecisionContext ctx, string? sector,
        List<BlindSpot> engineSpots, string lang, CancellationToken ct)
    {
        var en = lang == "en";
        var names = g.Nodes.ToDictionary(n => n.Id, n => n.Name);
        var catalog = string.Join("\n", g.Nodes.OrderByDescending(n => n.Criticality).Take(300)
            .Select(n => $"- {n.Name} [{n.Type}{(n.Criticality > 0 ? $", criticité {n.Criticality}" : "")}]"));

        // Voisinage des éléments concernés : ce qui les relie au reste de l'organisation.
        var focus = new HashSet<string>((draft.Serves ?? []).Concat(draft.Uses ?? []).Select(x => x.ToString()));
        if (draft.SubjectId is { } sid) focus.Add(sid.ToString());
        var around = g.Edges.Where(e => focus.Contains(e.Source) || focus.Contains(e.Target)).Take(80)
            .Select(e => $"- {names.GetValueOrDefault(e.Source)} -{e.Type}-> {names.GetValueOrDefault(e.Target)}");

        var draftJson = JsonSerializer.Serialize(new
        {
            kind = draft.Kind,
            subject = g.Get(draft.SubjectId)?.Name,
            newName = draft.NewName,
            serves = (draft.Serves ?? []).Select(x => names.GetValueOrDefault(x.ToString())),
            uses = (draft.Uses ?? []).Select(x => names.GetValueOrDefault(x.ToString())),
        });

        var system =
            "Tu es un conseiller en décision d'organisation, rigoureux et concret. Tu reçois une décision écrite par un dirigeant, " +
            "le profil de son organisation et le catalogue RÉEL de ses éléments (activités, systèmes, personnes/rôles, fournisseurs, sites). " +
            "Tu réponds UNIQUEMENT par un objet JSON strict, sans texte autour, avec ces champs :\n" +
            $"kind (un parmi : {string.Join(", ", DecisionKinds.All)}),\n" +
            "subject (nom EXACT d'un élément du catalogue concerné, ou null), newName (nouveau rôle, outil, fournisseur ou site, ou null), " +
            "newType (Role, Team, Application, AiService, CloudResource, Service, Database, System, Supplier, Location ou null),\n" +
            "serves (noms EXACTS d'activités du catalogue servies), uses (noms EXACTS de systèmes / données du catalogue utilisés),\n" +
            "tools (outils NOUVEAUX qu'il faudra acquérir pour que la décision fonctionne : [{name, type, supplier, external, outsideCountry, oneOffCost, annualCost}]),\n" +
            $"values (objet ; clés possibles : {string.Join(", ", NumberFields)}, external, outsideCountry),\n" +
            "reasons (objet : pour CHAQUE clé de values et pour tools/serves/uses remplis, une phrase qui justifie la valeur),\n" +
            "understanding (1 à 2 phrases : ce que tu as compris de la décision et de son enjeu),\n" +
            "blindSpots (3 à 6 angles morts : [{severity: danger|warning|info, title, detail, question, nodes: [noms du catalogue], patch: {field, value} ou null}]).\n" +
            "RÈGLES :\n" +
            $"- Montants dans la devise {ctx.Currency}, réalistes pour le pays, le secteur et la taille de l'organisation. Si tu n'as pas de base raisonnable, n'invente pas : omets la valeur.\n" +
            "- N'invente AUCUN élément existant : serves, uses, subject et nodes n'utilisent que les noms du catalogue.\n" +
            "- Les angles morts doivent être PROPRES à cette décision et à cette organisation (appuie-toi sur le catalogue et les relations), " +
            "pas des généralités. Pense à ce que le dirigeant n'a pas mentionné : outils ou accès nécessaires, données, personnes impactées, " +
            "dépendances créées, réglementation du secteur ou du pays, conduite du changement, calendrier, réversibilité.\n" +
            "- Ne répète pas les constats déjà établis par le moteur (fournis ci-dessous) : complète-les.\n" +
            "- patch.field ∈ {serves, uses, tools, external, outsideCountry, " + string.Join(", ", NumberFields) + "} ; " +
            "pour serves/uses, value est un tableau de noms du catalogue ; pour tools, un objet outil.\n" +
            $"- Rédige en {(en ? "anglais" : "français")}.";

        var user =
            $"Décision : « {text} »\n\n" +
            $"Organisation : secteur {sector ?? "non précisé"}, pays {ctx.Country ?? "non précisé"}, devise {ctx.Currency}, " +
            $"chiffre d'affaires annuel ≈ {ctx.AnnualRevenue:F0}, effectif {ctx.Headcount}, fonctionnement {(ctx.OperatingMode == "24x7" ? "24 h/24" : "heures ouvrées")}" +
            (ctx.AverageSalary is > 0 ? $", salaire moyen chargé ≈ {ctx.AverageSalary:F0}" : "") + ".\n\n" +
            $"Brouillon établi par règles : {draftJson}\n\n" +
            $"Constats déjà établis par le moteur :\n{string.Join("\n", engineSpots.Select(b => "- " + b.Detail))}\n\n" +
            $"Relations autour des éléments concernés :\n{string.Join("\n", around)}\n\n" +
            $"Catalogue des éléments existants :\n{catalog}";

        var raw = await chat.CompleteAsync(system, user, ct, CompletionOptions.Structured);
        return string.IsNullOrWhiteSpace(raw) ? null : ParseAi(raw, g);
    }

    private static AiDraft? ParseAi(string raw, GraphView g)
    {
        try
        {
            var start = raw.IndexOf('{'); var end = raw.LastIndexOf('}');
            if (start < 0 || end <= start) return null;
            using var doc = JsonDocument.Parse(raw[start..(end + 1)]);
            var r = doc.RootElement.Clone();

            static string? S(JsonElement e, string k) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            static double? N(JsonElement e, string k) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;
            static bool B(JsonElement e, string k) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.True;

            var byName = g.Nodes.GroupBy(n => Norm(n.Name)).ToDictionary(x => x.Key, x => x.First());
            GraphView.Node? Find(string? name) => name is null ? null : byName.GetValueOrDefault(Norm(name));
            List<GraphView.Node> FindAll(JsonElement e, string k) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(k, out var a) && a.ValueKind == JsonValueKind.Array
                ? a.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => Find(x.GetString())).OfType<GraphView.Node>().Distinct().ToList()
                : [];
            ToolSpec? Tool(JsonElement x) => S(x, "name") is { Length: > 0 } name
                ? new ToolSpec(name, S(x, "type"), S(x, "supplier"), B(x, "external"), B(x, "outsideCountry"),
                    N(x, "oneOffCost") is > 0 ? N(x, "oneOffCost") : null, N(x, "annualCost") is > 0 ? N(x, "annualCost") : null)
                : null;

            var kind = S(r, "kind");
            if (kind is not null && !DecisionKinds.All.Contains(kind)) kind = null;
            var tools = r.TryGetProperty("tools", out var ta) && ta.ValueKind == JsonValueKind.Array
                ? ta.EnumerateArray().Select(Tool).OfType<ToolSpec>().ToList() : [];

            var values = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
            if (r.TryGetProperty("values", out var vals) && vals.ValueKind == JsonValueKind.Object)
                foreach (var p in vals.EnumerateObject()) values[p.Name] = p.Value;

            var reasons = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (r.TryGetProperty("reasons", out var rs) && rs.ValueKind == JsonValueKind.Object)
                foreach (var p in rs.EnumerateObject()) if (p.Value.ValueKind == JsonValueKind.String) reasons[p.Name] = p.Value.GetString()!;

            var spots = new List<BlindSpot>();
            if (r.TryGetProperty("blindSpots", out var bs) && bs.ValueKind == JsonValueKind.Array)
            {
                var i = 0;
                foreach (var b in bs.EnumerateArray().Where(b => b.ValueKind == JsonValueKind.Object).Take(8))
                {
                    var title = S(b, "title");
                    if (string.IsNullOrWhiteSpace(title)) continue;
                    var sev = S(b, "severity") is "danger" or "warning" or "info" ? S(b, "severity")! : "warning";
                    var nodes = FindAll(b, "nodes").Select(n => new NodeRef(n.Id, n.Name, n.Type)).ToList();
                    DecisionPatch? patch = null;
                    if (b.TryGetProperty("patch", out var pa) && pa.ValueKind == JsonValueKind.Object && S(pa, "field") is { } field
                        && pa.TryGetProperty("value", out var pv))
                        patch = ToPatch(field, pv, Find, Tool);
                    spots.Add(new BlindSpot($"ai:{i++}", sev, title!, S(b, "detail") ?? "", S(b, "question"), nodes, patch, "ai"));
                }
            }

            var subject = Find(S(r, "subject"));
            var serves = FindAll(r, "serves"); var uses = FindAll(r, "uses");
            var matched = new[] { subject }.OfType<GraphView.Node>().Concat(serves).Concat(uses).Distinct()
                .Select(n => new NodeRef(n.Id, n.Name, n.Type)).ToList();
            return new AiDraft(kind, subject, S(r, "newName"), S(r, "newType"), serves, uses, tools, values, reasons,
                S(r, "understanding"), spots, matched);
        }
        catch (JsonException) { return null; }
        catch (InvalidOperationException) { return null; }
    }

    private static DecisionPatch? ToPatch(string field, JsonElement v, Func<string?, GraphView.Node?> find, Func<JsonElement, ToolSpec?> tool)
    {
        switch (field)
        {
            case "serves" or "uses":
                var ids = (v.ValueKind == JsonValueKind.Array ? v.EnumerateArray() : Enumerable.Repeat(v, 1))
                    .Where(x => x.ValueKind == JsonValueKind.String).Select(x => find(x.GetString())).OfType<GraphView.Node>()
                    .Select(n => Guid.Parse(n.Id)).ToList();
                return ids.Count > 0 ? new DecisionPatch(field, AddIds: ids) : null;
            case "tools":
                return v.ValueKind == JsonValueKind.Object && tool(v) is { } t ? new DecisionPatch(field, AddTool: t) : null;
            case "external" or "outsideCountry":
                return v.ValueKind is JsonValueKind.True or JsonValueKind.False ? new DecisionPatch(field, Flag: v.ValueKind == JsonValueKind.True) : null;
            default:
                if (NumberFields.Contains(field) && v.ValueKind == JsonValueKind.Number && v.GetDouble() >= 0)
                    return new DecisionPatch(field, Number: v.GetDouble());
                return null;
        }
    }

    /// <summary>
    /// Fusion : ce que la phrase dit explicitement l'emporte ; l'IA complète les
    /// champs vides, et chaque ajout est inscrit comme suggestion justifiée.
    /// </summary>
    private static DecisionSpec Merge(DecisionSpec s, AiDraft ai, List<FieldSuggestion> sug)
    {
        string Why(string field) => ai.Reasons.GetValueOrDefault(field) ?? "";

        // Le type compris par l'IA prime : elle lit la phrase entière, pas des mots-clés.
        if (ai.Kind is not null && ai.Kind != s.Kind) s = s with { Kind = ai.Kind, SubjectId = null };
        if (s.SubjectId is null && ai.Subject is not null) s = s with { SubjectId = Guid.Parse(ai.Subject.Id) };
        if (string.IsNullOrWhiteSpace(s.NewName) && !string.IsNullOrWhiteSpace(ai.NewName)) s = s with { NewName = ai.NewName };
        if (s.NewType is null && ai.NewType is not null) s = s with { NewType = ai.NewType };

        void AddIds(string field, List<GraphView.Node> nodes, IReadOnlyList<Guid>? current, Func<List<Guid>, DecisionSpec> set)
        {
            var cur = (current ?? []).ToList();
            var extra = nodes.Select(n => Guid.Parse(n.Id)).Where(id => !cur.Contains(id)).ToList();
            if (extra.Count == 0) return;
            s = set([.. cur, .. extra]);
            sug.Add(new FieldSuggestion(field, "ai", Why(field)));
        }
        AddIds("serves", ai.Serves, s.Serves, l => s with { Serves = l });
        AddIds("uses", ai.Uses, s.Uses, l => s with { Uses = l });

        if (ai.Tools.Count > 0 && (s.Tools?.Count ?? 0) == 0)
        {
            s = s with { Tools = ai.Tools };
            sug.Add(new FieldSuggestion("tools", "ai", Why("tools")));
        }

        foreach (var (key, v) in ai.Values)
        {
            var field = NumberFields.FirstOrDefault(f => f.Equals(key, StringComparison.OrdinalIgnoreCase));
            if (field is not null && v.ValueKind == JsonValueKind.Number && v.GetDouble() >= 0)
            {
                var n = v.GetDouble();
                DecisionSpec? next = field switch
                {
                    "annualSalary" when s.AnnualSalary is null => s with { AnnualSalary = n },
                    "headcount" when s.Headcount is null => s with { Headcount = (int)Math.Round(n) },
                    "oneOffCost" when s.OneOffCost is null => s with { OneOffCost = n },
                    "annualCost" when s.AnnualCost is null => s with { AnnualCost = n },
                    "annualCostRemoved" when s.AnnualCostRemoved is null => s with { AnnualCostRemoved = n },
                    "overlapMonths" when s.OverlapMonths is null => s with { OverlapMonths = (int)Math.Round(n) },
                    "cutoverHours" when s.CutoverHours is null => s with { CutoverHours = (int)Math.Round(n) },
                    "trainingHoursPerPerson" when s.TrainingHoursPerPerson is null => s with { TrainingHoursPerPerson = (int)Math.Round(n) },
                    "integrationDaysEach" when s.IntegrationDaysEach is null => s with { IntegrationDaysEach = (int)Math.Round(n) },
                    "dayRate" when s.DayRate is null => s with { DayRate = n },
                    "expectedAnnualGain" when s.ExpectedAnnualGain is null => s with { ExpectedAnnualGain = n },
                    "hoursSavedPerMonth" when s.HoursSavedPerMonth is null => s with { HoursSavedPerMonth = n },
                    _ => null,
                };
                if (next is not null) { s = next; sug.Add(new FieldSuggestion(field, "ai", Why(field))); }
            }
            else if (key.Equals("external", StringComparison.OrdinalIgnoreCase) && v.ValueKind == JsonValueKind.True && !s.External)
            { s = s with { External = true }; sug.Add(new FieldSuggestion("external", "ai", Why("external"))); }
            else if (key.Equals("outsideCountry", StringComparison.OrdinalIgnoreCase) && v.ValueKind == JsonValueKind.True && !s.OutsideCountry)
            { s = s with { OutsideCountry = true }; sug.Add(new FieldSuggestion("outsideCountry", "ai", Why("outsideCountry"))); }
        }
        if (s.ExpectedAnnualGain is not null && string.IsNullOrWhiteSpace(s.GainRationale) && Why("expectedAnnualGain") is { Length: > 0 } gw)
            s = s with { GainRationale = gw };
        return s;
    }
}
