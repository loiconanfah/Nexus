namespace Nexus.Api.Business;

/// <summary>
/// Assemble le modèle d'entreprise pour un tenant. Le tenant de démo (CGI) reçoit
/// un modèle financier riche et cohérent — la MÊME entreprise que le graphe de
/// dépendances (couche business superposée à la couche opérationnelle). Les
/// autres tenants ne sont pas encore modélisés (Configured=false) : aucune donnée
/// fictive n'est présentée comme réelle.
/// </summary>
public static class EnterpriseModelProvider
{
    private static readonly Guid DemoTenant = Guid.Parse("c6100000-cf1c-4000-8000-000000000001");
    private const string Currency = "CAD";

    // Leviers de démo (CGI, services-conseils TI) — cohérents entre eux.
    public static BusinessDrivers DemoDrivers() => new(
        Units: 4200, AvgPrice: 100_000, CogsPercent: 0.63,
        Headcount: 2400, AvgSalary: 95_000, BillableRatio: 0.70,
        Marketing: 14_000_000, RnD: 18_000_000, GA: 20_000_000,
        Depreciation: 12_000_000, TaxRate: 0.26, Interest: 3_000_000,
        CashOnHand: 85_000_000, ChurnRate: 0.08);

    public static EnterpriseModel ForTenant(Guid tenant)
    {
        if (tenant != DemoTenant)
        {
            // Non modélisé : renvoyer un état vide explicite.
            var empty = new BusinessDrivers(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            var emptyPnl = new ProfitAndLoss(0, 0, 0, 0, new OpexBreakdown(0, 0, 0, 0, 0), 0, 0, 0, 0, 0, 0, 0, 0);
            return new EnterpriseModel(false, false, Currency,
                new CompanyProfile("—", "—", 0, 0, 0, 0, 0, 0, 0), empty, emptyPnl,
                new CashModel(0, 0, 0), [], [], [], [], [], new DomainQuality(0, 0, 0, 0, 0));
        }

        var d = DemoDrivers();
        var pnl = BusinessModelEngine.ComputePnl(d);
        var cash = BusinessModelEngine.ComputeCash(d, pnl);
        var trend = BusinessModelEngine.BuildTrend(pnl, cash);

        var company = new CompanyProfile(
            Name: "CGI Inc.", Industry: "Services-conseils TI",
            Employees: 2400, AnnualRevenue: (long)pnl.Revenue,
            Divisions: 6, Locations: 5, Customers: 640, Suppliers: 1200, Projects: 320);

        var divisions = new List<DivisionLine>
        {
            new("Services-conseils", 96_000_000, 8_640_000, 520, 0.09),
            new("Gestion d'applications", 108_000_000, 11_880_000, 640, 0.11),
            new("Infrastructure gérée", 84_000_000, 5_880_000, 430, 0.07),
            new("Solutions IP", 42_000_000, 7_560_000, 210, 0.18),
            new("Secteur public", 60_000_000, 3_600_000, 360, 0.06),
            new("Services financiers", 30_000_000, 2_400_000, 240, 0.08),
        };

        var segments = new List<SegmentLine>
        {
            new("Secteur public", 130_000_000, 180, 130.0 / 420),
            new("Services financiers", 105_000_000, 90, 105.0 / 420),
            new("Télécom & médias", 76_000_000, 140, 76.0 / 420),
            new("Santé", 63_000_000, 120, 63.0 / 420),
            new("Manufacturier & distribution", 46_000_000, 110, 46.0 / 420),
        };

        var rev = pnl.Revenue;
        var costs = new List<CostLine>
        {
            new("delivery", pnl.Cogs, pnl.Cogs / rev),
            new("sgaSalaries", pnl.Opex.SgaSalaries, pnl.Opex.SgaSalaries / rev),
            new("ga", pnl.Opex.GA, pnl.Opex.GA / rev),
            new("rnd", pnl.Opex.RnD, pnl.Opex.RnD / rev),
            new("marketing", pnl.Opex.Marketing, pnl.Opex.Marketing / rev),
            new("depreciation", pnl.Depreciation, pnl.Depreciation / rev),
        };

        var revPerEmp = pnl.Revenue / company.Employees;
        var kpis = new List<Kpi>
        {
            new("revenue", pnl.Revenue, Currency, 4.2),
            new("ebitdaMargin", pnl.EbitdaMargin * 100, "%", 0.6),
            new("netMargin", pnl.NetMargin * 100, "%", 0.3),
            new("headcount", company.Employees, "", 3.5),
            new("revenuePerEmployee", revPerEmp, Currency, 0.7),
            new("customers", company.Customers, "", 2.1),
            new("cashOnHand", cash.CashOnHand, Currency, 5.4),
            new("churn", d.ChurnRate * 100, "%", -0.4),
        };

        var quality = new DomainQuality(Finance: 96, Sales: 89, Hr: 92, Operations: 85, Customers: 88);

        return new EnterpriseModel(true, true, Currency, company, d, pnl, cash, trend, divisions, segments, costs, kpis, quality);
    }
}
