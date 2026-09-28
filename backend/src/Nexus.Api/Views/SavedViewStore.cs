using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Views;

/// <summary>Une sélection nommée, telle qu'elle est rendue et enregistrée.</summary>
public sealed record SavedView(Guid Id, string Kind, string Name, string Config, DateTime UpdatedAt);

/// <summary>
/// Vues enregistrées : tableaux de risques et graphes personnalisés, autant que
/// l'espace en veut.
///
/// Rien n'est recalculé ici, et c'est le point important : les écrans disposent
/// déjà de toutes les données, ce qui leur manquait était la MÉMOIRE de la
/// sélection. Une vue ne stocke donc qu'un nom et des critères, pas un résultat,
/// et reste juste quand le graphe change.
///
/// Une vue appartient à l'espace de travail, pas à la personne qui l'a créée :
/// une cartographie se construit à plusieurs, et un tableau utile doit profiter
/// aux collègues plutôt que de mourir avec le compte qui l'a fait.
/// </summary>
public sealed class SavedViewStore(NexusDbContext db)
{
    public const int MaxPerTenant = 50;

    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS saved_views (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                kind text NOT NULL,
                name text NOT NULL,
                config_json text NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now());
            CREATE INDEX IF NOT EXISTS ix_views_tenant ON saved_views (tenant_id, kind, updated_at DESC);
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter(); p.ParameterName = name; p.Value = value ?? DBNull.Value; c.Parameters.Add(p);
    }

    public async Task<IReadOnlyList<SavedView>> ListAsync(Guid tenant, string? kind, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = kind is null
            ? "SELECT id, kind, name, config_json, updated_at FROM saved_views WHERE tenant_id = @t ORDER BY name;"
            : "SELECT id, kind, name, config_json, updated_at FROM saved_views WHERE tenant_id = @t AND kind = @k ORDER BY name;";
        P(cmd, "@t", tenant);
        if (kind is not null) P(cmd, "@k", kind);
        var list = new List<SavedView>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(new SavedView(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetDateTime(4)));
        return list;
    }

    public async Task<int> CountAsync(Guid tenant, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT count(*) FROM saved_views WHERE tenant_id = @t;";
        P(cmd, "@t", tenant);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
    }

    public async Task<SavedView?> GetAsync(Guid tenant, Guid id, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, kind, name, config_json, updated_at FROM saved_views WHERE tenant_id = @t AND id = @i;";
        P(cmd, "@t", tenant); P(cmd, "@i", id);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        return new SavedView(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetDateTime(4));
    }

    public async Task<SavedView> CreateAsync(Guid tenant, string kind, string name, string config, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        var id = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO saved_views (id, tenant_id, kind, name, config_json, created_at, updated_at)
            VALUES (@i, @t, @k, @n, @c, @at, @at);
            """;
        P(cmd, "@i", id); P(cmd, "@t", tenant); P(cmd, "@k", kind); P(cmd, "@n", name); P(cmd, "@c", config); P(cmd, "@at", now);
        await cmd.ExecuteNonQueryAsync(ct);
        return new SavedView(id, kind, name, config, now);
    }

    public async Task<SavedView?> UpdateAsync(Guid tenant, Guid id, string name, string config, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        var now = DateTime.UtcNow;
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE saved_views SET name = @n, config_json = @c, updated_at = @at
            WHERE tenant_id = @t AND id = @i;
            """;
        P(cmd, "@i", id); P(cmd, "@t", tenant); P(cmd, "@n", name); P(cmd, "@c", config); P(cmd, "@at", now);
        return await cmd.ExecuteNonQueryAsync(ct) == 0 ? null : await GetAsync(tenant, id, ct);
    }

    public async Task<bool> DeleteAsync(Guid tenant, Guid id, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM saved_views WHERE tenant_id = @t AND id = @i;";
        P(cmd, "@t", tenant); P(cmd, "@i", id);
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }
}
