namespace Nexus.Ingestion.Mapping;

/// <summary>
/// Décrit comment les colonnes d'un jeu de données produisent des ENTITÉS de
/// l'ontologie. Déclaratif (JSON-sérialisable) : aucune logique de mapping
/// n'est codée en dur dans les connecteurs (ADR-0009).
/// </summary>
public sealed record EntityMapping(
    string Dataset,
    string EntityType,
    string NameColumn,
    IReadOnlyList<string>? AliasColumns = null,
    string? CriticalityColumn = null,
    string? DescriptionColumn = null,
    // Si renseigné, le type d'entité est lu par ligne dans cette colonne ;
    // sinon le type fixe EntityType s'applique. Fallback sur EntityType si vide.
    string? EntityTypeColumn = null);

/// <summary>
/// Décrit comment les colonnes d'un jeu de données produisent des RELATIONS
/// (source → cible), les extrémités étant résolues par nom au sein de leur type.
/// </summary>
public sealed record RelationMapping(
    string Dataset,
    string RelationType,
    string SourceEntityType,
    string SourceNameColumn,
    string TargetEntityType,
    string TargetNameColumn,
    string? ConfidenceColumn = null,
    double DefaultConfidence = 1.0,
    // Types des extrémités par colonne (sinon types fixes ci-dessus).
    string? SourceTypeColumn = null,
    string? TargetTypeColumn = null);

/// <summary>
/// Profil de mapping complet d'une source vers l'ontologie NEXUS.
/// </summary>
public sealed record MappingProfile(
    string SourceSystem,
    IReadOnlyList<EntityMapping> Entities,
    IReadOnlyList<RelationMapping> Relations);
