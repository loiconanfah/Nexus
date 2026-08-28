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

    /// <summary>
    /// RTO estimé (heures de rétablissement) selon le type d'actif et la
    /// criticité. Base par type (une base de données se restaure plus lentement
    /// qu'une appli ; un fournisseur/contrat/personne bien plus lentement),
    /// modulée par la criticité. Déterministe et surchargeable.
    /// </summary>
    public static double RtoHours(string entityType, int criticality)
    {
        var b = entityType switch
        {
            "Database" or "System" or "Infrastructure" or "DataStore" => 8.0,
            "Server" or "CloudResource" or "Network" or "Device" => 6.0,
            "Application" or "Service" => 3.0,
            "BusinessProcess" or "BusinessService" or "Process" => 4.0,
            "Supplier" => 24.0,
            "Contract" => 72.0,
            "Person" or "Role" or "Team" => 48.0,
            "Location" => 12.0,
            _ => 6.0,
        };
        return Math.Round(b * (0.75 + 0.5 * criticality / 100.0), 1);
    }

    /// <summary>
    /// Probabilité qu'un actif soit RÉELLEMENT impacté par la cascade, décroissante
    /// avec la profondeur (l'incertitude augmente à chaque saut). Plancher 0,25.
    /// </summary>
    public static double FailureProbability(int depth)
        => Math.Round(Math.Clamp(Math.Pow(0.92, Math.Max(0, depth)), 0.25, 1.0), 3);
}
