using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Business;

/// <summary>Scénario de décision sauvegardé (leviers + éléments + relations du diagramme).</summary>
public sealed record SavedScenario(Guid Id, string Name, string Payload, DateTimeOffset CreatedAt);

/// <summary>
/// Persistance des scénarios de décision par tenant (table créée au vol, même
/// patron que HistoryService). Le payload est un JSON libre produit par le
/// frontend (leviers/éléments/relations).
/// </summary>
public sealed class ScenarioStore(NexusDbContext db)
{
    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS decision_scenarios (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name text NOT NULL,
                payload text NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now());
            CREATE INDEX IF NOT EXISTS ix_scenario_tenant ON decision_scenarios (tenant_id, created_at);
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter(); p.ParameterName = name; p.Value = value ?? DBNull.Value; c.Parameters.Add(p);
    }

    public async Task<IReadOnlyList<SavedScenario>> ListAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, name, payload, created_at FROM decision_scenarios WHERE tenant_id = @t ORDER BY created_at DESC LIMIT 100;";
        P(cmd, "@t", tenant);
        var list = new List<SavedScenario>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            list.Add(new SavedScenario(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetFieldValue<DateTimeOffset>(3)));
        return list;
    }

    public async Task<Guid> SaveAsync(Guid tenant, string name, string payload, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        var id = Guid.NewGuid();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO decision_scenarios (id, tenant_id, name, payload) VALUES (@id, @t, @n, @p);";
        P(cmd, "@id", id); P(cmd, "@t", tenant); P(cmd, "@n", name); P(cmd, "@p", payload);
        await cmd.ExecuteNonQueryAsync(ct);
        return id;
    }

    public async Task DeleteAsync(Guid tenant, Guid id, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM decision_scenarios WHERE tenant_id = @t AND id = @id;";
        P(cmd, "@t", tenant); P(cmd, "@id", id);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
