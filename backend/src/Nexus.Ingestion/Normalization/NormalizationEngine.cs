using System.Globalization;
using Nexus.Connectors;
using Nexus.Core.Results;
using Nexus.Domain.Ontology;
using Nexus.Ingestion.Mapping;

namespace Nexus.Ingestion.Normalization;

/// <summary>
/// Transforme les enregistrements bruts en candidats conformes à l'ontologie
/// NEXUS (article 11, étape de normalisation). Valide les types contre le
/// registre d'ontologie ; les lignes invalides produisent une erreur explicite
/// plutôt qu'une exception (elles sont comptées et ignorées par le pipeline).
/// </summary>
public sealed class NormalizationEngine
{
    public Result<EntityCandidate> NormalizeEntity(RawRecord record, EntityMapping mapping)
    {
        // Type par colonne si fourni (et non vide), sinon type fixe du mapping.
        var typeName = mapping.EntityTypeColumn is not null
            ? record.Get(mapping.EntityTypeColumn) ?? mapping.EntityType
            : mapping.EntityType;

        var typeResult = EntityType.FromName(typeName);
        if (typeResult.IsFailure)
        {
            return typeResult.Error;
        }

        var name = record.Get(mapping.NameColumn);
        if (string.IsNullOrWhiteSpace(name))
        {
            return Error.Validation("normalize.entity.name_missing",
                $"Colonne nom '{mapping.NameColumn}' vide (ligne {record.SourceKey}).");
        }

        var aliases = (mapping.AliasColumns ?? [])
            .Select(record.Get)
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => v!)
            .ToList();

        int? criticality = null;
        if (mapping.CriticalityColumn is not null &&
            record.Get(mapping.CriticalityColumn) is { } raw &&
            int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var c))
        {
            criticality = Math.Clamp(c, 0, 100);
        }

        var description = mapping.DescriptionColumn is null ? null : record.Get(mapping.DescriptionColumn);

        return new EntityCandidate(typeResult.Value, name, aliases, criticality, description, record.SourceKey);
    }

    public Result<RelationCandidate> NormalizeRelation(RawRecord record, RelationMapping mapping)
    {
        var relResult = RelationType.FromName(mapping.RelationType);
        if (relResult.IsFailure)
        {
            return relResult.Error;
        }

        var sourceTypeName = mapping.SourceTypeColumn is not null
            ? record.Get(mapping.SourceTypeColumn) ?? mapping.SourceEntityType
            : mapping.SourceEntityType;
        var sourceType = EntityType.FromName(sourceTypeName);
        if (sourceType.IsFailure)
        {
            return sourceType.Error;
        }

        var targetTypeName = mapping.TargetTypeColumn is not null
            ? record.Get(mapping.TargetTypeColumn) ?? mapping.TargetEntityType
            : mapping.TargetEntityType;
        var targetType = EntityType.FromName(targetTypeName);
        if (targetType.IsFailure)
        {
            return targetType.Error;
        }

        var sourceName = record.Get(mapping.SourceNameColumn);
        var targetName = record.Get(mapping.TargetNameColumn);
        if (string.IsNullOrWhiteSpace(sourceName) || string.IsNullOrWhiteSpace(targetName))
        {
            return Error.Validation("normalize.relation.endpoint_missing",
                $"Extrémité de relation vide (ligne {record.SourceKey}).");
        }

        var confidence = mapping.DefaultConfidence;
        if (mapping.ConfidenceColumn is not null &&
            record.Get(mapping.ConfidenceColumn) is { } rawConf &&
            double.TryParse(rawConf, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
        {
            confidence = Math.Clamp(parsed, 0.0, 1.0);
        }

        return new RelationCandidate(
            relResult.Value, sourceType.Value, sourceName, targetType.Value, targetName, confidence, record.SourceKey);
    }
}
