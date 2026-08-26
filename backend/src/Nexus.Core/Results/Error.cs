namespace Nexus.Core.Results;

/// <summary>
/// Erreur métier explicite (code stable + message + catégorie). Immuable.
/// Les erreurs sont retournées via <see cref="Result"/> plutôt que levées,
/// pour rendre les chemins d'échec explicites et testables.
/// </summary>
public sealed record Error(string Code, string Message, ErrorType Type)
{
    /// <summary>Absence d'erreur (résultat de succès).</summary>
    public static readonly Error None = new(string.Empty, string.Empty, ErrorType.Failure);

    public static Error Failure(string code, string message) => new(code, message, ErrorType.Failure);
    public static Error Validation(string code, string message) => new(code, message, ErrorType.Validation);
    public static Error NotFound(string code, string message) => new(code, message, ErrorType.NotFound);
    public static Error Conflict(string code, string message) => new(code, message, ErrorType.Conflict);
    public static Error Unauthorized(string code, string message) => new(code, message, ErrorType.Unauthorized);
    public static Error Forbidden(string code, string message) => new(code, message, ErrorType.Forbidden);

    public override string ToString() => $"{Type}:{Code} {Message}".Trim();
}
