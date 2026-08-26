using Nexus.Domain.Ontology;

namespace Nexus.Ingestion.Normalization;

/// <summary>Entité normalisée prête à être résolue puis écrite dans le graphe.</summary>
public sealed record EntityCandidate(
    EntityType Type,
    string Name,
    IReadOnlyList<string> Aliases,
    int? Criticality,
    string? Description,
    string SourceKey);

/// <summary>Relation normalisée ; ses extrémités seront résolues par nom + type.</summary>
public sealed record RelationCandidate(
    RelationType Type,
    EntityType SourceType,
    string SourceName,
    EntityType TargetType,
    string TargetName,
    double Confidence,
    string SourceKey);
