using Nexus.Domain.ValueObjects;
using Nexus.Graph;

namespace Nexus.Risk;

/// <summary>Solidité globale des preuves qui soutiennent une cascade.</summary>
public enum EvidenceQuality
{
    /// <summary>Aucune dépendance fragile ni non validée.</summary>
    Solid = 0,

    /// <summary>Quelques maillons faibles, l'essentiel est étayé.</summary>
    Moderate = 1,

    /// <summary>Une part notable de la cascade repose sur du non validé.</summary>
    Fragile = 2,
}

/// <summary>Un maillon faible de la cascade, nommé, pour pouvoir aller le corriger.</summary>
public sealed record WeakLink(
    Guid Id,
    string Source,
    string Target,
    string Type,
    double Confidence,
    string Status,
    string? TopEvidence);

/// <summary>
/// Qualité des preuves sur lesquelles repose un chiffrage d'impact. C'est ce qui
/// permet de dire « 4,7 M$ — dont 3 des 11 dépendances ne reposent que sur une
/// inférence IA non validée » au lieu de livrer un nombre opaque.
/// </summary>
public sealed record CascadeEvidence(
    int RelationsTotal,
    int Verified,
    int Solid,
    int Weak,
    int Unvalidated,
    double AverageConfidence,
    double WeakestConfidence,
    EvidenceQuality Quality,
    IReadOnlyList<WeakLink> WeakestLinks)
{
    public static CascadeEvidence Empty => new(0, 0, 0, 0, 0, 0, 0, EvidenceQuality.Solid, []);
}

/// <summary>
/// Évalue la solidité des dépendances traversées par une cascade. Les arêtes
/// dont les DEUX extrémités appartiennent au périmètre affecté sont exactement
/// les chemins de dépendance qui ont produit la propagation : on les note sans
/// avoir à modifier le moteur de propagation.
/// </summary>
public static class CascadeEvidenceAnalyzer
{
    /// <summary>Au-dessus : la dépendance est considérée comme bien étayée.</summary>
    public const double SolidThreshold = 0.75;

    /// <summary>En dessous : maillon faible.</summary>
    public const double WeakThreshold = 0.50;

    public static CascadeEvidence Analyze(
        IReadOnlyCollection<Guid> scope,
        IReadOnlyList<GraphEdgeRecord> allEdges,
        IReadOnlyDictionary<Guid, string> nameById,
        int maxWeakLinks = 5)
    {
        if (scope.Count == 0) return CascadeEvidence.Empty;

        var ids = scope as HashSet<Guid> ?? [.. scope];
        var edges = allEdges.Where(e => ids.Contains(e.Source) && ids.Contains(e.Target)).ToList();
        if (edges.Count == 0) return CascadeEvidence.Empty;

        string Name(Guid id) => nameById.TryGetValue(id, out var n) ? n : id.ToString()[..8];

        var verified = edges.Count(e => string.Equals(e.Status, "Verified", StringComparison.OrdinalIgnoreCase));
        var unvalidated = edges.Count(e => string.Equals(e.Status, "AiSuggested", StringComparison.OrdinalIgnoreCase));
        var solid = edges.Count(e => e.Confidence >= SolidThreshold);
        var weak = edges.Count(e => e.Confidence < WeakThreshold);

        var weakest = edges
            .OrderBy(e => e.Confidence)
            .Take(Math.Max(0, maxWeakLinks))
            .Where(e => e.Confidence < SolidThreshold)
            .Select(e => new WeakLink(
                e.Id, Name(e.Source), Name(e.Target), e.Type,
                Math.Round(e.Confidence, 3), e.Status,
                TopObservation(e)))
            .ToList();

        // Fragile dès qu'un cinquième de la cascade n'est pas étayé ; solide
        // seulement si rien n'est faible NI non validé.
        var unsupported = edges.Count(e => e.Confidence < WeakThreshold ||
            string.Equals(e.Status, "AiSuggested", StringComparison.OrdinalIgnoreCase));
        var share = (double)unsupported / edges.Count;
        var quality = unsupported == 0 ? EvidenceQuality.Solid
            : share <= 0.20 ? EvidenceQuality.Moderate
            : EvidenceQuality.Fragile;

        return new CascadeEvidence(
            edges.Count, verified, solid, weak, unvalidated,
            Math.Round(edges.Average(e => e.Confidence), 3),
            Math.Round(edges.Min(e => e.Confidence), 3),
            quality,
            weakest);
    }

    /// <summary>Observation la plus contributive de l'arête, pour expliquer d'où vient la confiance.</summary>
    private static string? TopObservation(GraphEdgeRecord edge)
    {
        var evidences = edge.Evidences;
        if (evidences is null || evidences.Count == 0) return edge.Evidence;
        var now = DateTimeOffset.UtcNow;
        return evidences.OrderByDescending(e => e.Effective(now)).First().Observation;
    }

    /// <summary>Phrase prête à afficher, dans la langue de l'utilisateur.</summary>
    public static string Summarize(CascadeEvidence e, string lang)
    {
        var fr = lang != "en";
        if (e.RelationsTotal == 0)
            return fr ? "Aucune dépendance traversée." : "No dependency traversed.";

        var unsupported = e.Weak + e.Unvalidated;
        if (unsupported == 0)
            return fr
                ? $"Les {e.RelationsTotal} dépendances de cette cascade sont étayées ({e.Verified} validées)."
                : $"All {e.RelationsTotal} dependencies in this cascade are supported ({e.Verified} verified).";

        return fr
            ? $"{unsupported} des {e.RelationsTotal} dépendances de cette cascade ne sont pas validées — confiance moyenne {e.AverageConfidence:P0}."
            : $"{unsupported} of {e.RelationsTotal} dependencies in this cascade are unvalidated — average confidence {e.AverageConfidence:P0}.";
    }
}
