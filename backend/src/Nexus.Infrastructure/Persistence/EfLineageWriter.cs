using Nexus.Application.Lineage;
using Nexus.Infrastructure.Persistence.Entities;

namespace Nexus.Infrastructure.Persistence;

/// <summary>Implémentation EF Core du port <see cref="ILineageWriter"/> (PostgreSQL).</summary>
public sealed class EfLineageWriter(NexusDbContext db) : ILineageWriter
{
    public async Task WriteAsync(IReadOnlyCollection<LineageEntry> entries, CancellationToken ct = default)
    {
        if (entries.Count == 0)
        {
            return;
        }

        var rows = entries.Select(e => new DataLineage
        {
            TenantId = e.TenantId,
            GraphNodeId = e.GraphNodeId,
            GraphEdgeId = e.GraphEdgeId,
            ConnectorId = e.ConnectorId,
            JobId = e.JobId,
            SourceSystem = e.SourceSystem,
            SourceRecord = e.SourceRecord,
            Transformed = e.Transformed,
            Inferred = e.Inferred
        });

        db.DataLineage.AddRange(rows);
        await db.SaveChangesAsync(ct);
    }
}
