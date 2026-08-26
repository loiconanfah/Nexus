namespace Nexus.Domain.ValueObjects;

/// <summary>
/// Statut d'une relation dans le Confidence Engine (article 9). Détermine la
/// fiabilité de la relation et si elle entre par défaut dans les calculs fermes.
/// </summary>
public enum ConfidenceStatus
{
    /// <summary>Confirmée par une source fiable ou un humain.</summary>
    Verified = 0,

    /// <summary>Importée directement d'une source.</summary>
    Imported = 1,

    /// <summary>Déduite par le moteur déterministe de NEXUS.</summary>
    Inferred = 2,

    /// <summary>Proposée par l'IA (jamais présentée comme un fait).</summary>
    AiSuggested = 3,

    /// <summary>Relation potentielle non confirmée.</summary>
    Unknown = 4
}

public static class ConfidenceStatusExtensions
{
    /// <summary>
    /// Vrai si la relation est suffisamment fiable pour entrer par défaut dans
    /// les calculs de risque « fermes ». Les relations AI_SUGGESTED et UNKNOWN
    /// en sont exclues par défaut (article 9 / ADR-0006).
    /// </summary>
    public static bool IsFirmByDefault(this ConfidenceStatus status) =>
        status is ConfidenceStatus.Verified or ConfidenceStatus.Imported or ConfidenceStatus.Inferred;
}
