using System.Data;
using System.Data.Common;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Business;

/// <summary>Modele d'entreprise personnalise, saisi via le formulaire (par tenant).</summary>
public sealed record StoredBusiness(string CompanyName, string Industry, BusinessDrivers Drivers);

/// <summary>Une version historisee du modele d'entreprise.</summary>
public sealed record BusinessVersion(Guid Id, int Version, string CompanyName, string Industry, BusinessDrivers Drivers, string? Note, DateTime CreatedAt);

/// <summary>
/// Persistance des leviers d'entreprise par tenant (table creee au vol, meme
/// patron que ScenarioStore). Permet a un espace sans modele de le CREER via le
/// formulaire, puis d'en deriver tous les etats financiers.
/// </summary>
public sealed class BusinessStore(NexusDbContext db)
{
    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS business_models (
                tenant_id uuid PRIMARY KEY,
                company_name text NOT NULL,
                industry text NOT NULL,
                drivers_json text NOT NULL,
                updated_at timestamptz NOT NULL DEFAULT now());
            CREATE TABLE IF NOT EXISTS business_model_history (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                version integer NOT NULL,
                company_name text NOT NULL,
                industry text NOT NULL,
                drivers_json text NOT NULL,
                note text,
                created_at timestamptz NOT NULL DEFAULT now());
            CREATE INDEX IF NOT EXISTS ix_bmh_tenant ON business_model_history (tenant_id, version DESC);
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter(); p.ParameterName = name; p.Value = value ?? DBNull.Value; c.Parameters.Add(p);
    }

    public async Task<StoredBusiness?> GetAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT company_name, industry, drivers_json FROM business_models WHERE tenant_id = @t;";
        P(cmd, "@t", tenant);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var drivers = JsonSerializer.Deserialize<BusinessDrivers>(reader.GetString(2));
        if (drivers is null) return null;
        return new StoredBusiness(reader.GetString(0), reader.GetString(1), drivers);
    }

    public async Task SaveAsync(Guid tenant, string companyName, string industry, BusinessDrivers drivers, string? note, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        var driversJson = JsonSerializer.Serialize(drivers);
        var name = companyName.Trim(); var ind = industry.Trim();

        // 1) Modele courant (upsert).
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                INSERT INTO business_models (tenant_id, company_name, industry, drivers_json, updated_at)
                VALUES (@t, @n, @i, @d, now())
                ON CONFLICT (tenant_id) DO UPDATE
                    SET company_name = EXCLUDED.company_name, industry = EXCLUDED.industry,
                        drivers_json = EXCLUDED.drivers_json, updated_at = now();
                """;
            P(cmd, "@t", tenant); P(cmd, "@n", name); P(cmd, "@i", ind); P(cmd, "@d", driversJson);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        // 2) Version historisee (chaque sauvegarde crée une entrée).
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                INSERT INTO business_model_history (id, tenant_id, version, company_name, industry, drivers_json, note, created_at)
                VALUES (@id, @t, (SELECT COALESCE(MAX(version), 0) + 1 FROM business_model_history WHERE tenant_id = @t), @n, @i, @d, @note, now());
                """;
            P(cmd, "@id", Guid.NewGuid()); P(cmd, "@t", tenant); P(cmd, "@n", name); P(cmd, "@i", ind);
            P(cmd, "@d", driversJson); P(cmd, "@note", note);
            await cmd.ExecuteNonQueryAsync(ct);
        }
    }

    public async Task<IReadOnlyList<BusinessVersion>> GetHistoryAsync(Guid tenant, int limit, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, version, company_name, industry, drivers_json, note, created_at FROM business_model_history WHERE tenant_id = @t ORDER BY version DESC LIMIT @lim;";
        P(cmd, "@t", tenant); P(cmd, "@lim", limit);
        var list = new List<BusinessVersion>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var drivers = JsonSerializer.Deserialize<BusinessDrivers>(reader.GetString(4));
            if (drivers is null) continue;
            list.Add(new BusinessVersion(reader.GetGuid(0), reader.GetInt32(1), reader.GetString(2), reader.GetString(3), drivers,
                reader.IsDBNull(5) ? null : reader.GetString(5), reader.GetDateTime(6)));
        }
        return list;
    }

    public async Task<BusinessVersion?> GetVersionAsync(Guid tenant, Guid versionId, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, version, company_name, industry, drivers_json, note, created_at FROM business_model_history WHERE tenant_id = @t AND id = @id;";
        P(cmd, "@t", tenant); P(cmd, "@id", versionId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var drivers = JsonSerializer.Deserialize<BusinessDrivers>(reader.GetString(4));
        if (drivers is null) return null;
        return new BusinessVersion(reader.GetGuid(0), reader.GetInt32(1), reader.GetString(2), reader.GetString(3), drivers,
            reader.IsDBNull(5) ? null : reader.GetString(5), reader.GetDateTime(6));
    }
}
