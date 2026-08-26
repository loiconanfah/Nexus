using System.Runtime.CompilerServices;

namespace Nexus.Core.Guards;

/// <summary>
/// Clauses de garde pour valider les invariants aux frontières (constructeurs,
/// fabriques). Lève des exceptions car une garde violée est un bug de
/// programmation, pas un flux métier attendu (celui-ci passe par Result).
/// </summary>
public static class Guard
{
    public static string AgainstNullOrWhiteSpace(string? value, [CallerArgumentExpression(nameof(value))] string? name = null)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("La valeur ne peut pas être vide.", name);
        }

        return value;
    }

    public static T AgainstNull<T>(T? value, [CallerArgumentExpression(nameof(value))] string? name = null)
        where T : class
    {
        return value ?? throw new ArgumentNullException(name);
    }

    public static double AgainstOutOfRange(double value, double min, double max, [CallerArgumentExpression(nameof(value))] string? name = null)
    {
        if (value < min || value > max)
        {
            throw new ArgumentOutOfRangeException(name, value, $"La valeur doit être comprise entre {min} et {max}.");
        }

        return value;
    }
}
