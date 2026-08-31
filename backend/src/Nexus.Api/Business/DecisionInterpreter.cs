using System.Text.Json;
using System.Text.RegularExpressions;
using Nexus.AI;

namespace Nexus.Api.Business;

/// <summary>Nouveau service/produit proposé par une décision (apparaît dans l'hologramme).</summary>
public sealed record NewService(string Name, string Division, double AnnualRevenue, double AnnualCost, int Headcount);

/// <summary>
/// Effets structurés d'une décision en langage naturel. L'IA (si configurée)
/// INTERPRÈTE la phrase en leviers + éventuel nouveau service ; le moteur
/// déterministe calcule ensuite l'impact. Repli par règles si aucune clé.
/// </summary>
public sealed record DecisionEffect(
    double PricePct, double VolumePct, int HeadcountDelta, double SalaryPct, double MarketingPct, double CogsPts,
    NewService? NewService, string Interpretation, IReadOnlyList<string> Assumptions, IReadOnlyList<string> Risks,
    double Confidence, bool AiUsed);

/// <summary>Interprète une décision business ; l'IA reformule, le déterministe borne.</summary>
public sealed class DecisionInterpreter(IChatCompletion chat)
{
    public async Task<DecisionEffect> InterpretAsync(string text, BusinessDrivers d, string lang, CancellationToken ct)
    {
        var revenue = d.Units * d.AvgPrice;
        if (chat.IsConfigured)
        {
            var ai = await TryAiAsync(text, d, revenue, lang, ct);
            if (ai is not null) return ai;
        }
        return Heuristic(text, revenue, lang);
    }

    private async Task<DecisionEffect?> TryAiAsync(string text, BusinessDrivers d, double revenue, string lang, CancellationToken ct)
    {
        var system =
            "Tu es un analyste qui traduit une décision d'entreprise CONCRÈTE en effets financiers structurés. " +
            "Tu produis UNIQUEMENT un JSON strict (aucun texte autour) avec ces champs : pricePct (variation % du prix moyen), " +
            "volumePct (variation % du volume de ventes), headcountDelta (entier, +/- employés à SALAIRE PLEIN), salaryPct, " +
            "marketingPct (variation % du budget marketing), cogsPts (variation en points du coût des services), " +
            "newElement (objet ou null : {name, type, annualRevenue, annualCost, headcount}), " +
            "interpretation (1-2 phrases), assumptions (tableau), risks (tableau), confidence (0..1).\n" +
            "RÈGLES : traduis TOUTE décision concrète, pas seulement les leviers évidents. " +
            "Utilise newElement pour tout ce qui n'est pas un simple levier — un nouveau service/produit/équipe/bureau/campagne/programme, " +
            "avec des montants ANNUELS réalistes (CAD) proportionnés à l'entreprise. Exemples : " +
            "« prendre 20 stagiaires » → newElement {name:'Programme de stagiaires', type:'Équipe', annualCost≈20×20000, annualRevenue≈gain de productivité modéré, headcount:20} (n'utilise PAS headcountDelta, un stagiaire n'est pas au salaire plein) ; " +
            "« ouvrir un bureau » → newElement {type:'Site', annualCost = loyer+charges, annualRevenue = ventes locales attendues} ; " +
            "« campagne marketing » → marketingPct ; « recruter 50 ingénieurs » → headcountDelta:50. " +
            $"Taille de l'entreprise : revenu annuel ≈ {revenue:F0} CAD, effectif {d.Headcount}, salaire moyen {d.AvgSalary:F0}. " +
            "IMPORTANT : les champs de pourcentage sont en POINTS entiers — écris 12 pour +12 %, -20 pour -20 %. N'écris JAMAIS de fraction comme 0.12. " +
            "SOIS CONSERVATEUR ET RÉALISTE : une embauche/un investissement est d'abord un COÛT (headcountDelta ou newElement.annualCost), pas un gain. " +
            "N'ajoute un effet de revenu (volumePct ou annualRevenue) QUE si la décision lie explicitement l'action à la génération de revenu " +
            "(ex. « embaucher des commerciaux pour vendre plus »), et reste modéré (montée en charge, incertitude). Ne transforme JAMAIS un simple coût en profit automatique. " +
            $"N'inclus que les effets réellement impliqués (0 sinon). Rédige interpretation/assumptions/risks en {(lang == "en" ? "anglais" : "français")}.";

        var user =
            $"Décision : « {text} »\n" +
            $"Leviers actuels : revenu {revenue:F0} CAD, effectif {d.Headcount}, prix moyen {d.AvgPrice:F0}, " +
            $"salaire moyen {d.AvgSalary:F0}, marketing {d.Marketing:F0}, coût des services {d.CogsPercent:P0}.";

        var raw = await chat.CompleteAsync(system, user, ct);
        if (string.IsNullOrWhiteSpace(raw)) return null;

        try
        {
            var json = ExtractJson(raw);
            using var doc = JsonDocument.Parse(json);
            var r = doc.RootElement;
            double N(string k) => r.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : 0;
            NewService? svc = null;
            if ((r.TryGetProperty("newElement", out var s) || r.TryGetProperty("newService", out s)) && s.ValueKind == JsonValueKind.Object)
            {
                string S(string k) => s.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString()! : "";
                double SN(string k) => s.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : 0;
                var name = S("name");
                if (!string.IsNullOrWhiteSpace(name))
                    svc = new NewService(name, string.IsNullOrWhiteSpace(S("type")) ? S("division") : S("type"), SN("annualRevenue"), SN("annualCost"), (int)SN("headcount"));
            }
            var interp = r.TryGetProperty("interpretation", out var it) ? it.GetString() ?? "" : "";
            var assumptions = ReadArray(r, "assumptions");
            var risks = ReadArray(r, "risks");
            var conf = r.TryGetProperty("confidence", out var cv) && cv.ValueKind == JsonValueKind.Number ? cv.GetDouble() : 0.75;
            // Certains modèles renvoient les % en fraction (0.12 pour 12 %) : on remet à l'échelle.
            static double Pctize(double v) => v != 0 && Math.Abs(v) < 1 ? v * 100 : v;
            return new DecisionEffect(
                Pctize(N("pricePct")), Pctize(N("volumePct")), (int)N("headcountDelta"),
                Pctize(N("salaryPct")), Pctize(N("marketingPct")), Pctize(N("cogsPts")),
                svc, interp, assumptions, risks, Math.Clamp(conf, 0.2, 0.95), true);
        }
        catch (JsonException)
        {
            return null; // JSON invalide → repli déterministe
        }
    }

    private static string ExtractJson(string raw)
    {
        var fence = Regex.Match(raw, "```(?:json)?\\s*(\\{.*\\})\\s*```", RegexOptions.Singleline);
        if (fence.Success) return fence.Groups[1].Value;
        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        return start >= 0 && end > start ? raw.Substring(start, end - start + 1) : raw;
    }

    private static IReadOnlyList<string> ReadArray(JsonElement r, string key)
    {
        if (!r.TryGetProperty(key, out var a) || a.ValueKind != JsonValueKind.Array) return [];
        return a.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).ToList();
    }

    // Repli déterministe (aucune clé IA) : patrons simples + service générique.
    private static DecisionEffect Heuristic(string text, double revenue, string lang)
    {
        var s = text.ToLowerInvariant();
        double Num(string re) { var m = Regex.Match(s, re); return m.Success ? double.Parse(m.Groups[1].Value.Replace(',', '.')) : double.NaN; }
        bool Down() => Regex.IsMatch(s, "baiss|réduir|reduce|lower|decrease|cut|perd|lose|supprim|down");

        double price = Num("(?:prix|price)[^0-9]*(\\d+(?:[.,]\\d+)?)\\s*%");
        double sales = Num("(?:vente|sales|revenu|revenue|demande|demand)[^0-9]*(\\d+(?:[.,]\\d+)?)\\s*%");
        double mkt = Num("marketing[^0-9]*(\\d+(?:[.,]\\d+)?)\\s*%");
        double cost = Num("(?:coût|cost|dépense|opex)[^0-9]*(\\d+(?:[.,]\\d+)?)\\s*%");
        // Nombre associé à un mot-clé, dans les deux ordres (« 20 stagiaires » ou « stagiaires 20 »).
        double NumKw(string kw)
        {
            var m = Regex.Match(s, "(\\d+)\\s*(?:" + kw + ")");
            if (m.Success) return double.Parse(m.Groups[1].Value);
            m = Regex.Match(s, "(?:" + kw + ")[^0-9]*(\\d+)");
            return m.Success ? double.Parse(m.Groups[1].Value) : double.NaN;
        }
        double hire = NumKw("embauch\\w*|recrut\\w*|hire|ingénieur\\w*|engineer|développeur\\w*|consultant\\w*");
        double fire = NumKw("licenci\\w*|layoff|supprim\\w*");
        double interns = NumKw("stagiaire\\w*|intern\\w*|alternant\\w*");

        NewService? svc = null;
        int headcountDelta = !double.IsNaN(fire) ? -(int)fire : !double.IsNaN(hire) ? (int)hire : 0;
        if (!double.IsNaN(interns))
        {
            // Stagiaires : pas au salaire plein — modélisés comme un programme (coût réduit).
            var n = (int)interns;
            svc = new NewService(lang == "en" ? "Internship program" : "Programme de stagiaires", lang == "en" ? "Team" : "Équipe", n * 26_000, n * 20_000, n);
        }
        else if (Regex.IsMatch(s, "bureau|office|agence|site|succursale"))
        {
            svc = new NewService(lang == "en" ? "New office" : "Nouveau bureau", lang == "en" ? "Site" : "Site", revenue * 0.02, revenue * 0.015, 12);
        }
        else if (Regex.IsMatch(s, "service|produit|product|offre|lancer|launch|nouveau|new "))
        {
            var rev = revenue * 0.03;
            svc = new NewService(lang == "en" ? "New service" : "Nouveau service", lang == "en" ? "Service" : "Service", rev, rev * 0.6, (int)Math.Round(rev / 250_000));
        }

        var eff = new DecisionEffect(
            PricePct: double.IsNaN(price) ? 0 : (Down() ? -price : price),
            VolumePct: double.IsNaN(sales) ? 0 : (Down() ? -sales : sales),
            HeadcountDelta: headcountDelta,
            SalaryPct: 0,
            MarketingPct: double.IsNaN(mkt) ? 0 : (Down() ? -mkt : mkt),
            CogsPts: !double.IsNaN(cost) && Down() ? -cost : 0,
            NewService: svc,
            Interpretation: lang == "en"
                ? "Interpreted with rule-based parsing (no AI key configured). Configure an AI model for richer analysis."
                : "Interprété par règles (aucune clé IA configurée). Configurez un modèle IA pour une analyse plus riche.",
            Assumptions: lang == "en" ? ["Levers held over the horizon", "Demo data"] : ["Leviers constants sur l'horizon", "Données de démo"],
            Risks: lang == "en" ? ["No competitive response modeled"] : ["Aucune réponse concurrentielle modélisée"],
            Confidence: 0.55, AiUsed: false);
        return eff;
    }
}
