using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Nexus.AI;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.AI;

/// <summary>
/// Persistance Postgres de la configuration IA, PAR TENANT (table creee au vol,
/// meme patron que PgUserStore). Singleton : ouvre une connexion via un scope a
/// chaque appel (le DbContext EF est scoped). La cle vit dans une base privee et
/// n'est jamais renvoyee au client.
/// </summary>
public sealed class PgAiConfigStore(IServiceScopeFactory scopeFactory) : IAiConfigStore
{
    private void WithConnection(Action<DbConnection> body)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NexusDbContext>();
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) conn.Open();
        using (var create = conn.CreateCommand())
        {
            create.CommandText = """
                CREATE TABLE IF NOT EXISTS ai_config (
                    tenant_id uuid PRIMARY KEY,
                    provider text NOT NULL,
                    api_key text,
                    endpoint text,
                    model text NOT NULL,
                    updated_at timestamptz NOT NULL DEFAULT now());
                """;
            create.ExecuteNonQuery();
        }
        body(conn);
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter();
        p.ParameterName = name;
        p.Value = value ?? DBNull.Value;
        c.Parameters.Add(p);
    }

    public AiStored? Load(Guid tenant)
    {
        AiStored? result = null;
        WithConnection(conn =>
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT provider, api_key, endpoint, model FROM ai_config WHERE tenant_id = @t;";
            P(cmd, "@t", tenant);
            using var r = cmd.ExecuteReader();
            if (r.Read())
                result = new AiStored(
                    r.GetString(0),
                    r.IsDBNull(1) ? null : r.GetString(1),
                    r.IsDBNull(2) ? null : r.GetString(2),
                    r.GetString(3));
        });
        return result;
    }

    public void Save(Guid tenant, AiStored config)
    {
        WithConnection(conn =>
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                INSERT INTO ai_config (tenant_id, provider, api_key, endpoint, model, updated_at)
                VALUES (@t, @p, @k, @e, @m, now())
                ON CONFLICT (tenant_id) DO UPDATE
                    SET provider = EXCLUDED.provider, api_key = EXCLUDED.api_key,
                        endpoint = EXCLUDED.endpoint, model = EXCLUDED.model, updated_at = now();
                """;
            P(cmd, "@t", tenant); P(cmd, "@p", config.Provider); P(cmd, "@k", config.ApiKey);
            P(cmd, "@e", config.Endpoint); P(cmd, "@m", config.Model);
            cmd.ExecuteNonQuery();
        });
    }

    public void Delete(Guid tenant)
    {
        WithConnection(conn =>
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM ai_config WHERE tenant_id = @t;";
            P(cmd, "@t", tenant);
            cmd.ExecuteNonQuery();
        });
    }
}
