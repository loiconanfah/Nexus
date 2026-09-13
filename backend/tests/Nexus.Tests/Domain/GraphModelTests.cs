using Nexus.Domain.Graph;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;

namespace Nexus.Tests.Domain;

public class GraphModelTests
{
    private static readonly Guid Tenant = Guid.NewGuid();

    [Fact]
    public void GraphEntity_Create_succeeds_with_valid_input()
    {
        var result = GraphEntity.Create(Tenant, EntityType.Server, "SQL01");
        Assert.True(result.IsSuccess);
        Assert.Equal("SQL01", result.Value.Name);
        Assert.True(result.Value.IsActive);
    }

    [Fact]
    public void GraphEntity_Create_requires_tenant()
    {
        var result = GraphEntity.Create(Guid.Empty, EntityType.Server, "SQL01");
        Assert.True(result.IsFailure);
        Assert.Equal("graph_entity.tenant_required", result.Error.Code);
    }

    [Fact]
    public void GraphEntity_Create_requires_name()
    {
        var result = GraphEntity.Create(Tenant, EntityType.Server, "  ");
        Assert.True(result.IsFailure);
        Assert.Equal("graph_entity.name_required", result.Error.Code);
    }

    [Fact]
    public void GraphEntity_deduplicates_aliases_case_insensitively()
    {
        var result = GraphEntity.Create(Tenant, EntityType.Server, "SQL01",
            aliases: ["database-server-001", "SQL01", "sql01"]);

        Assert.True(result.IsSuccess);
        // "SQL01" (== name) et "sql01" sont considérés identiques.
        Assert.Equal(2, result.Value.Aliases.Count);
    }

    [Fact]
    public void GraphEntity_Retire_ends_temporal_validity()
    {
        var entity = GraphEntity.Create(Tenant, EntityType.Server, "SQL01").Value;
        entity.Retire(DateTimeOffset.UtcNow);
        Assert.False(entity.IsActive);
        Assert.NotNull(entity.ValidUntil);
    }

    [Fact]
    public void GraphRelation_Create_rejects_self_loop()
    {
        var node = Guid.NewGuid();
        var conf = Confidence.Certain;

        var result = GraphRelation.Create(Tenant, node, node, RelationType.DependsOn, conf, ConfidenceStatus.Verified);

        Assert.True(result.IsFailure);
        Assert.Equal("graph_relation.self_loop", result.Error.Code);
    }

    [Fact]
    public void GraphRelation_Verify_marks_verified_and_certain()
    {
        var rel = GraphRelation.Create(
            Tenant, Guid.NewGuid(), Guid.NewGuid(),
            RelationType.DependsOn,
            Confidence.Create(0.76).Value,
            ConfidenceStatus.AiSuggested).Value;

        Assert.False(rel.IsFirm);       // AI_SUGGESTED exclu par défaut

        rel.Verify("user:alice", DateTimeOffset.UtcNow);

        Assert.Equal(ConfidenceStatus.Verified, rel.Status);
        Assert.True(rel.IsFirm);

        // Depuis l'Evidence Engine, Verify() n'ECRASE plus la confiance à 1.0 :
        // il AJOUTE une preuve de validation humaine, et le score se recalcule à
        // partir de toutes les preuves accumulées. Il ne peut donc pas atteindre
        // 1.0 — aucune source n'est infaillible — mais il domine largement la
        // confiance d'origine, et la trace de cette origine est préservée.
        Assert.True(rel.Confidence.Value > 0.95, $"confiance attendue > 0.95, obtenue {rel.Confidence.Value}");
        Assert.True(rel.Confidence.Value < 1.0);
        Assert.Contains(rel.Evidences, e => e.Source == EvidenceSource.HumanValidation);
        Assert.Contains(rel.Evidences, e => e.Source != EvidenceSource.HumanValidation);
        Assert.Equal("user:alice", rel.VerifiedBy);
        Assert.NotNull(rel.VerifiedAt);
    }
}
