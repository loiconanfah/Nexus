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

        // Coût/h réel (propriété de nœud dédiée) : présent seulement dans les
        // requêtes qui le sélectionnent — tolérant à son absence.
        double? costPerHour = null;
        if (r.Keys.Contains("costPerHour") && r["costPerHour"] is not null)
        {
            var c = r["costPerHour"].As<double?>();
            if (c is > 0) costPerHour = c;
        }

        return new GraphEntityRecord(
            Guid.Parse(r["id"].As<string>()),
            Guid.Parse(r["tenantId"].As<string>()),
            r["entityType"].As<string>(),
            r["name"].As<string>(),
            Convert.ToInt32(r["criticality"].As<long>()),
            aliases,
            r["description"]?.As<string>(),
            r["sourceSystem"]?.As<string>(),
            costPerHour);
    }
}
