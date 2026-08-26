using Neo4j.Driver;

namespace Nexus.Graph;

/// <summary>Projection d'un enregistrement Neo4j vers <see cref="GraphEntityRecord"/> (colonnes conventionnées).</summary>
internal static class GraphRecordMapper
{
    public static GraphEntityRecord MapEntity(IRecord r)
    {
        var aliases = r["aliases"] is null
            ? []
            : r["aliases"].As<List<object>>().Select(a => a.ToString() ?? string.Empty).ToList();

        return new GraphEntityRecord(
            Guid.Parse(r["id"].As<string>()),
            Guid.Parse(r["tenantId"].As<string>()),
            r["entityType"].As<string>(),
            r["name"].As<string>(),
            Convert.ToInt32(r["criticality"].As<long>()),
            aliases,
            r["description"]?.As<string>(),
            r["sourceSystem"]?.As<string>());
    }
}
