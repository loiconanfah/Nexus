namespace Nexus.Core.Results;

/// <summary>
/// Catégorie d'erreur métier, utilisée pour mapper vers les bons codes HTTP
/// à la frontière de l'API sans coupler le domaine à ASP.NET Core.
/// </summary>
public enum ErrorType
{
    Failure = 0,
    Validation = 1,
    NotFound = 2,
    Conflict = 3,
    Unauthorized = 4,
    Forbidden = 5
}
