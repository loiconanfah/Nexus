namespace Nexus.Domain.ValueObjects;

/// <summary>Contribution d'une preuve au score, pour l'affichage décomposé.</summary>
public sealed record ConfidenceContribution(
    EvidenceSource Source,
    string Observation,
    DateTimeOffset CollectedAt,
    double Weight,
    double Freshness,
    double Effective,
    double ScoreAfter);

/// <summary>Score de confiance calculé, avec le détail de ce qui l'a produit.</summary>
public sealed record ConfidenceBreakdown(
    double Score,
    ConfidenceStatus Status,
    IReadOnlyList<ConfidenceContribution> Contributions);

/// <summary>
/// Calcule la confiance d'une relation À PARTIR DE SES PREUVES, de façon
/// déterministe et explicable (même philosophie que le RiskEngine).
///
/// Combinaison à rendements décroissants (« noisy-OR ») :
///     confiance = 1 − Π (1 − fiabilitéᵢ × fraîcheurᵢ)
///
/// Conséquences voulues :
/// • une preuve isolée de fiabilité w donne exactement w (rétro-compatible) ;
/// • des preuves INDÉPENDANTES se renforcent sans jamais dépasser 1 ;
/// • aucune preuve faible ne peut à elle seule produire une quasi-certitude ;
/// • une preuve ancienne se décote au lieu de disparaître.
/// </summary>
public static class ConfidenceEngine
{
    /// <summary>Plancher de fraîcheur : une preuve ancienne compte encore un peu.</summary>
    public const double FreshnessFloor = 0.25;

    public static ConfidenceBreakdown Evaluate(
        IReadOnlyList<RelationEvidence> evidences,
        DateTimeOffset asOf)
    {
        if (evidences.Count == 0)
        {
            return new ConfidenceBreakdown(0.0, ConfidenceStatus.Unknown, []);
        }

        // Les preuves les plus contributives d'abord : la décomposition affichée
        // montre alors clairement l'effet de rendement décroissant.
        var ordered = evidences.OrderByDescending(e => e.Effective(asOf)).ToList();

        var contributions = new List<ConfidenceContribution>(ordered.Count);
        var remaining = 1.0; // Π (1 − effectiveᵢ)

        foreach (var e in ordered)
        {
            var effective = e.Effective(asOf);
            remaining *= 1.0 - effective;
            contributions.Add(new ConfidenceContribution(
                e.Source, e.Observation, e.CollectedAt,
                Math.Round(e.Weight, 3),
                Math.Round(e.Freshness(asOf), 3),
                Math.Round(effective, 3),
                Math.Round(1.0 - remaining, 3)));
        }

        var score = Math.Clamp(Math.Round(1.0 - remaining, 3), 0.0, 1.0);
        return new ConfidenceBreakdown(score, DeriveStatus(evidences), contributions);
    }

    /// <summary>Score seul (sans décomposition).</summary>
    public static double Score(IReadOnlyList<RelationEvidence> evidences, DateTimeOffset asOf)
        => Evaluate(evidences, asOf).Score;

    /// <summary>
    /// Statut dérivé de la MEILLEURE source disponible. Préserve ADR-0006 : une
    /// relation soutenue uniquement par l'IA reste AiSuggested et n'entre donc
    /// pas dans les calculs « fermes ».
    /// </summary>
    public static ConfidenceStatus DeriveStatus(IReadOnlyList<RelationEvidence> evidences)
    {
        if (evidences.Count == 0) return ConfidenceStatus.Unknown;
        // L'enum EvidenceSource est ordonnée de la plus fiable à la moins fiable.
        var best = evidences.Min(e => e.Source);
        return best.ImpliedStatus();
    }
}
