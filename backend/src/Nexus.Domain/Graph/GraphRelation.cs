using Nexus.Core.Primitives;
using Nexus.Core.Results;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;

namespace Nexus.Domain.Graph;

/// <summary>
/// Relation orientée du knowledge graph (source → target), porteuse de la
/// confiance, du statut et de la preuve (article 8). C'est l'arête traversée
/// par le Dependency Engine et le Propagation Engine.
/// </summary>
public sealed class GraphRelation : Entity<Guid>
{
    private GraphRelation(
        Guid id,
        Guid tenantId,
        Guid sourceId,
        Guid targetId,
        RelationType type,
        Confidence confidence,
        ConfidenceStatus status,
        string? sourceSystem,
        string? sourceRecord,
        string? evidence,
        DateTimeOffset createdAt) : base(id)
    {
        TenantId = tenantId;
        SourceId = sourceId;
        TargetId = targetId;
        Type = type;
        Confidence = confidence;
        Status = status;
        SourceSystem = sourceSystem;
        SourceRecord = sourceRecord;
        Evidence = evidence;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
        ValidFrom = createdAt;
    }

    public Guid TenantId { get; }
    public Guid SourceId { get; }
    public Guid TargetId { get; }
    public RelationType Type { get; }

    public Confidence Confidence { get; private set; }
    public ConfidenceStatus Status { get; private set; }

    public string? SourceSystem { get; }
    public string? SourceRecord { get; }
    public string? Evidence { get; private set; }

    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? VerifiedAt { get; private set; }
    public string? VerifiedBy { get; private set; }

    public DateTimeOffset ValidFrom { get; }
    public DateTimeOffset? ValidUntil { get; private set; }

    public bool IsActive => ValidUntil is null;

    /// <summary>Vrai si la relation entre par défaut dans les calculs de risque fermes (ADR-0006).</summary>
    public bool IsFirm => Status.IsFirmByDefault();

    /// <summary>Fabrique validée d'une relation de graphe.</summary>
    public static Result<GraphRelation> Create(
        Guid tenantId,
        Guid sourceId,
        Guid targetId,
        RelationType type,
        Confidence confidence,
        ConfidenceStatus status,
        string? sourceSystem = null,
        string? sourceRecord = null,
        string? evidence = null,
        Guid? id = null,
        DateTimeOffset? createdAt = null)
    {
        if (tenantId == Guid.Empty)
        {
            return Error.Validation("graph_relation.tenant_required", "Le tenant est requis.");
        }

        if (sourceId == Guid.Empty || targetId == Guid.Empty)
        {
            return Error.Validation("graph_relation.endpoints_required", "Les extrémités source et cible sont requises.");
        }

        if (sourceId == targetId)
        {
            return Error.Validation("graph_relation.self_loop", "Une relation ne peut pas relier une entité à elle-même.");
        }

        if (type is null)
        {
            return Error.Validation("graph_relation.type_required", "Le type de relation est requis.");
        }

        if (confidence is null)
        {
            return Error.Validation("graph_relation.confidence_required", "La confiance est requise.");
        }

        return new GraphRelation(
            id ?? Guid.NewGuid(),
            tenantId,
            sourceId,
            targetId,
            type,
            confidence,
            status,
            sourceSystem,
            sourceRecord,
            evidence,
            createdAt ?? DateTimeOffset.UtcNow);
    }

    /// <summary>
    /// Promeut la relation en VERIFIED (validation humaine — article 9).
    /// Porte la confiance à certaine et enregistre l'auteur/horodatage.
    /// </summary>
    public void Verify(string verifiedBy, DateTimeOffset at)
    {
        Status = ConfidenceStatus.Verified;
        Confidence = Confidence.Certain;
        VerifiedBy = verifiedBy;
        VerifiedAt = at;
        Evidence ??= $"Validée par {verifiedBy}";
        UpdatedAt = at;
    }

    public void Retire(DateTimeOffset at)
    {
        ValidUntil = at;
        UpdatedAt = at;
    }
}
