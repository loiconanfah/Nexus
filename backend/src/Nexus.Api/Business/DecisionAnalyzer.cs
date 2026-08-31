using System.Text.Json;
using System.Text.RegularExpressions;
using Nexus.AI;

namespace Nexus.Api.Business;

public sealed record DecisionAnalysis(
    string Headline, string Narrative, IReadOnlyList<string> Consequences,
    IReadOnlyList<string> Risks, string Recommendation, string Verdict, bool AiUsed);

/// <summary>
/// « AI Decision Analyst » : rédige une analyse compréhensible d'une décision,
/// ancrée sur l'impact CALCULÉ (déterministe). Le LLM ne fait que formuler à
/// partir des chiffres fournis ; sans clé, un gabarit riche prend le relais.
/// </summary>
public sealed class DecisionAnalyzer(IChatCompletion chat)
{
    private sealed record M(double Revenue, double GrossProfit, double Ebitda, double NetProfit, double Ocf, int Headcount, double NetMargin, double EbitdaMargin);

    private static M Compute(BusinessDrivers d, DecisionEffect e)
    {
        var avgPrice = d.AvgPrice * (1 + e.PricePct / 100);
        var units = d.Units * (1 + e.VolumePct / 100);
        var headcount = Math.Max(0, d.Headcount + e.HeadcountDelta);
        var avgSalary = d.AvgSalary * (1 + e.SalaryPct / 100);
        var marketing = d.Marketing * (1 + e.MarketingPct / 100);
        var cogsPercent = Math.Clamp(d.CogsPercent + e.CogsPts / 100, 0.1, 0.95);
        var svcRev = e.NewService?.AnnualRevenue ?? 0;
        var svcCost = e.NewService?.AnnualCost ?? 0;
        var svcHc = e.NewService?.Headcount ?? 0;
        var revenue = units * avgPrice + svcRev;
        var cogs = units * avgPrice * cogsPercent + svcCost * 0.65;
        var grossProfit = revenue - cogs;
        var sga = headcount * avgSalary * (1 - d.BillableRatio);
        var opex = sga + marketing + d.RnD + d.GA + svcCost * 0.35;
        var ebitda = grossProfit - opex;
        var ebit = ebitda - d.Depreciation;
        var taxable = Math.Max(0, ebit - d.Interest);
        var net = ebit - d.Interest - taxable * d.TaxRate;
        var ocf = net + d.Depreciation - revenue * 0.015;
        return new M(revenue, grossProfit, ebitda, net, ocf, headcount + svcHc, net / revenue, ebitda / revenue);
    }

    private static readonly DecisionEffect Zero = new(0, 0, 0, 0, 0, 0, null, "", [], [], 0, false);

    public async Task<DecisionAnalysis> AnalyzeAsync(string text, BusinessDrivers d, DecisionEffect e, string lang, CancellationToken ct)
    {
        var b = Compute(d, Zero);
        var s = Compute(d, e);
        var netPct = (s.NetProfit - b.NetProfit) / Math.Abs(b.NetProfit) * 100;
        var revPct = (s.Revenue - b.Revenue) / b.Revenue * 100;
        var verdict = netPct >= 5 && s.Ocf >= b.Ocf * 0.95 ? "Favorable" : netPct <= -5 || s.Ocf < 0 ? "Risque" : "Mitigé";

        if (chat.IsConfigured)
        {
            var ai = await TryAiAsync(text, e, b, s, netPct, revPct, verdict, lang, ct);
            if (ai is not null) return ai;
        }
        return Deterministic(e, b, s, netPct, revPct, verdict, lang);
    }

    private async Task<DecisionAnalysis?> TryAiAsync(string text, DecisionEffect e, M b, M s, double netPct, double revPct, string verdict, string lang, CancellationToken ct)
    {
        string Money(double v) => $"{v / 1e6:F1} M CAD";
        var facts =
            $"Décision : {text}\n" +
            (e.NewService is not null ? $"Nouvel élément : {e.NewService.Name} ({e.NewService.Division}), revenu {Money(e.NewService.AnnualRevenue)}, coût {Money(e.NewService.AnnualCost)}, {e.NewService.Headcount} personnes.\n" : "") +
            $"Revenu : {Money(b.Revenue)} → {Money(s.Revenue)} ({revPct:+0.0;-0.0}%)\n" +
            $"EBITDA : {Money(b.Ebitda)} → {Money(s.Ebitda)}\n" +
            $"Résultat net : {Money(b.NetProfit)} → {Money(s.NetProfit)} ({netPct:+0.0;-0.0}%)\n" +
            $"Trésorerie d'exploitation : {Money(b.Ocf)} → {Money(s.Ocf)}\n" +
            $"Effectif : {b.Headcount} → {s.Headcount}\n" +
            $"Marge nette : {b.NetMargin * 100:F1}% → {s.NetMargin * 100:F1}%";

        var system =
            "Tu es un analyste de décision LUCIDE et ÉQUILIBRÉ pour un CEO/CFO — pas un VRP. On te donne une décision et son IMPACT DÉJÀ CALCULÉ. " +
            "Tu produis UNIQUEMENT un JSON strict : {headline (titre court et NEUTRE, sans superlatifs), narrative (2-3 phrases claires et honnêtes, ni jargon ni maths brutes, qui nomment le bénéfice ET la contrepartie/incertitude), " +
            "consequences (tableau de 3-4 conséquences concrètes, financières ET humaines/opérationnelles), risks (tableau de 2-3 risques réels), recommendation (1 phrase actionnable et prudente)}. " +
            "Un investissement (embauche, nouveau service) est un COÛT et un PARI avant d'être un gain : dis-le. Ne survends jamais, ne présente pas un résultat comme acquis, mentionne la montée en charge et l'incertitude. " +
            "N'invente AUCUN chiffre : réutilise uniquement ceux fournis. " +
            $"Rédige en {(lang == "en" ? "anglais" : "français")}.";

        var raw = await chat.CompleteAsync(system, facts, ct);
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try
        {
            var start = raw.IndexOf('{'); var end = raw.LastIndexOf('}');
            var json = start >= 0 && end > start ? raw.Substring(start, end - start + 1) : raw;
            using var doc = JsonDocument.Parse(json);
            var r = doc.RootElement;
            string Str(string k) => r.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString()! : "";
            List<string> Arr(string k) => r.TryGetProperty(k, out var a) && a.ValueKind == JsonValueKind.Array
                ? a.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).ToList() : [];
            var headline = Str("headline");
            if (string.IsNullOrWhiteSpace(headline)) return null;
            return new DecisionAnalysis(headline, Str("narrative"), Arr("consequences"), Arr("risks"), Str("recommendation"), verdict, true);
        }
        catch (JsonException) { return null; }
    }

    private static DecisionAnalysis Deterministic(DecisionEffect e, M b, M s, double netPct, double revPct, string verdict, string lang)
    {
        string Money(double v) => Math.Abs(v) >= 1e6 ? $"{v / 1e6:F1} M$" : $"{v / 1e3:F0} k$";
        var en = lang == "en";
        var netHc = s.Headcount - b.Headcount;
        var newEl = e.NewService;

        var headline = verdict == "Favorable" ? (en ? "A value-creating move" : "Une décision créatrice de valeur")
            : verdict == "Risque" ? (en ? "A risky trade-off" : "Un arbitrage risqué")
            : (en ? "A balanced trade-off" : "Un arbitrage nuancé");

        var narrative = newEl is not null
            ? (en
                ? $"Adding “{newEl.Name}” brings about {Money(newEl.AnnualRevenue)} of annual revenue for {Money(newEl.AnnualCost)} of cost and {newEl.Headcount} people. Net profit moves from {Money(b.NetProfit)} to {Money(s.NetProfit)} ({netPct:+0.0;-0.0}%)."
                : $"Ajouter « {newEl.Name} » apporte ~{Money(newEl.AnnualRevenue)} de revenu annuel pour {Money(newEl.AnnualCost)} de coût et {newEl.Headcount} personne(s). Le résultat net passe de {Money(b.NetProfit)} à {Money(s.NetProfit)} ({netPct:+0.0;-0.0} %). Au-delà des chiffres, c'est un engagement d'équipe et d'exécution.")
            : (en
                ? $"The decision moves revenue by {revPct:+0.0;-0.0}% and net profit from {Money(b.NetProfit)} to {Money(s.NetProfit)}. It reshapes the operating balance more than the top line."
                : $"La décision fait varier le revenu de {revPct:+0.0;-0.0} % et le résultat net de {Money(b.NetProfit)} à {Money(s.NetProfit)}. Elle agit surtout sur l'équilibre d'exploitation, avec des effets concrets pour les équipes.");

        var cons = new List<string>
        {
            en ? $"Net profit {netPct:+0.0;-0.0}% ({Money(b.NetProfit)} → {Money(s.NetProfit)})" : $"Résultat net {netPct:+0.0;-0.0} % ({Money(b.NetProfit)} → {Money(s.NetProfit)})",
            en ? $"Cash flow {Money(b.Ocf)} → {Money(s.Ocf)}" : $"Trésorerie {Money(b.Ocf)} → {Money(s.Ocf)}",
        };
        if (netHc != 0) cons.Add(en ? $"Headcount {netHc:+0;-0} — recruiting, integration and workload to manage" : $"Effectif {netHc:+0;-0} — recrutement, intégration et charge à piloter");
        else cons.Add(en ? "Limited operational change" : "Changement opérationnel limité");

        var risks = new List<string>();
        if (s.Ocf < b.Ocf) risks.Add(en ? "Pressure on cash" : "Pression sur la trésorerie");
        if (e.PricePct > 0) risks.Add(en ? "Customer attrition / competitive response" : "Attrition client / réaction concurrentielle");
        if (netHc < 0) risks.Add(en ? "Social and knowledge-loss impact" : "Impact social et perte de compétences");
        if (newEl is not null) risks.Add(en ? "Execution and market adoption uncertainty" : "Exécution et adoption incertaines");
        if (risks.Count == 0) risks.Add(en ? "Limited downside modeled" : "Risque baissier limité");

        var reco = verdict == "Favorable" ? (en ? "Proceed while securing execution and tracking cash." : "Poursuivre en sécurisant l'exécution et en suivant la trésorerie.")
            : verdict == "Risque" ? (en ? "Reconsider the scope or add safeguards before committing." : "Revoir l'ampleur ou ajouter des garde-fous avant de s'engager.")
            : (en ? "Pilot it in stages with clear checkpoints." : "L'engager par étapes avec des points de contrôle clairs.");

        return new DecisionAnalysis(headline, narrative, cons, risks, reco, verdict, false);
    }
}
