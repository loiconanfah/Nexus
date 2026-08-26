using Microsoft.Extensions.Options;
using Neo4j.Driver;

namespace Nexus.Graph;

/// <summary>
/// Implémentation de <see cref="INeo4jConnection"/> basée sur le driver officiel.
/// Le driver est thread-safe et coûteux à créer : il est enregistré en singleton.
/// </summary>
public sealed class Neo4jConnection : INeo4jConnection
{
    private readonly IDriver _driver;
    private readonly string _database;

    public Neo4jConnection(IOptions<Neo4jOptions> options)
    {
        var o = options.Value;
        _driver = GraphDatabase.Driver(o.Uri, AuthTokens.Basic(o.User, o.Password));
        _database = o.Database;
    }

    public Task<IReadOnlyList<IRecord>> WriteAsync(string cypher, object parameters, CancellationToken ct = default) =>
        ExecuteAsync(cypher, parameters, write: true, ct);

    public Task<IReadOnlyList<IRecord>> ReadAsync(string cypher, object parameters, CancellationToken ct = default) =>
        ExecuteAsync(cypher, parameters, write: false, ct);

    private async Task<IReadOnlyList<IRecord>> ExecuteAsync(string cypher, object parameters, bool write, CancellationToken ct)
    {
        await using var session = _driver.AsyncSession(c => c.WithDatabase(_database));

        Task<IReadOnlyList<IRecord>> Work(IAsyncQueryRunner tx) => RunAsync(tx, cypher, parameters);

        return write
            ? await session.ExecuteWriteAsync(Work)
            : await session.ExecuteReadAsync(Work);
    }

    private static async Task<IReadOnlyList<IRecord>> RunAsync(IAsyncQueryRunner tx, string cypher, object parameters)
    {
        var cursor = await tx.RunAsync(cypher, parameters);
        return await cursor.ToListAsync();
    }

    public async Task<bool> VerifyConnectivityAsync(CancellationToken ct = default)
    {
        try
        {
            await _driver.VerifyConnectivityAsync();
            return true;
        }
        catch (Neo4jException)
        {
            return false;
        }
        catch (System.Net.Sockets.SocketException)
        {
            return false;
        }
    }

    public async ValueTask DisposeAsync() => await _driver.DisposeAsync();
}
