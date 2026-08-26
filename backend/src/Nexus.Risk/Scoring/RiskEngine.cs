namespace Nexus.Risk.Scoring;

/// <summary>
/// Moteur de risque déterministe et EXPLICABLE (article 14). Calcule un score
/// 0-100 comme moyenne pondérée des facteurs normalisés, et expose la
/// contribution de chaque facteur (aucune boîte noire — ADR-0007).
/// La formule et les coefficients ne sont jamais hardcodés : ils proviennent du
/// <see cref="RiskWeights"/> et des <see cref="RiskThresholds"/> du tenant.
/// </summary>
public sealed class RiskEngine
{
    public RiskAssessment Assess(RiskInput input, RiskWeights? weights = null, RiskThresholds? thresholds = null)
    {
        weights ??= RiskWeights.Default;
        thresholds ??= RiskThresholds.Default;

        var total = weights.Total;
        if (total <= 0)
        {
            throw new InvalidOperationException("La somme des poids de risque doit être strictement positive.");
        }

        var factors = new (string Factor, double Value, double Weight)[]
        {
            ("Criticality", Clamp01(input.Criticality), weights.Criticality),
            ("PropagationPotential", Clamp01(input.PropagationPotential), weights.PropagationPotential),
            ("Concentration", Clamp01(input.Concentration), weights.Concentration),
            ("DependencyDepth", Clamp01(input.DependencyDepth), weights.DependencyDepth),
            ("LackOfRedundancy", Clamp01(input.LackOfRedundancy), weights.LackOfRedundancy),
            ("Uncertainty", Clamp01(input.Uncertainty), weights.Uncertainty)
        };

        var breakdown = new List<RiskFactorContribution>(factors.Length);
        double score = 0;

        foreach (var (factor, value, weight) in factors)
        {
            var points = 100.0 * value * weight / total;   // contribution en points au score final
            score += points;
            breakdown.Add(new RiskFactorContribution(factor, value, weight, Math.Round(points, 2)));
        }

        score = Math.Round(Math.Clamp(score, 0, 100), 2);

        // Décomposition triée par contribution décroissante (le « pourquoi » en tête).
        breakdown.Sort((a, b) => b.Points.CompareTo(a.Points));

        return new RiskAssessment(score, thresholds.BandFor(score), breakdown);
    }

    private static double Clamp01(double v) => double.IsNaN(v) ? 0 : Math.Clamp(v, 0, 1);
}
