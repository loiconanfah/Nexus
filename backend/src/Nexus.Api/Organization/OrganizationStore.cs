using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Organization;

/// <summary>
/// Profil de l'organisation, saisi par l'assistant de démarrage.
///
/// C'est le socle de tout le reste : la devise dans laquelle les montants
/// s'affichent, et les chiffres à partir desquels le coût d'une interruption est
/// étalonné. Un espace sans profil affiche des montants dans une devise qui
/// n'est peut-être pas la sienne, calculés sur des paliers qui ne sont pas les
/// siens.
/// </summary>
public sealed record OrganizationProfile(
    string Name,
    string Sector,
    string Country,
    string Currency,
    string SizeBand,
    double AnnualRevenue,
    int Headcount,
    string OperatingMode,
    DateTime? CompletedAt,
    DateTime UpdatedAt)
{
    public bool Completed => CompletedAt is not null;
}

/// <summary>Persistance du profil par tenant (table créée au vol, même patron que BusinessStore).</summary>
public sealed class OrganizationStore(NexusDbContext db)
{
    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS organization_profiles (
                tenant_id uuid PRIMARY KEY,
                name text NOT NULL,
                sector text NOT NULL,
                country text NOT NULL,
                currency text NOT NULL,
                size_band text NOT NULL,
                annual_revenue double precision NOT NULL DEFAULT 0,
                headcount integer NOT NULL DEFAULT 0,
                operating_mode text NOT NULL DEFAULT 'business',
                completed_at timestamptz,
                updated_at timestamptz NOT NULL DEFAULT now());
            CREATE TABLE IF NOT EXISTS onboarding_milestones (
                tenant_id uuid NOT NULL,
                key text NOT NULL,
                reached_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (tenant_id, key));
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter(); p.ParameterName = name; p.Value = value ?? DBNull.Value; c.Parameters.Add(p);
    }

    public async Task<OrganizationProfile?> GetAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT name, sector, country, currency, size_band, annual_revenue, headcount,
                   operating_mode, completed_at, updated_at
            FROM organization_profiles WHERE tenant_id = @t;
            """;
        P(cmd, "@t", tenant);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        return new OrganizationProfile(
            r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4),
            r.GetDouble(5), r.GetInt32(6), r.GetString(7),
            r.IsDBNull(8) ? null : r.GetDateTime(8), r.GetDateTime(9));
    }

    /// <summary>Enregistre le profil. L'état « terminé » n'est jamais remis à zéro par une mise à jour.</summary>
    public async Task SaveAsync(Guid tenant, OrganizationProfile p, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO organization_profiles
                (tenant_id, name, sector, country, currency, size_band, annual_revenue, headcount, operating_mode, updated_at)
            VALUES (@t, @n, @s, @c, @cur, @sz, @rev, @hc, @om, now())
            ON CONFLICT (tenant_id) DO UPDATE SET
                name = EXCLUDED.name, sector = EXCLUDED.sector, country = EXCLUDED.country,
                currency = EXCLUDED.currency, size_band = EXCLUDED.size_band,
                annual_revenue = EXCLUDED.annual_revenue, headcount = EXCLUDED.headcount,
                operating_mode = EXCLUDED.operating_mode, updated_at = now();
            """;
        P(cmd, "@t", tenant); P(cmd, "@n", p.Name); P(cmd, "@s", p.Sector); P(cmd, "@c", p.Country);
        P(cmd, "@cur", p.Currency); P(cmd, "@sz", p.SizeBand); P(cmd, "@rev", p.AnnualRevenue);
        P(cmd, "@hc", p.Headcount); P(cmd, "@om", p.OperatingMode);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task MarkCompletedAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE organization_profiles SET completed_at = COALESCE(completed_at, now()) WHERE tenant_id = @t;";
        P(cmd, "@t", tenant);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Devise de l'espace — le dollar canadien tant qu'aucun profil n'est saisi.</summary>
    public async Task<string> CurrencyAsync(Guid tenant, CancellationToken ct)
        => (await GetAsync(tenant, ct))?.Currency ?? Currencies.Default;

    /// <summary>
    /// Jalons qu'aucune donnée ne trace d'elle-même (une simulation n'est pas
    /// persistée, un rapport non plus) : ils sont notés une fois, au premier passage.
    /// </summary>
    public static readonly string[] MilestoneKeys = ["simulation", "report", "tour"];

    public async Task MarkMilestoneAsync(Guid tenant, string key, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO onboarding_milestones (tenant_id, key) VALUES (@t, @k) ON CONFLICT DO NOTHING;";
        P(cmd, "@t", tenant); P(cmd, "@k", key);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyDictionary<string, DateTime>> MilestonesAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT key, reached_at FROM onboarding_milestones WHERE tenant_id = @t;";
        P(cmd, "@t", tenant);
        var map = new Dictionary<string, DateTime>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) map[r.GetString(0)] = r.GetDateTime(1);
        return map;
    }
}
