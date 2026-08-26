using System.Text;
using Neo4j.Driver;
using Nexus.Domain.Ontology;

namespace Nexus.Graph;

/// <summary>Résolution d'entités sur Neo4j (exact/alias + full-text).</summary>
public sealed class Neo4jEntityResolver(INeo4jConnection connection) : IEntityResolver
{
    public async Task<Guid?> FindExistingAsync(
        Guid tenantId, EntityType type, string name, IReadOnlyList<string> aliases, CancellationToken ct = default)
    {
        const string cypher = """
            MATCH (n:Entity { tenantId: $tenantId, entityType: $type })
            WHERE n.validUntil IS NULL AND (
                  toLower(n.name) = toLower($name)
               OR any(a IN coalesce(n.aliases, []) WHERE toLower(a) = toLower($name))
               OR any(c IN $aliases WHERE toLower(n.name) = toLower(c)
                      OR any(a IN coalesce(n.aliases, []) WHERE toLower(a) = toLower(c)))
            )
            RETURN n.id AS id
            LIMIT 1
            """;

        var records = await connection.ReadAsync(cypher, new
        {
            tenantId = tenantId.ToString(),
            type = type.Name,
            name,
            aliases = aliases.ToArray()
        }, ct);

        return records.Count == 0 ? null : Guid.Parse(records[0]["id"].As<string>());
    }

    public async Task<IReadOnlyList<FuzzyMatch>> FindSimilarAsync(
        Guid tenantId, string name, int limit = 5, CancellationToken ct = default)
    {
        var query = BuildFuzzyQuery(name);
        if (query.Length == 0)
        {
            return [];
        }

        const string cypher = """
            CALL db.index.fulltext.queryNodes('entity_search', $query) YIELD node, score
            WHERE node.tenantId = $tenantId AND node.validUntil IS NULL
            RETURN node.id AS id, node.name AS name, node.entityType AS entityType, score
            LIMIT $limit
            """;

        var records = await connection.ReadAsync(cypher, new
        {
            query,
            tenantId = tenantId.ToString(),
            limit
        }, ct);

        return records.Select(r => new FuzzyMatch(
            Guid.Parse(r["id"].As<string>()),
            r["name"].As<string>(),
            r["entityType"].As<string>(),
            r["score"].As<double>())).ToList();
    }

    /// <summary>
    /// Construit une requête Lucene sûre : ne garde que les termes alphanumériques
    /// et applique une tolérance floue (~) pour capter les fautes de frappe.
    /// </summary>
    private static string BuildFuzzyQuery(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return string.Empty;
        }

        var terms = name.Split([' ', '\t', '-', '_', '.', '/', '\\'], StringSplitOptions.RemoveEmptyEntries);
        var sb = new StringBuilder();

        foreach (var term in terms)
        {
            var clean = new string(term.Where(char.IsLetterOrDigit).ToArray());
            if (clean.Length == 0)
            {
                continue;
            }

            if (sb.Length > 0)
            {
                sb.Append(' ');
            }

            // Terme approximatif si assez long, sinon exact.
            sb.Append(clean.Length >= 4 ? $"{clean}~" : clean);
        }

        return sb.ToString();
    }
}
