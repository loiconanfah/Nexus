using Neo4j.Driver;

namespace Nexus.Graph;

/// <summary>
/// Abstraction fine au-dessus du driver Neo4j : ouvre des sessions et exécute
/// des requêtes Cypher paramétrées (jamais de concaténation — SECURITY.md §8).
/// </summary>
public interface INeo4jConnection : IAsyncDisposable
{
    /// <summary>Exécute une requête d'écriture et renvoie les enregistrements produits.</summary>
    Task<IReadOnlyList<IRecord>> WriteAsync(string cypher, object parameters, CancellationToken ct = default);

    /// <summary>Exécute une requête de lecture et renvoie les enregistrements produits.</summary>
    Task<IReadOnlyList<IRecord>> ReadAsync(string cypher, object parameters, CancellationToken ct = default);

    /// <summary>Vérifie la connectivité au serveur Neo4j (healthcheck).</summary>
    Task<bool> VerifyConnectivityAsync(CancellationToken ct = default);
}
