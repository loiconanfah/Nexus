using Nexus.Risk;

namespace Nexus.Tests.Risk;

public class CriticalityEngineTests
{
    private readonly CriticalityEngine _engine = new(perDependentWeight: 12);

    [Fact]
    public void Effective_uses_declared_when_higher()
    {
        // 1 dépendant → structurel 12 ; déclaré 80 l'emporte.
        Assert.Equal(80, _engine.Effective(declaredCriticality: 80, dependentCount: 1));
    }

    [Fact]
    public void Effective_boosts_secondary_asset_with_many_dependents()
    {
        // Actif « secondaire » (déclaré 10) mais 8 dépendants → structurel 96.
        Assert.Equal(96, _engine.Effective(declaredCriticality: 10, dependentCount: 8));
    }

    [Fact]
    public void Effective_is_capped_at_100()
    {
        Assert.Equal(100, _engine.Effective(declaredCriticality: 10, dependentCount: 50));
    }

    [Fact]
    public void Effective_with_no_dependents_returns_declared()
    {
        Assert.Equal(35, _engine.Effective(declaredCriticality: 35, dependentCount: 0));
    }
}
