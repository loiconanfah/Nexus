namespace Nexus.Risk;

/// <summary>
/// Étalonnage du coût d'interruption sur les chiffres réels de l'organisation.
///
/// Les paliers par défaut (50 000 / h pour un actif très critique…) sont des
/// montants en dollars canadiens pensés pour une grande entreprise : appliqués
/// tels quels à une microfinance en francs CFA, ils donneraient des chiffres
/// absurdes. On les recalcule à partir du chiffre d'affaires HORAIRE de
/// l'organisation, en conservant exactement les proportions des paliers par
/// défaut — si bien qu'un espace dont le revenu horaire vaut 100 000 retrouve
/// les valeurs par défaut à l'identique.
/// </summary>
public static class ImpactCalibration
{
    public const double HoursPerYear24x7 = 8_760;
    public const double DefaultBusinessHours = 2_600;
    private const double WeeksPerYear = 52;

    /// <summary>
    /// Heures de fonctionnement par an. En continu : 8 760. Sinon, les horaires
    /// d'ouverture réels de l'organisation (jours par semaine × heures par jour ×
    /// 52) ; à défaut, la valeur d'usage de 2 600 h.
    /// </summary>
    public static double OperatingHoursPerYear(string? mode, int? daysPerWeek = null, int? hoursPerDay = null)
    {
        if (mode == "24x7") return HoursPerYear24x7;
        if (daysPerWeek == 7 && hoursPerDay == 24) return HoursPerYear24x7;   // ouvert en permanence
        if (daysPerWeek is > 0 and <= 7 && hoursPerDay is > 0 and <= 24)
            return daysPerWeek.Value * hoursPerDay.Value * WeeksPerYear;
        return DefaultBusinessHours;
    }

    /// <summary>Part du chiffre d'affaires horaire perdue selon le palier de criticité.</summary>
    private static readonly (double VeryHigh, double High, double Elevated, double Significant,
        double Moderate, double Low, double Minimal) Share = (0.50, 0.25, 0.15, 0.10, 0.03, 0.008, 0.002);

    public static double HourlyRevenue(double annualRevenue, string? mode, int? daysPerWeek = null, int? hoursPerDay = null)
        => annualRevenue <= 0 ? 0 : annualRevenue / OperatingHoursPerYear(mode, daysPerWeek, hoursPerDay);

    /// <summary>Paliers de coût d'arrêt calculés depuis le revenu ; délais et probabilités inchangés.</summary>
    public static ImpactTuning FromRevenue(double annualRevenue, string? mode, int? daysPerWeek = null, int? hoursPerDay = null)
    {
        var hourly = HourlyRevenue(annualRevenue, mode, daysPerWeek, hoursPerDay);
        var d = ImpactTuning.Default;
        if (hourly <= 0) return d;

        long Round(double share) => Math.Max(1, (long)Math.Round(hourly * share));
        return d with
        {
            CostVeryHigh = Round(Share.VeryHigh),
            CostHigh = Round(Share.High),
            CostElevated = Round(Share.Elevated),
            CostSignificant = Round(Share.Significant),
            CostModerate = Round(Share.Moderate),
            CostLow = Round(Share.Low),
            CostMinimal = Round(Share.Minimal),
        };
    }
}
