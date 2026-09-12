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
    int EntitiesCreated, int RelationsCreated,
    DateTime ScheduledFor, int? IntervalMinutes);

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

            -- Planification : une collecte récurrente se ré-inscrit elle-même à la
            -- fin de chaque exécution (pas de tâche de fond à superviser).
            ALTER TABLE collector_jobs ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NOT NULL DEFAULT now();
            ALTER TABLE collector_jobs ADD COLUMN IF NOT EXISTS interval_minutes integer;
            CREATE INDEX IF NOT EXISTS ix_jobs_due ON collector_jobs (collector_id, status, scheduled_for);
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

    /// <summary>
    /// Met une collecte en file. <paramref name="intervalMinutes"/> la rend
    /// RÉCURRENTE : à la fin de chaque exécution elle se ré-inscrit pour le
    /// prochain passage (une donnée qui n'est jamais rafraîchie se périme, et le
    /// moteur de preuves la décote).
    /// </summary>
    public async Task<Guid> EnqueueJobAsync(
        Guid tenant, Guid collectorId, string kind, string requestJson,
        int? intervalMinutes, DateTime? scheduledFor, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        var id = Guid.NewGuid();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO collector_jobs (id, tenant_id, collector_id, kind, request_json, status, created_at, scheduled_for, interval_minutes)
            VALUES (@id, @t, @c, @k, @r, 'pending', now(), COALESCE(@sf, now()), @iv);
            """;
        P(cmd, "@id", id); P(cmd, "@t", tenant); P(cmd, "@c", collectorId);
        P(cmd, "@k", kind); P(cmd, "@r", requestJson);
        P(cmd, "@sf", scheduledFor);
        P(cmd, "@iv", intervalMinutes is > 0 ? intervalMinutes : null);
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
                WHERE collector_id = @c AND status = 'pending' AND scheduled_for <= now()
                ORDER BY scheduled_for
                FOR UPDATE SKIP LOCKED
                LIMIT 1)
            RETURNING id, tenant_id, collector_id, kind, request_json, status, created_at,
                      completed_at, error, entities_created, relations_created,
                      scheduled_for, interval_minutes;
            """;
        P(cmd, "@c", collectorId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        return Read(r);
    }

    /// <summary>
    /// Clôt une collecte et, si elle est récurrente, inscrit d'office la
    /// suivante. La récurrence survit donc aux redémarrages du cloud comme de la
    /// sonde : il n'y a aucun ordonnanceur à surveiller.
    /// </summary>
    /// <summary>
    /// Clôt une collecte et, si elle est récurrente, inscrit d'office la suivante.
    ///
    /// SÉCURITÉ : l'écriture est bornée au tenant ET à la sonde propriétaires.
    /// Sans ce bornage, le porteur de n'importe quelle clé de sonde valide
    /// pourrait clore — et salir d'un message qu'il contrôle — une tâche
    /// appartenant à un AUTRE espace client. Renvoie false si la tâche n'existe
    /// pas ou n'appartient pas à cette sonde.
    /// </summary>
    public async Task<bool> CompleteJobAsync(
        Guid tenantId, Guid collectorId, Guid jobId,
        string status, string? error, int entities, int relations, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        int affected;
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                UPDATE collector_jobs
                SET status = @s, completed_at = now(), error = @e,
                    entities_created = @en, relations_created = @re
                WHERE id = @id AND tenant_id = @t AND collector_id = @c;
                """;
            P(cmd, "@id", jobId); P(cmd, "@t", tenantId); P(cmd, "@c", collectorId);
            P(cmd, "@s", status); P(cmd, "@e", error);
            P(cmd, "@en", entities); P(cmd, "@re", relations);
            affected = await cmd.ExecuteNonQueryAsync(ct);
        }

        if (affected == 0) return false;

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                INSERT INTO collector_jobs (id, tenant_id, collector_id, kind, request_json, status, created_at, scheduled_for, interval_minutes)
                SELECT gen_random_uuid(), tenant_id, collector_id, kind, request_json, 'pending', now(),
                       now() + make_interval(mins => interval_minutes), interval_minutes
                FROM collector_jobs
                WHERE id = @id AND tenant_id = @t AND collector_id = @c AND interval_minutes IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM collector_jobs n
                      WHERE n.collector_id = collector_jobs.collector_id
                        AND n.request_json = collector_jobs.request_json
                        AND n.status = 'pending');
                """;
            P(cmd, "@id", jobId); P(cmd, "@t", tenantId); P(cmd, "@c", collectorId);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        return true;
    }

    /// <summary>Vrai si la sonde existe ET appartient à cet espace de travail.</summary>
    public async Task<bool> OwnsCollectorAsync(Guid tenant, Guid collectorId, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT 1 FROM collectors WHERE id = @c AND tenant_id = @t;";
        P(cmd, "@c", collectorId); P(cmd, "@t", tenant);
        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    /// <summary>Révoque une sonde : sa clé cesse immédiatement de fonctionner et ses collectes sont retirées.</summary>
    public async Task<bool> RevokeAsync(Guid tenant, Guid collectorId, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using (var jobs = conn.CreateCommand())
        {
            jobs.CommandText = "DELETE FROM collector_jobs WHERE collector_id = @c AND tenant_id = @t;";
            P(jobs, "@c", collectorId); P(jobs, "@t", tenant);
            await jobs.ExecuteNonQueryAsync(ct);
        }
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM collectors WHERE id = @c AND tenant_id = @t;";
        P(cmd, "@c", collectorId); P(cmd, "@t", tenant);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    public async Task<IReadOnlyList<CollectorJob>> ListJobsAsync(Guid tenant, int limit, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, tenant_id, collector_id, kind, request_json, status, created_at,
                   completed_at, error, entities_created, relations_created,
                   scheduled_for, interval_minutes
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
        r.GetInt32(9), r.GetInt32(10),
        r.GetDateTime(11), r.IsDBNull(12) ? null : r.GetInt32(12));
}
