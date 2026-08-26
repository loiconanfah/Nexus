using Nexus.Domain.Graph;

namespace Nexus.Graph;

/// <summary>
/// Accès au knowledge graph Neo4j. Les écritures acceptent les agrégats de
/// domaine ; les lectures renvoient des modèles de projection.
/// </summary>
public interface IGraphRepository
{
    /// <summary>Crée ou met à jour un nœud (MERGE sur id).</summary>
    Task UpsertEntityAsync(GraphEntity entity, CancellationToken ct = default);

    /// <summary>Crée ou met à jour une relation (MERGE sur id ; les extrémités doivent exister).</summary>
    Task UpsertRelationAsync(GraphRelation relation, CancellationToken ct = default);

    /// <summary>Lit une entité active par identifiant (filtrée par tenant).</summary>
    Task<GraphEntityRecord?> GetEntityAsync(Guid tenantId, Guid id, CancellationToken ct = default);

    /// <summary>
    /// Renvoie les dépendances directes sortantes d'une entité (relations de
    /// dépendance de l'ontologie uniquement). Base du Dependency Engine (Phase 3).
    /// </summary>
    Task<IReadOnlyList<DirectDependencyRecord>> GetDirectDependenciesAsync(Guid tenantId, Guid id, CancellationToken ct = default);
}
