namespace Nexus.Api.Business;

/// <summary>
/// Assemble le modele d'entreprise pour un tenant. Deux jeux de demo (CGI, Bell)
/// recoivent un modele financier riche et coherent — la MEME entreprise que leur
/// graphe de dependances (couche business superposee a la couche operationnelle).
/// Les autres tenants ne sont pas modelises (Configured=false) : aucune donnee
/// fictive n'est presentee comme reelle. Chiffres de demo SYNTHETIQUES.
/// </summary>
public static class EnterpriseModelProvider
{
    private static readonly Guid CgiTenant = Guid.Parse("c6100000-cf1c-4000-8000-000000000001");
    private static readonly Guid BellTenant = Guid.Parse("be110000-cf1c-4000-8000-000000000002");
    private const string Currency = "CAD";

    // ── Leviers CGI (services-conseils TI) ──
    public static BusinessDrivers DemoDrivers() => new(
        Units: 4200, AvgPrice: 100_000, CogsPercent: 0.63,
        Headcount: 2400, AvgSalary: 95_000, BillableRatio: 0.70,
        Marketing: 14_000_000, RnD: 18_000_000, GA: 20_000_000,
        Depreciation: 12_000_000, TaxRate: 0.26, Interest: 3_000_000,
        CashOnHand: 85_000_000, ChurnRate: 0.08);

    // ── Leviers Bell (telecom : abonnes x ARPU annuel, capital-intensif) ──
    public static BusinessDrivers BellDrivers() => new(
        Units: 9_200_000, AvgPrice: 640, CogsPercent: 0.38,
        Headcount: 19_000, AvgSalary: 82_000, BillableRatio: 0.60,
        Marketing: 320_000_000, RnD: 100_000_000, GA: 400_000_000,
        Depreciation: 1_050_000_000, TaxRate: 0.26, Interest: 260_000_000,
        CashOnHand: 750_000_000, ChurnRate: 0.13);

    public static EnterpriseModel ForTenant(Guid tenant)
    {
        if (tenant == CgiTenant) return BuildCgi();
        if (tenant == BellTenant) return BuildBell();

        var empty = new BusinessDrivers(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        var emptyPnl = new ProfitAndLoss(0, 0, 0, 0, new OpexBreakdown(0, 0, 0, 0, 0), 0, 0, 0, 0, 0, 0, 0, 0);
        return new EnterpriseModel(false, false, Currency,
            new CompanyProfile("—", "—", 0, 0, 0, 0, 0, 0, 0), empty, emptyPnl,
            new CashModel(0, 0, 0), [], [], [], [], [], new DomainQuality(0, 0, 0, 0, 0));
    }

    // ── Parties generiques (derivees des leviers, identiques pour tout modele) ──
    private static EnterpriseModel Build(
        CompanyProfile companyMeta, BusinessDrivers d,
        List<DivisionLine> divisions, List<SegmentLine> segments, DomainQuality quality)
    {
        var pnl = BusinessModelEngine.ComputePnl(d);
        var cash = BusinessModelEngine.ComputeCash(d, pnl);
        var trend = BusinessModelEngine.BuildTrend(pnl, cash);

        var company = companyMeta with { AnnualRevenue = (long)pnl.Revenue };
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
        var revPerEmp = pnl.Revenue / Math.Max(1, company.Employees);
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
        return new EnterpriseModel(true, true, Currency, company, d, pnl, cash, trend, divisions, segments, costs, kpis, quality);
    }

    // ── CGI ──
    private static EnterpriseModel BuildCgi()
    {
        var company = new CompanyProfile("CGI Inc.", "Services-conseils TI", 2400, 0, 6, 5, 640, 1200, 320);
        var divisions = new List<DivisionLine>
        {
            new("Services-conseils", 96_000_000, 8_640_000, 520, 0.09),
            new("Gestion d'applications", 108_000_000, 11_880_000, 640, 0.11),
            new("Infrastructure geree", 84_000_000, 5_880_000, 430, 0.07),
            new("Solutions IP", 42_000_000, 7_560_000, 210, 0.18),
            new("Secteur public", 60_000_000, 3_600_000, 360, 0.06),
            new("Services financiers", 30_000_000, 2_400_000, 240, 0.08),
        };
        var segments = new List<SegmentLine>
        {
            new("Secteur public", 130_000_000, 180, 130.0 / 420),
            new("Services financiers", 105_000_000, 90, 105.0 / 420),
            new("Telecom & medias", 76_000_000, 140, 76.0 / 420),
            new("Sante", 63_000_000, 120, 63.0 / 420),
            new("Manufacturier & distribution", 46_000_000, 110, 46.0 / 420),
        };
        return Build(company, DemoDrivers(), divisions, segments, new DomainQuality(96, 89, 92, 85, 88));
    }

    // ── Bell (telecom) ──
    private static EnterpriseModel BuildBell()
    {
        var company = new CompanyProfile("Bell Telecom", "Telecommunications", 19_000, 0, 5, 8, 9_200_000, 800, 150);
        var divisions = new List<DivisionLine>
        {
            new("Mobilite (Wireless)", 3_000_000_000, 1_050_000_000, 6_500, 0.35),
            new("Internet & TV residentiels", 1_500_000_000, 450_000_000, 4_000, 0.30),
            new("Services entreprise (B2B)", 900_000_000, 270_000_000, 3_200, 0.30),
            new("Media & contenu", 300_000_000, 45_000_000, 2_800, 0.15),
            new("Gros & interconnexion", 188_000_000, 60_000_000, 900, 0.32),
        };
        const double tot = 5_888_000_000.0;
        var segments = new List<SegmentLine>
        {
            new("Grand public — mobile", 2_600_000_000, 6_500_000, 2_600_000_000 / tot),
            new("Grand public — residentiel", 1_600_000_000, 2_300_000, 1_600_000_000 / tot),
            new("Entreprises (B2B)", 1_100_000_000, 380_000, 1_100_000_000 / tot),
            new("Gros / operateurs", 350_000_000, 40, 350_000_000 / tot),
            new("Media & publicite", 238_000_000, 12_000, 238_000_000 / tot),
        };
        return Build(company, BellDrivers(), divisions, segments, new DomainQuality(92, 85, 88, 90, 84));
    }

    // ── Modele PERSONNALISE (saisi via le formulaire, stocke par tenant) ──
    public static EnterpriseModel BuildCustom(string name, string industry, BusinessDrivers d)
    {
        var company = new CompanyProfile(
            string.IsNullOrWhiteSpace(name) ? "Mon organisation" : name.Trim(),
            string.IsNullOrWhiteSpace(industry) ? "—" : industry.Trim(),
            // Effectif = leviers RH ; clients = unites/abonnes. Les compteurs
            // structurels (divisions, sites, fournisseurs, projets) sont saisis.
            Employees: d.Headcount, AnnualRevenue: 0,
            Divisions: d.Divisions, Locations: d.Locations, Customers: d.Units,
            Suppliers: d.Suppliers, Projects: d.Projects);
        // Pas de repartition divisions/segments saisie : le socle financier suffit.
        return Build(company, d, [], [], new DomainQuality(75, 75, 75, 75, 75));
    }
}
