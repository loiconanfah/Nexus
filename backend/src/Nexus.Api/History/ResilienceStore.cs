using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.History;

/// <summary>
/// Relevés quotidiens de l'indice de résilience, un par espace et par jour.
///
/// L'écart est ce qui donne envie de revenir : « 62, plus 6 depuis lundi » dit
/// que le travail a servi, là où un nombre seul ne dit rien. Le relevé se fait
/// à la lecture, une fois par jour au plus : l'historique s'accumule sans
/// ordonnanceur à surveiller, et sans coûter un calcul de plus.
/// </summary>
public sealed class ResilienceStore(NexusDbContext db)
{
    public sealed record Reading(DateTime Day, int Total);

    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS resilience_history (
                tenant_id uuid NOT NULL,
                day date NOT NULL,
                total int NOT NULL,
                parts_json text,
                PRIMARY KEY (tenant_id, day));
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter(); p.ParameterName = name; p.Value = value ?? DBNull.Value; c.Parameters.Add(p);
    }

    /// <summary>Enregistre le relevé du jour (le dernier du jour fait foi).</summary>
    public async Task RecordAsync(Guid tenant, int total, string partsJson, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO resilience_history (tenant_id, day, total, parts_json)
            VALUES (@t, @d, @v, @p)
            ON CONFLICT (tenant_id, day) DO UPDATE SET total = EXCLUDED.total, parts_json = EXCLUDED.parts_json;
            """;
        P(cmd, "@t", tenant); P(cmd, "@d", DateTime.UtcNow.Date); P(cmd, "@v", total); P(cmd, "@p", partsJson);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Dernier relevé d'un jour ANTÉRIEUR : l'écart se mesure par rapport à une
    /// autre journée, sinon il vaut toujours zéro.
    /// </summary>
    public async Task<Reading?> PreviousAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT day, total FROM resilience_history
            WHERE tenant_id = @t AND day < @d
            ORDER BY day DESC LIMIT 1;
            """;
        P(cmd, "@t", tenant); P(cmd, "@d", DateTime.UtcNow.Date);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        return new Reading(r.GetDateTime(0), r.GetInt32(1));
    }

    /// <summary>Série des relevés, pour la courbe.</summary>
    public async Task<IReadOnlyList<Reading>> HistoryAsync(Guid tenant, int days, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT day, total FROM resilience_history
            WHERE tenant_id = @t AND day >= @from
            ORDER BY day;
            """;
        P(cmd, "@t", tenant); P(cmd, "@from", DateTime.UtcNow.Date.AddDays(-Math.Clamp(days, 1, 365)));
        var list = new List<Reading>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) list.Add(new Reading(r.GetDateTime(0), r.GetInt32(1)));
        return list;
    }
}
