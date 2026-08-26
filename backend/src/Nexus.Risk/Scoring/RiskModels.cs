using Nexus.Domain.ValueObjects;

namespace Nexus.Risk.Scoring;

/// <summary>
/// Facteurs de risque normalisés [0, 1] pour une entité (article 14). Chaque
/// facteur est calculé de façon déterministe à partir du graphe et de l'entité,
/// puis pondéré par le <see cref="RiskWeights"/> du tenant.
/// </summary>
public sealed record RiskInput(
    double Criticality,            // criticité effective / 100
    double PropagationPotential,   // rayon d'explosion normalisé
    double Concentration,          // dépendants directs normalisés
    double DependencyDepth,        // profondeur de ses propres dépendances normalisée
    double LackOfRedundancy,       // 1 si aucune redondance, sinon 0
    double Uncertainty);           // 1 - confiance moyenne des dépendances

/// <summary>
/// Pondérations configurables du Risk Engine (article 14 : jamais hardcodé,
/// stocké par tenant dans <c>risk_profile.weights</c>). Le moteur normalise par
/// la somme des poids, donc les valeurs sont relatives.
/// </summary>
public sealed record RiskWeights(
    double Criticality = 0.30,
    double PropagationPotential = 0.25,
    double Concentration = 0.15,
    double DependencyDepth = 0.10,
    double LackOfRedundancy = 0.15,
    double Uncertainty = 0.05)
{
    public static RiskWeights Default { get; } = new();

    public double Total =>
        Criticality + PropagationPotential + Concentration + DependencyDepth + LackOfRedundancy + Uncertainty;
}

/// <summary>Seuils de bande de risque (article 14). Configurable par tenant.</summary>
public sealed record RiskThresholds(int Low = 20, int Moderate = 40, int Elevated = 60, int High = 80)
{
    public static RiskThresholds Default { get; } = new();

    public RiskBand BandFor(double score) => score switch
    {
        _ when score <= Low => RiskBand.Low,
        _ when score <= Moderate => RiskBand.Moderate,
        _ when score <= Elevated => RiskBand.Elevated,
        _ when score <= High => RiskBand.High,
        _ => RiskBand.Critical
    };
}

/// <summary>Contribution explicable d'un facteur au score final (article 14/22).</summary>
public sealed record RiskFactorContribution(string Factor, double Value, double Weight, double Points);

/// <summary>Évaluation de risque : score 0-100, bande, et décomposition explicable.</summary>
public sealed record RiskAssessment(
    double Score,
    RiskBand Band,
    IReadOnlyList<RiskFactorContribution> Breakdown);
