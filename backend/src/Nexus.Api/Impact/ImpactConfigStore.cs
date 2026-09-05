using System.Data;
using System.Data.Common;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;
using Nexus.Risk;

namespace Nexus.Api.Impact;

/// <summary>
/// Persistance par tenant des réglages du modèle d'impact (<see cref="ImpactTuning"/>).
/// Table créée au vol (même patron que BusinessStore). En l'absence de réglage
/// stocké, le service utilise <see cref="ImpactTuning.Default"/>.
/// </summary>
public sealed class ImpactConfigStore(NexusDbContext db)
{
    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS impact_config (
                tenant_id uuid PRIMARY KEY,
                config_json text NOT NULL,
                updated_at timestamptz NOT NULL DEFAULT now());
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    /// <summary>Réglages stockés du tenant, ou null si aucun (⇒ défaut produit).</summary>
    public async Task<ImpactTuning?> GetAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT config_json FROM impact_config WHERE tenant_id = @t;";
        var p = cmd.CreateParameter(); p.ParameterName = "@t"; p.Value = tenant; cmd.Parameters.Add(p);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        try { return JsonSerializer.Deserialize<ImpactTuning>(reader.GetString(0)); }
        catch { return null; }
    }

    /// <summary>Réglages EFFECTIFS : ceux du tenant s'ils existent, sinon les défauts.</summary>
    public async Task<ImpactTuning> GetEffectiveAsync(Guid tenant, CancellationToken ct)
        => await GetAsync(tenant, ct) ?? ImpactTuning.Default;

    public async Task SaveAsync(Guid tenant, ImpactTuning tuning, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO impact_config (tenant_id, config_json, updated_at)
            VALUES (@t, @j, now())
            ON CONFLICT (tenant_id) DO UPDATE SET config_json = EXCLUDED.config_json, updated_at = now();
            """;
        var pt = cmd.CreateParameter(); pt.ParameterName = "@t"; pt.Value = tenant; cmd.Parameters.Add(pt);
        var pj = cmd.CreateParameter(); pj.ParameterName = "@j"; pj.Value = JsonSerializer.Serialize(tuning); cmd.Parameters.Add(pj);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Réinitialise aux valeurs par défaut (supprime le réglage stocké).</summary>
    public async Task ResetAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM impact_config WHERE tenant_id = @t;";
        var p = cmd.CreateParameter(); p.ParameterName = "@t"; p.Value = tenant; cmd.Parameters.Add(p);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
