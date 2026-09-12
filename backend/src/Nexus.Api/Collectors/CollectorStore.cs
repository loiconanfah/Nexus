using System.Data;
using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Collectors;

/// <summary>Un Collector enregistré : une sonde installée dans le réseau d'un client.</summary>
public sealed record CollectorInfo(
    Guid Id, Guid TenantId, string Name, string? Version,
    DateTime CreatedAt, DateTime? LastSeenAt);

/// <summary>Une tâche de collecte confiée à un Collector.</summary>
public sealed record CollectorJob(
    Guid Id, Guid TenantId, Guid CollectorId, string Kind, string RequestJson,
    string Status, DateTime CreatedAt, DateTime? CompletedAt, string? Error,
    int EntitiesCreated, int RelationsCreated);

/// <summary>
/// Registre des Collectors et de leurs tâches. Le Collector n'expose AUCUN port :
/// il s'authentifie par clé et vient CHERCHER son travail en sortant (HTTPS),
/// ce qui n'exige aucune ouverture de pare-feu entrante chez le client.
/// Tables créées au vol (même patron que BusinessStore / ImpactConfigStore).
/// </summary>
public sealed class CollectorStore(NexusDbContext db)
{
    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS collectors (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name text NOT NULL,
                key_hash text NOT NULL,
                version text,
                created_at timestamptz NOT NULL DEFAULT now(),
                last_seen_at timestamptz);
            CREATE INDEX IF NOT EXISTS ix_collectors_tenant ON collectors (tenant_id);
            CREATE INDEX IF NOT EXISTS ix_collectors_key ON collectors (key_hash);

            CREATE TABLE IF NOT EXISTS collector_jobs (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                collector_id uuid NOT NULL,
                kind text NOT NULL,
                request_json text NOT NULL,
                status text NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                claimed_at timestamptz,
                completed_at timestamptz,
                error text,
                entities_created integer NOT NULL DEFAULT 0,
                relations_created integer NOT NULL DEFAULT 0);
            CREATE INDEX IF NOT EXISTS ix_jobs_collector ON collector_jobs (collector_id, status);
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter(); p.ParameterName = name; p.Value = value ?? DBNull.Value; c.Parameters.Add(p);
    }

    /// <summary>Empreinte de la clé : la clé en clair n'est JAMAIS stockée.</summary>
    public static string HashKey(string key)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key))).ToLowerInvariant();

    private static string NewKey()
        => "lxc_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();

    /// <summary>
    /// Crée un Collector et renvoie sa clé EN CLAIR — affichée une seule fois,
    /// à reporter dans la configuration de la sonde.
    /// </summary>
    public async Task<(CollectorInfo Collector, string Key)> CreateAsync(Guid tenant, string name, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        var id = Guid.NewGuid();
        var key = NewKey();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO collectors (id, tenant_id, name, key_hash, created_at)
            VALUES (@id, @t, @n, @k, now())
            RETURNING created_at;
            """;
        P(cmd, "@id", id); P(cmd, "@t", tenant); P(cmd, "@n", name.Trim()); P(cmd, "@k", HashKey(key));
        var createdAt = (DateTime)(await cmd.ExecuteScalarAsync(ct))!;

        return (new CollectorInfo(id, tenant, name.Trim(), null, createdAt, null), key);
    }

    public async Task<IReadOnlyList<CollectorInfo>> ListAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, tenant_id, name, version, created_at, last_seen_at FROM collectors WHERE tenant_id = @t ORDER BY created_at;";
        P(cmd, "@t", tenant);
        var list = new List<CollectorInfo>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(new CollectorInfo(r.GetGuid(0), r.GetGuid(1), r.GetString(2),
                r.IsDBNull(3) ? null : r.GetString(3), r.GetDateTime(4), r.IsDBNull(5) ? null : r.GetDateTime(5)));
        return list;
    }

    /// <summary>Authentifie une sonde par sa clé (comparée par empreinte).</summary>
    public async Task<CollectorInfo?> AuthenticateAsync(string key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, tenant_id, name, version, created_at, last_seen_at FROM collectors WHERE key_hash = @k;";
        P(cmd, "@k", HashKey(key));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        return new CollectorInfo(r.GetGuid(0), r.GetGuid(1), r.GetString(2),
            r.IsDBNull(3) ? null : r.GetString(3), r.GetDateTime(4), r.IsDBNull(5) ? null : r.GetDateTime(5));
    }

    public async Task TouchAsync(Guid collectorId, string? version, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE collectors SET last_seen_at = now(), version = COALESCE(@v, version) WHERE id = @id;";
        P(cmd, "@id", collectorId); P(cmd, "@v", version);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<Guid> EnqueueJobAsync(Guid tenant, Guid collectorId, string kind, string requestJson, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        var id = Guid.NewGuid();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO collector_jobs (id, tenant_id, collector_id, kind, request_json, status, created_at)
            VALUES (@id, @t, @c, @k, @r, 'pending', now());
            """;
        P(cmd, "@id", id); P(cmd, "@t", tenant); P(cmd, "@c", collectorId);
        P(cmd, "@k", kind); P(cmd, "@r", requestJson);
        await cmd.ExecuteNonQueryAsync(ct);
        return id;
    }

    /// <summary>
    /// Réserve atomiquement la prochaine tâche en attente (SKIP LOCKED : plusieurs
    /// sondes peuvent tirer sans se marcher dessus).
    /// </summary>
    public async Task<CollectorJob?> ClaimNextAsync(Guid collectorId, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE collector_jobs SET status = 'running', claimed_at = now()
            WHERE id = (
                SELECT id FROM collector_jobs
                WHERE collector_id = @c AND status = 'pending'
                ORDER BY created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1)
            RETURNING id, tenant_id, collector_id, kind, request_json, status, created_at,
                      completed_at, error, entities_created, relations_created;
            """;
        P(cmd, "@c", collectorId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        return Read(r);
    }

    public async Task CompleteJobAsync(Guid jobId, string status, string? error, int entities, int relations, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE collector_jobs
            SET status = @s, completed_at = now(), error = @e,
                entities_created = @en, relations_created = @re
            WHERE id = @id;
            """;
        P(cmd, "@id", jobId); P(cmd, "@s", status); P(cmd, "@e", error);
        P(cmd, "@en", entities); P(cmd, "@re", relations);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyList<CollectorJob>> ListJobsAsync(Guid tenant, int limit, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, tenant_id, collector_id, kind, request_json, status, created_at,
                   completed_at, error, entities_created, relations_created
            FROM collector_jobs WHERE tenant_id = @t ORDER BY created_at DESC LIMIT @lim;
            """;
        P(cmd, "@t", tenant); P(cmd, "@lim", Math.Clamp(limit, 1, 500));
        var list = new List<CollectorJob>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) list.Add(Read(r));
        return list;
    }

    private static CollectorJob Read(DbDataReader r) => new(
        r.GetGuid(0), r.GetGuid(1), r.GetGuid(2), r.GetString(3), r.GetString(4), r.GetString(5),
        r.GetDateTime(6), r.IsDBNull(7) ? null : r.GetDateTime(7), r.IsDBNull(8) ? null : r.GetString(8),
        r.GetInt32(9), r.GetInt32(10));
}
