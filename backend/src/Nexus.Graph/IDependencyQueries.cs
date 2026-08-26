namespace Nexus.Graph;

/// <summary>Un nœud impacté et sa distance minimale à l'origine de la panne.</summary>
public sealed record BlastNode(GraphEntityRecord Entity, int Depth);

/// <summary>Candidat single-point-of-failure : entité sans redondance dont dépendent d'autres.</summary>
public sealed record SpofRecord(GraphEntityRecord Entity, int DirectDependents);

/// <summary>
/// Traversées de graphe du Dependency Engine (article 13). Ne parcourt que les
/// relations « source dépend de cible » (<c>CarriesDependency</c>). La panne
/// d'une cible remonte vers ses dépendants (arêtes entrantes).
/// </summary>
public interface IDependencyQueries
{
    /// <summary>Dépendants directs (entités qui dépendent directement de l'entité donnée).</summary>
    Task<IReadOnlyList<GraphEntityRecord>> GetDirectDependentsAsync(Guid tenantId, Guid id, CancellationToken ct = default);

    /// <summary>
    /// Rayon d'explosion : tous les dépendants transitifs et leur profondeur
    /// minimale. C'est l'ensemble affecté si l'entité tombe (Propagation Engine).
    /// </summary>
    Task<IReadOnlyList<BlastNode>> GetBlastRadiusAsync(Guid tenantId, Guid id, int maxDepth = 10, CancellationToken ct = default);

    /// <summary>Vrai si l'entité possède une relation de redondance/reprise (backup/replacement/recovery).</summary>
    Task<bool> HasRedundancyAsync(Guid tenantId, Guid id, CancellationToken ct = default);

    /// <summary>
    /// Candidats SPOF du tenant : entités dont dépendent d'autres et qui n'ont
    /// aucune redondance (article 27), triées par nombre de dépendants directs.
    /// </summary>
    Task<IReadOnlyList<SpofRecord>> FindSpofCandidatesAsync(Guid tenantId, int limit = 50, CancellationToken ct = default);
}
