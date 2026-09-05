namespace Nexus.Risk;

/// <summary>
/// Réglages configurables PAR TENANT du modèle d'impact financier. Permet à un
/// client d'adapter les hypothèses par défaut à sa réalité : paliers de coût
/// d'arrêt horaire (par criticité), multiplicateur de RTO, et courbe de
/// probabilité de propagation. Un coût RÉEL saisi par actif prime toujours sur
/// ces paliers (cf. <see cref="BusinessImpactModel.CostPerHour(int, double?, ImpactTuning)"/>).
/// </summary>
public sealed record ImpactTuning(
    long CostVeryHigh,   // criticité ≥ 90
    long CostHigh,       // ≥ 80
    long CostElevated,   // ≥ 70
    long CostSignificant,// ≥ 60
    long CostModerate,   // ≥ 40
    long CostLow,        // ≥ 20
    long CostMinimal,    // < 20
    double RtoMultiplier,     // échelle globale des temps de rétablissement
    double ProbabilityDecay,  // base de décroissance par saut (0–1)
    double ProbabilityFloor)  // plancher de probabilité
{
    /// <summary>Valeurs par défaut du produit (hypothèses représentatives).</summary>
    public static ImpactTuning Default => new(
        CostVeryHigh: 50_000, CostHigh: 25_000, CostElevated: 15_000, CostSignificant: 10_000,
        CostModerate: 3_000, CostLow: 800, CostMinimal: 200,
        RtoMultiplier: 1.0, ProbabilityDecay: 0.92, ProbabilityFloor: 0.25);
}

/// <summary>
/// Modèle d'impact financier (article 15). Estime un COÛT D'ARRÊT HORAIRE par
/// actif à partir de sa criticité — déterministe et explicable. Deux niveaux de
/// personnalisation : (1) un coût RÉEL par actif prime sur l'estimation ; (2) les
/// paliers/courbes sont réglables par tenant via <see cref="ImpactTuning"/>.
/// </summary>
public static class BusinessImpactModel
{
    /// <summary>Coût d'arrêt estimé par heure selon la criticité, avec réglages par tenant.</summary>
    public static long CostPerHour(int criticality, ImpactTuning t) => criticality switch
    {
        >= 90 => t.CostVeryHigh,
        >= 80 => t.CostHigh,
        >= 70 => t.CostElevated,
        >= 60 => t.CostSignificant,
        >= 40 => t.CostModerate,
        >= 20 => t.CostLow,
        _ => t.CostMinimal,
    };

    /// <summary>Coût d'arrêt estimé par heure selon la criticité (réglages par défaut).</summary>
    public static long CostPerHour(int criticality) => CostPerHour(criticality, ImpactTuning.Default);

    /// <summary>
    /// Coût d'arrêt par heure d'un actif : utilise le coût RÉEL fourni par le
    /// client (import/saisie) s'il est présent (&gt; 0), sinon l'estimation par
    /// paliers de criticité (réglables par tenant). Le chiffrage devient ainsi
    /// celui du client dès qu'il renseigne ses vrais coûts.
    /// </summary>
    public static long CostPerHour(int criticality, double? realCostPerHour, ImpactTuning t)
        => realCostPerHour is > 0 ? (long)Math.Round(realCostPerHour.Value) : CostPerHour(criticality, t);

    /// <summary>Surcharge avec réglages par défaut.</summary>
    public static long CostPerHour(int criticality, double? realCostPerHour)
        => CostPerHour(criticality, realCostPerHour, ImpactTuning.Default);

    /// <summary>Base de RTO (heures) par type d'actif, avant modulation par la criticité.</summary>
    public static double RtoBase(string entityType) => entityType switch
    {
        "Database" or "System" or "Infrastructure" or "DataStore" => 8.0,
        "Server" or "CloudResource" or "Network" or "Device" => 6.0,
        "Application" or "Service" => 3.0,
        "BusinessProcess" or "BusinessService" or "Process" => 4.0,
        "Supplier" => 24.0,
        "Contract" => 72.0,
        "Person" or "Role" or "Team" => 48.0,
        "Location" => 12.0,
        // Couche IA : un modèle/endpoint se re-bascule vite ; un fournisseur IA
        // externe et un ré-entraînement de dataset sont plus lents.
        "AiModel" or "ModelEndpoint" or "AiService" => 4.0,
        "AiAgent" or "AiWorkflow" => 5.0,
        "AiProvider" => 24.0,
        "Dataset" => 12.0,
        _ => 6.0,
    };

    /// <summary>
    /// RTO estimé (heures de rétablissement) : base par type × modulation par la
    /// criticité × multiplicateur du tenant.
    /// </summary>
    public static double RtoHours(string entityType, int criticality, ImpactTuning t)
        => Math.Round(RtoBase(entityType) * (0.75 + 0.5 * criticality / 100.0) * t.RtoMultiplier, 1);

    /// <summary>RTO estimé avec réglages par défaut.</summary>
    public static double RtoHours(string entityType, int criticality)
        => RtoHours(entityType, criticality, ImpactTuning.Default);

    /// <summary>
    /// Probabilité qu'un actif soit RÉELLEMENT impacté par la cascade, décroissante
    /// avec la profondeur (l'incertitude augmente à chaque saut), réglable par tenant.
    /// </summary>
    public static double FailureProbability(int depth, ImpactTuning t)
        => Math.Round(Math.Clamp(Math.Pow(t.ProbabilityDecay, Math.Max(0, depth)), t.ProbabilityFloor, 1.0), 3);

    /// <summary>Probabilité de propagation avec réglages par défaut.</summary>
    public static double FailureProbability(int depth)
        => FailureProbability(depth, ImpactTuning.Default);
}
