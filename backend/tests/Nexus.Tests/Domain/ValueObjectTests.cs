using Nexus.Domain.ValueObjects;

namespace Nexus.Tests.Domain;

public class ValueObjectTests
{
    [Theory]
    [InlineData(0.0)]
    [InlineData(0.76)]
    [InlineData(1.0)]
    public void Confidence_accepts_values_in_range(double value)
    {
        var result = Confidence.Create(value);
        Assert.True(result.IsSuccess);
        Assert.Equal(value, result.Value.Value);
    }

    [Theory]
    [InlineData(-0.01)]
    [InlineData(1.01)]
    [InlineData(double.NaN)]
    public void Confidence_rejects_values_out_of_range(double value)
    {
        var result = Confidence.Create(value);
        Assert.True(result.IsFailure);
        Assert.Equal("confidence.out_of_range", result.Error.Code);
    }

    [Fact]
    public void Confidence_has_value_equality()
    {
        var a = Confidence.Create(0.5).Value;
        var b = Confidence.Create(0.5).Value;
        Assert.Equal(a, b);
    }

    [Theory]
    [InlineData(10, RiskBand.Low)]
    [InlineData(20, RiskBand.Low)]
    [InlineData(35, RiskBand.Moderate)]
    [InlineData(55, RiskBand.Elevated)]
    [InlineData(75, RiskBand.High)]
    [InlineData(95, RiskBand.Critical)]
    public void Criticality_maps_to_expected_band(int value, RiskBand expected)
    {
        var criticality = Criticality.Create(value).Value;
        Assert.Equal(expected, criticality.Band);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(101)]
    public void Criticality_rejects_out_of_range(int value)
    {
        Assert.True(Criticality.Create(value).IsFailure);
    }

    [Fact]
    public void ConfidenceStatus_firmness_excludes_ai_and_unknown()
    {
        Assert.True(ConfidenceStatus.Verified.IsFirmByDefault());
        Assert.True(ConfidenceStatus.Imported.IsFirmByDefault());
        Assert.True(ConfidenceStatus.Inferred.IsFirmByDefault());
        Assert.False(ConfidenceStatus.AiSuggested.IsFirmByDefault());
        Assert.False(ConfidenceStatus.Unknown.IsFirmByDefault());
    }
}
