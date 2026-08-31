namespace Nexus.Api.Business;

/// <summary>
/// Modèle d'entreprise financier & opérationnel (socle de la couche « Decision
/// Intelligence », article 31). Ce n'est PAS un jeu de cartes statiques : les
/// états financiers sont DÉRIVÉS de leviers (drivers) par une formule
/// déterministe, ce qui permettra aux simulations « What-If » de modifier un
/// levier et de propager les conséquences. Les valeurs de démo sont fictives
/// mais mathématiquement cohérentes.
/// </summary>
public sealed record CompanyProfile(
    string Name, string Industry, int Employees, long AnnualRevenue,
    int Divisions, int Locations, int Customers, int Suppliers, int Projects);

/// <summary>Leviers ajustables du modèle (ce que les scénarios modifieront).</summary>
public sealed record BusinessDrivers(
    int Units,              // volume d'engagements / unités facturables (annuel)
    double AvgPrice,        // prix moyen par unité
    double CogsPercent,     // coût des services rendus (% du revenu)
    int Headcount,          // effectif total
    double AvgSalary,       // salaire chargé moyen
    double BillableRatio,   // part de l'effectif en livraison (déjà dans le COGS)
    double Marketing,       // dépense marketing (annuelle)
    double RnD,             // R&D
    double GA,              // frais généraux & administratifs
    double Depreciation,    // amortissements
    double TaxRate,         // taux d'imposition effectif
    double Interest,        // charges d'intérêts
    double CashOnHand,      // trésorerie disponible
    double ChurnRate);      // taux d'attrition clients

public sealed record OpexBreakdown(double SgaSalaries, double Marketing, double RnD, double GA, double Total);

public sealed record ProfitAndLoss(
    double Revenue, double Cogs, double GrossProfit, double GrossMargin,
    OpexBreakdown Opex, double Ebitda, double EbitdaMargin,
    double Depreciation, double Ebit, double Tax, double Interest,
    double NetProfit, double NetMargin);

public sealed record CashModel(double OperatingCashFlow, double CashOnHand, double FreeCashFlow);

public sealed record TrendPoint(string Month, double Revenue, double Ebitda, double NetProfit, double CashFlow);
public sealed record DivisionLine(string Name, double Revenue, double Profit, int Employees, double Margin);
public sealed record SegmentLine(string Name, double Revenue, int Customers, double Share);
public sealed record CostLine(string Key, double Amount, double Percent);
public sealed record Kpi(string Key, double Value, string Unit, double DeltaPercent);
public sealed record DomainQuality(int Finance, int Sales, int Hr, int Operations, int Customers);

public sealed record EnterpriseModel(
    bool Configured, bool IsDemo, string Currency,
    CompanyProfile Company, BusinessDrivers Drivers, ProfitAndLoss Pnl, CashModel Cash,
    IReadOnlyList<TrendPoint> Trend, IReadOnlyList<DivisionLine> Divisions,
    IReadOnlyList<SegmentLine> Segments, IReadOnlyList<CostLine> CostStructure,
    IReadOnlyList<Kpi> Kpis, DomainQuality DataQuality);

/// <summary>Moteur déterministe : leviers → états financiers dérivés.</summary>
public static class BusinessModelEngine
{
    public static ProfitAndLoss ComputePnl(BusinessDrivers d)
    {
        var revenue = d.Units * d.AvgPrice;
        var cogs = revenue * d.CogsPercent;
        var grossProfit = revenue - cogs;
        // Salaires SG&A = part non facturable de l'effectif (le reste est dans le COGS).
        var sgaSalaries = d.Headcount * d.AvgSalary * (1 - d.BillableRatio);
        var totalOpex = sgaSalaries + d.Marketing + d.RnD + d.GA;
        var ebitda = grossProfit - totalOpex;
        var ebit = ebitda - d.Depreciation;
        var taxable = Math.Max(0, ebit - d.Interest);
        var tax = taxable * d.TaxRate;
        var netProfit = ebit - d.Interest - tax;
        return new ProfitAndLoss(
            revenue, cogs, grossProfit, grossProfit / revenue,
            new OpexBreakdown(sgaSalaries, d.Marketing, d.RnD, d.GA, totalOpex),
            ebitda, ebitda / revenue,
            d.Depreciation, ebit, tax, d.Interest,
            netProfit, netProfit / revenue);
    }

    public static CashModel ComputeCash(BusinessDrivers d, ProfitAndLoss p)
    {
        // Flux d'exploitation ≈ résultat net + amortissements − variation BFR (approx.)
        var workingCapitalDrag = p.Revenue * 0.015;
        var ocf = p.NetProfit + d.Depreciation - workingCapitalDrag;
        var fcf = ocf - d.Depreciation * 0.9; // CAPEX ≈ 90% de l'amortissement
        return new CashModel(ocf, d.CashOnHand, fcf);
    }

    /// <summary>Série mensuelle déterministe (saisonnalité + légère croissance).</summary>
    public static IReadOnlyList<TrendPoint> BuildTrend(ProfitAndLoss annual, CashModel cash)
    {
        string[] months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
        // Poids saisonniers (services : T4 plus fort), normalisés à 12.
        double[] season = [0.90, 0.92, 0.98, 1.00, 1.02, 1.03, 0.95, 0.93, 1.05, 1.08, 1.10, 1.04];
        var sum = season.Sum();
        var list = new List<TrendPoint>();
        for (int i = 0; i < 12; i++)
        {
            var growth = 1 + (i - 5.5) * 0.006; // légère tendance sur l'année
            var w = season[i] / sum * growth;
            list.Add(new TrendPoint(
                months[i],
                Math.Round(annual.Revenue * w),
                Math.Round(annual.Ebitda * w),
                Math.Round(annual.NetProfit * w),
                Math.Round(cash.OperatingCashFlow * w)));
        }
        return list;
    }
}
