using System.Data;
using System.Data.Common;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;
using Nexus.Risk.Reporting;

namespace Nexus.Api.History;

/// <summary>
/// Historique du Digital Twin (article 44) : instantanes horodates des metriques
/// cles (sante, SPOF, risques...) pour tracer l'evolution dans le temps. Stocke
/// dans Postgres via une table creee au vol (aucune migration requise).
/// </summary>
public sealed class HistoryService(NexusDbContext db, ReportService reports)
{
    public sealed record Snapshot(
        Guid Id, DateTimeOffset CapturedAt, int HealthScore, int EntityCount, int RelationCount,
        int SpofCount, int CriticalSpofCount, int CriticalAssetCount, int SupplierConcentrationPercent,
        IReadOnlyList<SpofName> TopSpofs);

    public sealed record SpofName(string Name, double Score);

    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS graph_snapshots (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                captured_at timestamptz NOT NULL,
                health_score int, entity_count int, relation_count int,
                spof_count int, critical_spof_count int, critical_asset_count int,
                supplier_concentration int, top_spofs text);
            CREATE INDEX IF NOT EXISTS ix_snap_tenant ON graph_snapshots (tenant_id, captured_at);
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter();
        p.ParameterName = name;
        p.Value = value ?? DBNull.Value;
        c.Parameters.Add(p);
    }

    /// <summary>Capture un instantané des métriques courantes.</summary>
    public async Task<Snapshot> CaptureAsync(Guid tenant, CancellationToken ct)
    {
        var r = await reports.GenerateAsync(tenant, ct);
        var conn = await OpenAsync(ct);
        var topSpofs = r.SinglePointsOfFailure.Take(8).Select(s => new SpofName(s.Name, s.Score)).ToList();
        var snap = new Snapshot(Guid.NewGuid(), DateTimeOffset.UtcNow, r.OrganizationHealthScore, r.EntityCount,
            r.RelationCount, r.SpofCount, r.CriticalSpofCount, r.CriticalAssetCount, r.SupplierConcentrationPercent, topSpofs);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO graph_snapshots (id, tenant_id, captured_at, health_score, entity_count, relation_count,
                spof_count, critical_spof_count, critical_asset_count, supplier_concentration, top_spofs)
            VALUES (@id, @t, @at, @h, @e, @r, @s, @cs, @ca, @sc, @ts);
            """;
        P(cmd, "@id", snap.Id); P(cmd, "@t", tenant); P(cmd, "@at", snap.CapturedAt);
        P(cmd, "@h", snap.HealthScore); P(cmd, "@e", snap.EntityCount); P(cmd, "@r", snap.RelationCount);
        P(cmd, "@s", snap.SpofCount); P(cmd, "@cs", snap.CriticalSpofCount); P(cmd, "@ca", snap.CriticalAssetCount);
        P(cmd, "@sc", snap.SupplierConcentrationPercent); P(cmd, "@ts", JsonSerializer.Serialize(topSpofs));
        await cmd.ExecuteNonQueryAsync(ct);
        return snap;
    }

    /// <summary>Liste les instantanés du tenant (ordre chronologique croissant).</summary>
    public async Task<IReadOnlyList<Snapshot>> ListAsync(Guid tenant, int limit, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, captured_at, health_score, entity_count, relation_count, spof_count,
                   critical_spof_count, critical_asset_count, supplier_concentration, top_spofs
            FROM graph_snapshots WHERE tenant_id = @t ORDER BY captured_at DESC LIMIT @lim;
            """;
        P(cmd, "@t", tenant); P(cmd, "@lim", limit);

        var list = new List<Snapshot>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var tsJson = reader.IsDBNull(9) ? "[]" : reader.GetString(9);
            var tops = JsonSerializer.Deserialize<List<SpofName>>(tsJson) ?? [];
            list.Add(new Snapshot(
                reader.GetGuid(0), reader.GetFieldValue<DateTimeOffset>(1), reader.GetInt32(2), reader.GetInt32(3),
                reader.GetInt32(4), reader.GetInt32(5), reader.GetInt32(6), reader.GetInt32(7), reader.GetInt32(8), tops));
        }
        list.Reverse(); // chronologique croissant pour les courbes
        return list;
    }
}
