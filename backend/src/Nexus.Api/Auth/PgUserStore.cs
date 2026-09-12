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

    /// <summary>Membres de l'espace de travail (sans les empreintes de mot de passe).</summary>
    public async Task<IReadOnlyList<(string Email, string Role, DateTime CreatedAt)>> ListByTenantAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT email, role, created_at FROM app_users WHERE tenant_id = @t ORDER BY created_at;";
        P(cmd, "@t", tenant);
        var list = new List<(string, string, DateTime)>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) list.Add((r.GetString(0), r.GetString(1), r.GetDateTime(2)));
        return list;
    }

    /// <summary>Nombre d'administrateurs — sert à ne jamais laisser un espace sans administrateur.</summary>
    public async Task<int> CountAdminsAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT count(*) FROM app_users WHERE tenant_id = @t AND lower(role) = 'admin';";
        P(cmd, "@t", tenant);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
    }

    /// <summary>Change le rôle d'un membre, en restant borné à l'espace de travail appelant.</summary>
    public async Task<bool> SetRoleAsync(Guid tenant, string email, string role, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE app_users SET role = @r WHERE tenant_id = @t AND lower(email) = lower(@e);";
        P(cmd, "@t", tenant); P(cmd, "@e", email.Trim()); P(cmd, "@r", role);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    /// <summary>Retire un membre de l'espace de travail.</summary>
    public async Task<bool> RemoveAsync(Guid tenant, string email, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM app_users WHERE tenant_id = @t AND lower(email) = lower(@e);";
        P(cmd, "@t", tenant); P(cmd, "@e", email.Trim());
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    /// <summary>Réinitialise le mot de passe d'un membre de l'espace (admin).</summary>
    public async Task<bool> SetPasswordAsync(Guid tenant, string email, string passwordHash, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE app_users SET password_hash = @h WHERE tenant_id = @t AND lower(email) = lower(@e);";
        P(cmd, "@t", tenant); P(cmd, "@e", email.Trim()); P(cmd, "@h", passwordHash);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

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

    /// <summary>Amorce l'admin d'amorçage et réaligne son mot de passe / rôle sur la
    /// valeur configurée (NEXUS_ADMIN_PASSWORD). Le tenant existant est préservé.
    /// Idempotent : permet de piloter le mot de passe admin par l'environnement.</summary>
    public async Task EnsureSeedAsync(string email, string password, Guid tenant, string role, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO app_users (email, password_hash, tenant_id, role)
            VALUES (@e, @h, @t, @r)
            ON CONFLICT (email) DO UPDATE
                SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;
            """;
        P(cmd, "@e", email.Trim()); P(cmd, "@h", PasswordHasher.Hash(password));
        P(cmd, "@t", tenant); P(cmd, "@r", role);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
