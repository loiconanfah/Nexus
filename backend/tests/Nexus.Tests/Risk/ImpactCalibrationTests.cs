using Nexus.Risk;
using Xunit;

namespace Nexus.Tests.Risk;

public class ImpactCalibrationTests
{
    [Fact]
    public void Un_revenu_horaire_de_100_000_redonne_exactement_les_paliers_par_defaut()
    {
        // 876 M sur 8 760 h (fonctionnement continu) = 100 000 / h : les paliers
        // par défaut ont été pensés pour cette échelle, l'étalonnage doit les retrouver.
        var t = ImpactCalibration.FromRevenue(876_000_000, "24x7");
        var d = ImpactTuning.Default;

        Assert.Equal(d.CostVeryHigh, t.CostVeryHigh);
        Assert.Equal(d.CostHigh, t.CostHigh);
        Assert.Equal(d.CostElevated, t.CostElevated);
        Assert.Equal(d.CostSignificant, t.CostSignificant);
        Assert.Equal(d.CostModerate, t.CostModerate);
        Assert.Equal(d.CostLow, t.CostLow);
        Assert.Equal(d.CostMinimal, t.CostMinimal);
    }

    [Fact]
    public void Les_delais_et_probabilites_ne_sont_pas_touches()
    {
        var t = ImpactCalibration.FromRevenue(2_000_000_000, "business");
        var d = ImpactTuning.Default;
        Assert.Equal(d.RtoMultiplier, t.RtoMultiplier);
        Assert.Equal(d.ProbabilityDecay, t.ProbabilityDecay);
        Assert.Equal(d.ProbabilityFloor, t.ProbabilityFloor);
    }

    [Fact]
    public void Une_microfinance_en_francs_CFA_obtient_des_paliers_a_son_echelle()
    {
        // 2,6 milliards FCFA par an, heures ouvrées (2 600 h) : 1 000 000 FCFA / h.
        var t = ImpactCalibration.FromRevenue(2_600_000_000, "business");
        Assert.Equal(500_000, t.CostVeryHigh);   // la moitié du revenu horaire
        Assert.Equal(30_000, t.CostModerate);
        Assert.True(t.CostVeryHigh > t.CostHigh && t.CostHigh > t.CostModerate && t.CostModerate > t.CostMinimal);
    }

    [Fact]
    public void Sans_revenu_on_garde_les_valeurs_par_defaut()
        => Assert.Equal(ImpactTuning.Default, ImpactCalibration.FromRevenue(0, "24x7"));
}
