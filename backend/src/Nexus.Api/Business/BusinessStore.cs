using System.Data;
using System.Data.Common;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Business;

/// <summary>Modele d'entreprise personnalise, saisi via le formulaire (par tenant).</summary>
public sealed record StoredBusiness(string CompanyName, string Industry, BusinessDrivers Drivers);

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

    public async Task SaveAsync(Guid tenant, string companyName, string industry, BusinessDrivers drivers, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO business_models (tenant_id, company_name, industry, drivers_json, updated_at)
            VALUES (@t, @n, @i, @d, now())
            ON CONFLICT (tenant_id) DO UPDATE
                SET company_name = EXCLUDED.company_name, industry = EXCLUDED.industry,
                    drivers_json = EXCLUDED.drivers_json, updated_at = now();
            """;
        P(cmd, "@t", tenant); P(cmd, "@n", companyName.Trim()); P(cmd, "@i", industry.Trim());
        P(cmd, "@d", JsonSerializer.Serialize(drivers));
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
