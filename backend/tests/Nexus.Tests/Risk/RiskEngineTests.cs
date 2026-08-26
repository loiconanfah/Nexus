using Nexus.Domain.ValueObjects;
using Nexus.Risk;
using Nexus.Risk.Scoring;

namespace Nexus.Tests.Risk;

public class RiskEngineTests
{
    private readonly RiskEngine _engine = new();

    private static RiskInput Uniform(double v) => new(v, v, v, v, v, v);

    [Fact]
    public void All_zero_factors_give_zero_score()
    {
        var a = _engine.Assess(Uniform(0));
        Assert.Equal(0, a.Score);
        Assert.Equal(RiskBand.Low, a.Band);
    }

    [Fact]
    public void All_max_factors_give_hundred_and_critical_band()
    {
        var a = _engine.Assess(Uniform(1));
        Assert.Equal(100, a.Score);
        Assert.Equal(RiskBand.Critical, a.Band);
    }

    [Fact]
    public void Score_stays_within_bounds_and_breakdown_sums_to_score()
    {
        var a = _engine.Assess(new RiskInput(0.9, 0.8, 0.3, 0.5, 1.0, 0.2));
        Assert.InRange(a.Score, 0, 100);

        var sum = a.Breakdown.Sum(b => b.Points);
        Assert.Equal(a.Score, Math.Round(sum, 2), precision: 1);
    }

    [Fact]
    public void Breakdown_is_explainable_all_factors_present_sorted_desc()
    {
        var a = _engine.Assess(new RiskInput(0.9, 0.1, 0.1, 0.1, 0.1, 0.1));

        Assert.Equal(6, a.Breakdown.Count);
        // Criticité (valeur 0.9, poids le plus fort) doit être en tête.
        Assert.Equal("Criticality", a.Breakdown[0].Factor);
        for (var i = 1; i < a.Breakdown.Count; i++)
        {
            Assert.True(a.Breakdown[i - 1].Points >= a.Breakdown[i].Points);
        }
    }

    [Fact]
    public void Weights_are_configurable_not_hardcoded()
    {
        var input = new RiskInput(1, 0, 0, 0, 0, 0);   // seule la criticité est élevée

        // Profil A : criticité dominante → score élevé.
        var high = _engine.Assess(input, new RiskWeights(Criticality: 0.9, PropagationPotential: 0.1,
            Concentration: 0, DependencyDepth: 0, LackOfRedundancy: 0, Uncertainty: 0));

        // Profil B : criticité ignorée → score faible.
        var low = _engine.Assess(input, new RiskWeights(Criticality: 0.0, PropagationPotential: 1.0,
            Concentration: 0, DependencyDepth: 0, LackOfRedundancy: 0, Uncertainty: 0));

        Assert.True(high.Score > low.Score);
        Assert.Equal(0, low.Score);   // criticité non pondérée, autres facteurs nuls
    }

    [Fact]
    public void Thresholds_are_configurable()
    {
        var input = Uniform(0.5);   // score = 50 avec poids par défaut
        var a = _engine.Assess(input);
        Assert.Equal(50, a.Score);
        Assert.Equal(RiskBand.Elevated, a.Band);   // seuils par défaut : 41-60

        // Seuils resserrés : 50 devient CRITICAL.
        var strict = _engine.Assess(input, thresholds: new RiskThresholds(Low: 10, Moderate: 20, Elevated: 30, High: 40));
        Assert.Equal(RiskBand.Critical, strict.Band);
    }
}
