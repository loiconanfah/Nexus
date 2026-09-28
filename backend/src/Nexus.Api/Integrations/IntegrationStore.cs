using System.Data;
using System.Data.Common;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Integrations;

/// <summary>Un branchement enregistré vers un système du client.</summary>
public sealed record Integration(
    Guid Id,
    Guid TenantId,
    string VendorId,
    string Label,
    /// <summary>Réglages non secrets, affichables (instance, région, abonnement).</summary>
    IReadOnlyDictionary<string, string> Settings,
    /// <summary>Périodicité du rafraîchissement, en minutes. Zéro veut dire manuel.</summary>
    int IntervalMinutes,
    DateTime? NextRunAt,
    DateTime? LastRunAt,
    string? LastOutcome,
    bool Healthy,
    string? CreatedBy,
    DateTime CreatedAt);

/// <summary>
/// Les branchements d'un espace de travail, avec leurs accès.
///
/// Le cœur du sujet est la FRAÎCHEUR : une cartographie qui ne se relit pas
/// vieillit, et le moteur de confiance la décote jusqu'à ce qu'elle ne vaille
/// plus rien. Un branchement porte donc sa périodicité et sa prochaine échéance,
/// et survit aux redémarrages puisque l'échéance vit en base et non en mémoire.
///
/// Les secrets sont chiffrés par <see cref="SecretBox"/>. Les réglages non
/// secrets restent lisibles : l'écran doit pouvoir rappeler quelle instance est
/// branchée sans demander de ressaisir un mot de passe.
/// </summary>
public sealed class IntegrationStore(NexusDbContext db, SecretBox secrets)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS integrations (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                vendor_id text NOT NULL,
                label text NOT NULL,
                settings_json text NOT NULL DEFAULT '{}',
                secrets_sealed text,
                interval_minutes int NOT NULL DEFAULT 0,
                next_run_at timestamptz,
                last_run_at timestamptz,
                last_outcome text,
                healthy boolean NOT NULL DEFAULT true,
                created_by text,
                created_at timestamptz NOT NULL DEFAULT now());
            CREATE INDEX IF NOT EXISTS ix_integrations_tenant ON integrations (tenant_id);
            CREATE INDEX IF NOT EXISTS ix_integrations_due ON integrations (next_run_at)
                WHERE next_run_at IS NOT NULL;
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter(); p.ParameterName = name; p.Value = value ?? DBNull.Value; c.Parameters.Add(p);
    }

    private const string Columns =
        "id, tenant_id, vendor_id, label, settings_json, interval_minutes, next_run_at, last_run_at, last_outcome, healthy, created_by, created_at";

    private static Integration Read(DbDataReader r) => new(
        r.GetGuid(0), r.GetGuid(1), r.GetString(2), r.GetString(3),
        JsonSerializer.Deserialize<Dictionary<string, string>>(r.GetString(4), Json) ?? [],
        r.GetInt32(5),
        r.IsDBNull(6) ? null : r.GetDateTime(6),
        r.IsDBNull(7) ? null : r.GetDateTime(7),
        r.IsDBNull(8) ? null : r.GetString(8),
        r.GetBoolean(9),
        r.IsDBNull(10) ? null : r.GetString(10),
        r.GetDateTime(11));

    public async Task<IReadOnlyList<Integration>> ListAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT {Columns} FROM integrations WHERE tenant_id = @t ORDER BY created_at;";
        P(cmd, "@t", tenant);
        var list = new List<Integration>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) list.Add(Read(r));
        return list;
    }

    public async Task<Integration?> GetAsync(Guid tenant, Guid id, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT {Columns} FROM integrations WHERE tenant_id = @t AND id = @i;";
        P(cmd, "@t", tenant); P(cmd, "@i", id);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct) ? Read(r) : null;
    }

    /// <summary>
    /// Les réglages COMPLETS, secrets déchiffrés compris. Réservé à l'exécution
    /// d'un import : rien de ce qui sort d'ici ne doit atteindre une réponse HTTP.
    /// </summary>
    public async Task<Dictionary<string, string>?> ResolveSettingsAsync(Guid tenant, Guid id, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT settings_json, secrets_sealed FROM integrations WHERE tenant_id = @t AND id = @i;";
        P(cmd, "@t", tenant); P(cmd, "@i", id);

        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;

        var settings = JsonSerializer.Deserialize<Dictionary<string, string>>(r.GetString(0), Json) ?? [];
        if (!r.IsDBNull(1) && secrets.Unprotect(r.GetString(1)) is { } opened)
            foreach (var (key, value) in JsonSerializer.Deserialize<Dictionary<string, string>>(opened, Json) ?? [])
                settings[key] = value;
        return settings;
    }

    public async Task<Integration> SaveAsync(
        Guid tenant,
        Guid? id,
        string vendorId,
        string label,
        IReadOnlyDictionary<string, string> plain,
        IReadOnlyDictionary<string, string> secret,
        int intervalMinutes,
        string? by,
        CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        var identifier = id ?? Guid.NewGuid();
        var next = intervalMinutes > 0 ? DateTime.UtcNow.AddMinutes(intervalMinutes) : (DateTime?)null;
        var sealedSecrets = secret.Count == 0 ? null : secrets.Protect(JsonSerializer.Serialize(secret, Json));

        await using var cmd = conn.CreateCommand();
        // Une modification qui ne renvoie pas les secrets ne doit pas les effacer :
        // l'écran ne les affiche jamais, l'utilisateur ne peut donc pas les
        // ressaisir à chaque changement de périodicité.
        cmd.CommandText = """
            INSERT INTO integrations (id, tenant_id, vendor_id, label, settings_json, secrets_sealed,
                                      interval_minutes, next_run_at, created_by)
            VALUES (@i, @t, @v, @l, @s, @k, @m, @n, @by)
            ON CONFLICT (id) DO UPDATE SET
                label = EXCLUDED.label,
                settings_json = EXCLUDED.settings_json,
                secrets_sealed = COALESCE(EXCLUDED.secrets_sealed, integrations.secrets_sealed),
                interval_minutes = EXCLUDED.interval_minutes,
                next_run_at = EXCLUDED.next_run_at;
            """;
        P(cmd, "@i", identifier); P(cmd, "@t", tenant); P(cmd, "@v", vendorId); P(cmd, "@l", label);
        P(cmd, "@s", JsonSerializer.Serialize(plain, Json)); P(cmd, "@k", sealedSecrets);
        P(cmd, "@m", intervalMinutes); P(cmd, "@n", next); P(cmd, "@by", by);
        await cmd.ExecuteNonQueryAsync(ct);

        return (await GetAsync(tenant, identifier, ct))!;
    }

    public async Task<bool> DeleteAsync(Guid tenant, Guid id, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM integrations WHERE tenant_id = @t AND id = @i;";
        P(cmd, "@t", tenant); P(cmd, "@i", id);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    /// <summary>Consigne le résultat d'un import et replanifie le suivant.</summary>
    public async Task RecordRunAsync(Guid id, bool healthy, string outcome, int intervalMinutes, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE integrations SET last_run_at = now(), last_outcome = @o, healthy = @h,
                next_run_at = CASE WHEN @m > 0 THEN now() + (@m * interval '1 minute') ELSE NULL END
            WHERE id = @i;
            """;
        P(cmd, "@i", id); P(cmd, "@o", outcome.Length > 400 ? outcome[..400] : outcome);
        P(cmd, "@h", healthy); P(cmd, "@m", intervalMinutes);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Les branchements dus, tous espaces confondus. Réservé au planificateur :
    /// l'échéance est portée en base, donc un redémarrage ne perd aucun
    /// rafraîchissement, il le retarde au plus.
    /// </summary>
    public async Task<IReadOnlyList<(Guid Id, Guid TenantId, string VendorId, int IntervalMinutes)>> DueAsync(
        int limit, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, tenant_id, vendor_id, interval_minutes FROM integrations
            WHERE next_run_at IS NOT NULL AND next_run_at <= now()
            ORDER BY next_run_at LIMIT @l;
            """;
        P(cmd, "@l", Math.Clamp(limit, 1, 50));
        var list = new List<(Guid, Guid, string, int)>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) list.Add((r.GetGuid(0), r.GetGuid(1), r.GetString(2), r.GetInt32(3)));
        return list;
    }
}
