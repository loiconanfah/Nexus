namespace Nexus.Risk;

/// <summary>
/// Modèle d'impact financier (article 15). Estime un COÛT D'ARRÊT HORAIRE par
/// actif à partir de sa criticité — déterministe et explicable. Représentatif :
/// destiné à être surchargé par des coûts réels par actif lorsqu'ils sont
/// fournis (import). Sert la simulation (impact € d'une défaillance) et
/// l'exposition financière globale.
/// </summary>
public static class BusinessImpactModel
{
    /// <summary>Coût d'arrêt estimé par heure (devise abstraite), selon la criticité 0-100.</summary>
    public static long CostPerHour(int criticality) => criticality switch
    {
        >= 90 => 50_000,
        >= 80 => 25_000,
        >= 70 => 15_000,
        >= 60 => 10_000,
        >= 40 => 3_000,
        >= 20 => 800,
        _ => 200,
    };
}
