using System.Diagnostics;
using Nexus.Core;
using Nexus.Application.Lineage;
using Nexus.Connectors;
using Nexus.Core.Results;
using Nexus.Domain.Graph;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;
using Nexus.Ingestion.Mapping;
using Nexus.Ingestion.Normalization;

namespace Nexus.Ingestion;

/// <summary>
/// Pipeline d'ingestion read-only : Extract → Normalize → Resolve → Map → Write,
/// avec écriture du data lineage et de la confiance/statut (articles 10-13).
/// Deux passes : d'abord les entités (pour peupler le cache de résolution),
/// puis les relations (dont les extrémités sont résolues par nom + type).
/// </summary>
public sealed class ImportPipeline(
    NormalizationEngine normalizer,
    IEntityResolver resolver,
    IGraphRepository graph,
    ILineageWriter lineage)
{
    // Séparateur improbable dans un nom d'entité, pour éviter les collisions type/nom dans la clé de cache.
    private const string KeySeparator = "|#|";

    public async Task<Result<ImportResult>> ExecuteAsync(
        Guid tenantId,
        IConnector connector,
        MappingProfile profile,
        Guid? connectorId = null,
        Guid? jobId = null,
        CancellationToken ct = default)
    {
        var validation = await connector.ValidateConnectionAsync(ct);
        if (validation.IsFailure)
        {
            return validation.Error;
        }

        var sw = Stopwatch.StartNew();
        var cache = new Dictionary<string, Guid>(StringComparer.Ordinal);
        var seenRelations = new HashSet<Guid>();
        var lineageBuffer = new List<LineageEntry>();
        int recordsRead = 0, created = 0, matched = 0, relCreated = 0, relUnresolved = 0, skipped = 0;
        TimeSpan? timeToFirstGraph = null;

        // ---- Passe 1 : entités ----
        foreach (var mapping in profile.Entities)
        {
            await foreach (var record in connector.ExtractAsync(mapping.Dataset, ct))
            {
                recordsRead++;
                var normalized = normalizer.NormalizeEntity(record, mapping);
                if (normalized.IsFailure)
                {
                    skipped++;
                    continue;
                }

                var candidate = normalized.Value;
                var key = Key(candidate.Type.Name, candidate.Name);
                if (cache.ContainsKey(key))
                {
                    matched++;
                    continue;
                }

                var existing = await resolver.FindExistingAsync(tenantId, candidate.Type, candidate.Name, candidate.Aliases, ct);
                Guid id;
                if (existing is { } existingId)
                {
                    id = existingId;
                    matched++;
                }
                else
                {
                    var built = BuildEntity(tenantId, candidate, profile.SourceSystem);
                    if (built.IsFailure)
                    {
                        skipped++;
                        continue;
                    }

                    await graph.UpsertEntityAsync(built.Value, ct);
                    id = built.Value.Id;
                    created++;
                    timeToFirstGraph ??= sw.Elapsed;
                }

                Cache(cache, candidate.Type.Name, candidate.Name, id);
                foreach (var alias in candidate.Aliases)
                {
                    Cache(cache, candidate.Type.Name, alias, id);
                }

                lineageBuffer.Add(new LineageEntry(
                    tenantId, id.ToString(), null, connectorId, jobId, profile.SourceSystem, record.SourceKey));
            }
        }

        // ---- Passe 2 : relations ----
        foreach (var mapping in profile.Relations)
        {
            await foreach (var record in connector.ExtractAsync(mapping.Dataset, ct))
            {
                recordsRead++;
                var normalized = normalizer.NormalizeRelation(record, mapping);
                if (normalized.IsFailure)
                {
                    skipped++;
                    continue;
                }

                var candidate = normalized.Value;
                var sourceId = await ResolveAsync(tenantId, candidate.SourceType, candidate.SourceName, cache, ct);
                var targetId = await ResolveAsync(tenantId, candidate.TargetType, candidate.TargetName, cache, ct);
                if (sourceId is null || targetId is null)
                {
                    relUnresolved++;
                    continue;
                }

                var confidence = Confidence.Create(candidate.Confidence);

                // Id déterministe (tenant + source + cible + type) : une même
                // dépendance n'est jamais dupliquée, même au ré-import.
                var relationId = DeterministicGuid.From(
                    tenantId.ToString(), sourceId.Value.ToString(), targetId.Value.ToString(), candidate.Type.Name);

                // Même arête déjà traitée dans ce run (ex : doublon via alias) : on ignore.
                if (!seenRelations.Add(relationId))
                {
                    continue;
                }

                var relation = GraphRelation.Create(
                    tenantId, sourceId.Value, targetId.Value, candidate.Type,
                    confidence.Value, ConfidenceStatus.Imported,
                    sourceSystem: profile.SourceSystem, sourceRecord: candidate.SourceKey,
                    id: relationId);

                if (relation.IsFailure)
                {
                    skipped++;   // ex : self-loop
                    continue;
                }

                await graph.UpsertRelationAsync(relation.Value, ct);
                relCreated++;
                timeToFirstGraph ??= sw.Elapsed;

                lineageBuffer.Add(new LineageEntry(
                    tenantId, null, relation.Value.Id.ToString(), connectorId, jobId, profile.SourceSystem, candidate.SourceKey));
            }
        }

        await lineage.WriteAsync(lineageBuffer, ct);
        sw.Stop();

        return new ImportResult(
            recordsRead, created, matched, relCreated, relUnresolved, skipped, sw.Elapsed, timeToFirstGraph);
    }

    private static Result<GraphEntity> BuildEntity(Guid tenantId, EntityCandidate candidate, string sourceSystem)
    {
        Criticality? criticality = null;
        if (candidate.Criticality is { } value)
        {
            var c = Criticality.Create(value);
            if (c.IsSuccess)
            {
                criticality = c.Value;
            }
        }

        return GraphEntity.Create(
            tenantId, candidate.Type, candidate.Name,
            criticality: criticality,
            aliases: candidate.Aliases,
            description: candidate.Description,
            sourceSystem: sourceSystem);
    }

    private async Task<Guid?> ResolveAsync(Guid tenantId, EntityType type, string name, Dictionary<string, Guid> cache, CancellationToken ct)
    {
        if (cache.TryGetValue(Key(type.Name, name), out var cached))
        {
            return cached;
        }

        var found = await resolver.FindExistingAsync(tenantId, type, name, [], ct);
        if (found is { } id)
        {
            Cache(cache, type.Name, name, id);
        }

        return found;
    }

    private static string Key(string type, string name) => $"{type}{KeySeparator}{name.Trim().ToLowerInvariant()}";

    private static void Cache(Dictionary<string, Guid> cache, string type, string name, Guid id) =>
        cache.TryAdd(Key(type, name), id);
}
