namespace Nexus.Domain.ValueObjects;

/// <summary>
/// Origine d'une preuve soutenant une relation du graphe (Evidence Engine).
/// Chaque source a une fiabilité intrinsèque et une vitesse d'obsolescence
/// différentes : une observation technique d'hier ne vaut pas une mention dans
/// une documentation vieille de deux ans.
/// </summary>
public enum EvidenceSource
{
    /// <summary>Un humain a explicitement confirmé la relation.</summary>
    HumanValidation = 0,

    /// <summary>Observation technique directe (réseau, configuration, processus).</summary>
    Observation = 1,

    /// <summary>Source de vérité interrogée en direct (API REST, CMDB, cloud).</summary>
    RestApi = 2,

    /// <summary>Déduite par le moteur déterministe de NEXUS (règles explicites).</summary>
    DeterministicInference = 3,

    /// <summary>Fichier importé (CSV, Excel) — déclaratif, potentiellement périmé.</summary>
    Import = 4,

    /// <summary>Saisie manuelle ou jeu de données de référence.</summary>
    Declared = 5,

    /// <summary>Extraite d'un document (contrat, schéma, procédure).</summary>
    Document = 6,

    /// <summary>Proposée par le moteur d'inférence IA — jamais présentée comme un fait.</summary>
    AiInference = 7,
}

public static class EvidenceSourceExtensions
{
    /// <summary>
    /// Fiabilité intrinsèque de la source, dans [0, 1]. C'est la contribution
    /// maximale d'une preuve de cette source, avant décote d'ancienneté.
    /// </summary>
    public static double DefaultWeight(this EvidenceSource source) => source switch
    {
        EvidenceSource.HumanValidation => 0.98,
        EvidenceSource.Observation => 0.90,
        EvidenceSource.RestApi => 0.85,
        EvidenceSource.DeterministicInference => 0.75,
        EvidenceSource.Import => 0.70,
        EvidenceSource.Declared => 0.60,
        EvidenceSource.Document => 0.50,
        EvidenceSource.AiInference => 0.35,
        _ => 0.30,
    };

    /// <summary>
    /// Demi-vie de la preuve, en jours : durée au bout de laquelle sa
    /// contribution est divisée par deux (l'infrastructure change).
    /// </summary>
    public static double HalfLifeDays(this EvidenceSource source) => source switch
    {
        EvidenceSource.HumanValidation => 365,
        EvidenceSource.Observation => 90,
        EvidenceSource.RestApi => 90,
        EvidenceSource.DeterministicInference => 180,
        EvidenceSource.Import => 180,
        EvidenceSource.Declared => 365,
        EvidenceSource.Document => 180,
        EvidenceSource.AiInference => 180,
        _ => 180,
    };

    /// <summary>
    /// Statut de confiance qu'implique cette source, pour préserver la règle
    /// ADR-0006 : une relation soutenue uniquement par l'IA reste AiSuggested
    /// et n'entre pas dans les calculs « fermes ».
    /// </summary>
    public static ConfidenceStatus ImpliedStatus(this EvidenceSource source) => source switch
    {
        EvidenceSource.HumanValidation => ConfidenceStatus.Verified,
        EvidenceSource.Observation or EvidenceSource.RestApi
            or EvidenceSource.Import or EvidenceSource.Declared => ConfidenceStatus.Imported,
        EvidenceSource.DeterministicInference or EvidenceSource.Document => ConfidenceStatus.Inferred,
        EvidenceSource.AiInference => ConfidenceStatus.AiSuggested,
        _ => ConfidenceStatus.Unknown,
    };

    /// <summary>
    /// Source à synthétiser pour une relation créée AVANT l'Evidence Engine (ou
    /// par un appelant qui n'a pas encore été instrumenté) : conserve un
    /// aller-retour exact du statut. Unknown ne produit aucune preuve.
    /// </summary>
    public static EvidenceSource? ImpliedEvidenceSource(this ConfidenceStatus status) => status switch
    {
        ConfidenceStatus.Verified => EvidenceSource.HumanValidation,
        ConfidenceStatus.Imported => EvidenceSource.Import,
        ConfidenceStatus.Inferred => EvidenceSource.DeterministicInference,
        ConfidenceStatus.AiSuggested => EvidenceSource.AiInference,
        _ => null,
    };
}
