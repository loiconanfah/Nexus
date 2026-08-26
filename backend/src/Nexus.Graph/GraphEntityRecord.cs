namespace Nexus.Graph;

/// <summary>
/// Modèle de lecture d'une entité du graphe (projection de requête). Les
/// écritures passent par l'agrégat de domaine <c>GraphEntity</c> ; les lectures
/// renvoient ce record léger.
/// </summary>
public sealed record GraphEntityRecord(
    Guid Id,
    Guid TenantId,
    string EntityType,
    string Name,
    int Criticality,
    IReadOnlyList<string> Aliases,
    string? Description,
    string? SourceSystem);

/// <summary>Une dépendance directe lue depuis le graphe, avec la confiance de l'arête.</summary>
public sealed record DirectDependencyRecord(
    GraphEntityRecord Target,
    string RelationType,
    double Confidence,
    string Status);
