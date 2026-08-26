namespace Nexus.Application.Lineage;

/// <summary>
/// Entrée de data lineage : provenance d'un nœud ou d'une relation du graphe
/// (article 12). Permet à NEXUS de répondre « pourquoi ces deux systèmes
/// sont-ils liés ? ».
/// </summary>
public sealed record LineageEntry(
    Guid TenantId,
    string? GraphNodeId,
    string? GraphEdgeId,
    Guid? ConnectorId,
    Guid? JobId,
    string? SourceSystem,
    string? SourceRecord,
    bool Transformed = true,
    bool Inferred = false);

/// <summary>
/// Port d'écriture du data lineage (implémenté par l'infrastructure sur
/// PostgreSQL). Défini côté Application pour découpler l'ingestion du stockage.
/// </summary>
public interface ILineageWriter
{
    Task WriteAsync(IReadOnlyCollection<LineageEntry> entries, CancellationToken ct = default);
}
