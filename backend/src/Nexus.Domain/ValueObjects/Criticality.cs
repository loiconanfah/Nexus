using Nexus.Core.Primitives;
using Nexus.Core.Results;

namespace Nexus.Domain.ValueObjects;

/// <summary>
/// Niveau de criticité d'une entité, borné [0, 100] (articles 14-15). Value
/// object immuable, dérivé du Criticality Engine ou fourni à l'import.
/// </summary>
public sealed class Criticality : ValueObject
{
    public const int Min = 0;
    public const int Max = 100;

    private Criticality(int value) => Value = value;

    public int Value { get; }

    public static Result<Criticality> Create(int value)
    {
        if (value < Min || value > Max)
        {
            return Error.Validation("criticality.out_of_range", $"La criticité doit être comprise entre {Min} et {Max}.");
        }

        return new Criticality(value);
    }

    public static Criticality Unknown => new(Min);

    /// <summary>Bande de criticité alignée sur les catégories de risque (article 14).</summary>
    public RiskBand Band => Value switch
    {
        <= 20 => RiskBand.Low,
        <= 40 => RiskBand.Moderate,
        <= 60 => RiskBand.Elevated,
        <= 80 => RiskBand.High,
        _ => RiskBand.Critical
    };

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value.ToString();
}

/// <summary>
/// Bandes de sévérité 0-100 partagées par la criticité et le RiskScore
/// (article 14 : LOW / MODERATE / ELEVATED / HIGH / CRITICAL).
/// </summary>
public enum RiskBand
{
    Low = 0,
    Moderate = 1,
    Elevated = 2,
    High = 3,
    Critical = 4
}
