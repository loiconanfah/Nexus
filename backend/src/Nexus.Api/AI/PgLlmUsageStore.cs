using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Nexus.AI;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.AI;

/// <summary>Persistance de la consommation LLM par tenant/mois (table créée au vol).</summary>
public sealed class PgLlmUsageStore(NexusDbContext db) : ILlmUsageStore
{
    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS llm_usage (
                tenant_id uuid NOT NULL,
                period text NOT NULL,
                calls integer NOT NULL DEFAULT 0,
                chars bigint NOT NULL DEFAULT 0,
                updated_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (tenant_id, period));
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter(); p.ParameterName = name; p.Value = value ?? DBNull.Value; c.Parameters.Add(p);
    }

    public async Task<LlmUsage> GetAsync(Guid tenant, string period, CancellationToken ct = default)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT calls, chars FROM llm_usage WHERE tenant_id = @t AND period = @p;";
        P(cmd, "@t", tenant); P(cmd, "@p", period);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return new LlmUsage(0, 0);
        return new LlmUsage(reader.GetInt32(0), reader.GetInt64(1));
    }

    public async Task IncrementAsync(Guid tenant, string period, int calls, long chars, CancellationToken ct = default)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO llm_usage (tenant_id, period, calls, chars, updated_at)
            VALUES (@t, @p, @c, @ch, now())
            ON CONFLICT (tenant_id, period) DO UPDATE
                SET calls = llm_usage.calls + EXCLUDED.calls,
                    chars = llm_usage.chars + EXCLUDED.chars,
                    updated_at = now();
            """;
        P(cmd, "@t", tenant); P(cmd, "@p", period); P(cmd, "@c", calls); P(cmd, "@ch", chars);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
