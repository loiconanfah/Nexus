using Nexus.Core.Primitives;
using Nexus.Core.Results;

namespace Nexus.Domain.ValueObjects;

/// <summary>
/// Score de confiance d'une relation, borné [0, 1] (article 9). Value object
/// immuable. Créé via <see cref="Create"/> (chemin de validation pour les
/// données externes) plutôt que par constructeur public.
/// </summary>
public sealed class Confidence : ValueObject
{
    public const double Min = 0.0;
    public const double Max = 1.0;

    private Confidence(double value) => Value = value;

    public double Value { get; }

    public static Result<Confidence> Create(double value)
    {
        if (double.IsNaN(value) || value < Min || value > Max)
        {
            return Error.Validation("confidence.out_of_range", $"La confiance doit être comprise entre {Min} et {Max}.");
        }

        return new Confidence(value);
    }

    /// <summary>Confiance certaine (1.0), typiquement une relation VERIFIED.</summary>
    public static Confidence Certain => new(Max);

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value.ToString("0.00");
}
