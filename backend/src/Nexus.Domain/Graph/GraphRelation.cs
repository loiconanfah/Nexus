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
    private readonly List<RelationEvidence> _evidences;

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
        IEnumerable<RelationEvidence> evidences,
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
        _evidences = [.. evidences];
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
        ValidFrom = createdAt;
        Recompute(createdAt);
    }

    public Guid TenantId { get; }
    public Guid SourceId { get; }
    public Guid TargetId { get; }
    public RelationType Type { get; }

    public Confidence Confidence { get; private set; }
    public ConfidenceStatus Status { get; private set; }

    public string? SourceSystem { get; }
    public string? SourceRecord { get; }

    /// <summary>Preuve historique en texte libre (conservée pour rétro-compatibilité).</summary>
    public string? Evidence { get; private set; }

    /// <summary>
    /// Preuves soutenant la relation. Dès qu'il y en a au moins une, la
    /// <see cref="Confidence"/> et le <see cref="Status"/> en sont DÉRIVÉS
    /// (Evidence Engine) plutôt qu'affirmés par l'appelant.
    /// </summary>
    public IReadOnlyList<RelationEvidence> Evidences => _evidences;

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
        DateTimeOffset? createdAt = null,
        IEnumerable<RelationEvidence>? evidences = null)
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

        var at = createdAt ?? DateTimeOffset.UtcNow;

        // Rétro-compatibilité : un appelant qui n'a pas encore été instrumenté
        // fournit (status, confidence, evidence). On en synthétise UNE preuve,
        // de poids égal à la confiance annoncée. Le moteur redonne alors
        // exactement cette confiance (1 − (1 − w) = w) et le même statut :
        // aucun comportement existant n'est modifié.
        var seeded = evidences?.ToList() ?? [];
        if (seeded.Count == 0 && status.ImpliedEvidenceSource() is { } implied)
        {
            seeded.Add(RelationEvidence.From(
                implied,
                string.IsNullOrWhiteSpace(evidence) ? $"Relation issue de : {status}" : evidence!,
                at, sourceSystem, sourceRecord, confidence.Value));
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
            seeded,
            at);
    }

    /// <summary>
    /// Ajoute une preuve et recalcule la confiance. C'est le chemin par lequel
    /// une source qui RE-CONFIRME une relation la renforce, au lieu de créer un
    /// doublon ou d'écraser ce qui était déjà su.
    /// </summary>
    public void AddEvidence(RelationEvidence evidence, DateTimeOffset? at = null)
    {
        if (evidence is null) return;
        var now = at ?? DateTimeOffset.UtcNow;

        // Une même source re-confirmant le même fait remplace sa preuve
        // précédente (on garde l'observation la plus récente) plutôt que de
        // gonfler artificiellement la confiance par répétition.
        _evidences.RemoveAll(e =>
            e.Source == evidence.Source &&
            string.Equals(e.SourceSystem, evidence.SourceSystem, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(e.SourceRecord, evidence.SourceRecord, StringComparison.OrdinalIgnoreCase));

        _evidences.Add(evidence);
        Recompute(now);
        UpdatedAt = now;
    }

    /// <summary>Décomposition explicable du score de confiance.</summary>
    public ConfidenceBreakdown ExplainConfidence(DateTimeOffset? asOf = null)
        => ConfidenceEngine.Evaluate(_evidences, asOf ?? DateTimeOffset.UtcNow);

    /// <summary>
    /// Dérive confiance et statut des preuves. Sans preuve, on conserve les
    /// valeurs fournies (cas d'un statut Unknown notamment).
    /// </summary>
    private void Recompute(DateTimeOffset asOf)
    {
        if (_evidences.Count == 0) return;

        var breakdown = ConfidenceEngine.Evaluate(_evidences, asOf);
        var c = Confidence.Create(breakdown.Score);
        if (c.IsSuccess) Confidence = c.Value;
        Status = breakdown.Status;
    }

    /// <summary>
    /// Validation humaine (article 9). AJOUTE une preuve humaine au lieu
    /// d'écraser ce qui était déjà su : la trace des sources d'origine est
    /// conservée, et la confiance monte au lieu d'être décrétée. Le statut
    /// devient Verified car la validation humaine est la source la plus fiable.
    /// </summary>
    public void Verify(string verifiedBy, DateTimeOffset at)
    {
        AddEvidence(RelationEvidence.From(
            EvidenceSource.HumanValidation,
            $"Confirmée par {verifiedBy}",
            at,
            sourceSystem: "Lenexux",
            sourceRecord: verifiedBy), at);

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
