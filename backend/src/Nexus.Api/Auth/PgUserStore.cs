using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Auth;

/// <summary>
/// Magasin d'utilisateurs persistant (Postgres). Remplace le stub en mémoire :
/// les comptes créés par inscription libre survivent aux redémarrages. Table
/// créée au vol (aucune migration requise), même patron que HistoryService.
/// </summary>
public sealed class PgUserStore(NexusDbContext db)
{
    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS app_users (
                email text PRIMARY KEY,
                password_hash text NOT NULL,
                tenant_id uuid NOT NULL,
                role text NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now());
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

    public async Task<NexusUser?> FindAsync(string email, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT email, password_hash, tenant_id, role FROM app_users WHERE lower(email) = lower(@e);";
        P(cmd, "@e", email.Trim());
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new NexusUser(reader.GetString(0), reader.GetString(1), reader.GetGuid(2), reader.GetString(3));
    }

    public async Task<bool> ExistsAsync(string email, CancellationToken ct)
        => await FindAsync(email, ct) is not null;

    /// <summary>Insère un nouvel utilisateur. Retourne false si l'e-mail existe déjà.</summary>
    public async Task<bool> AddAsync(NexusUser user, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO app_users (email, password_hash, tenant_id, role)
            VALUES (@e, @h, @t, @r)
            ON CONFLICT (email) DO NOTHING;
            """;
        P(cmd, "@e", user.Email.Trim()); P(cmd, "@h", user.PasswordHash);
        P(cmd, "@t", user.TenantId); P(cmd, "@r", user.Role);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        return rows > 0;
    }

    /// <summary>Amorce l'admin de démo s'il n'existe pas déjà (idempotent).</summary>
    public async Task EnsureSeedAsync(string email, string password, Guid tenant, string role, CancellationToken ct)
    {
        if (await ExistsAsync(email, ct)) return;
        await AddAsync(new NexusUser(email, PasswordHasher.Hash(password), tenant, role), ct);
    }
}
