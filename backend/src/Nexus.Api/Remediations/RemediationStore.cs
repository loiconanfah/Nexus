using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Remediations;

/// <summary>Une correction déclarée, avec la mesure avant et après.</summary>
public sealed record Remediation(
    Guid Id, string Kind, Guid TargetId, string TargetName, string? Note, string? AppliedBy,
    DateTime AppliedAt, int ScoreBefore, int ScoreAfter, int IndexBefore, int IndexAfter,
    long CostBefore, long CostAfter, bool ChangedGraph);

/// <summary>
/// Journal des corrections appliquées.
///
/// Le produit savait détecter et recommander, puis il s'arrêtait : rien ne
/// permettait de dire « c'est corrigé » ni de voir ce que la correction avait
/// changé. Or c'est précisément la preuve qu'un régulateur demande, et la seule
/// récompense visible du travail fourni.
///
/// Chaque entrée garde la mesure AVANT et APRÈS, prise par le même moteur que les
/// écrans : le score de l'élément, l'indice de résilience et le coût horaire. Le
/// drapeau ChangedGraph dit si la correction a réellement modifié la
/// cartographie ; une correction déclarée sans contrepartie vérifiable est
/// conservée comme note et n'améliore aucun score, faute de quoi il suffirait de
/// cliquer pour paraître résilient.
/// </summary>
public sealed class RemediationStore(NexusDbContext db)
{
    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS remediations (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                kind text NOT NULL,
                target_id uuid NOT NULL,
                target_name text NOT NULL,
                note text,
                applied_by text,
                applied_at timestamptz NOT NULL DEFAULT now(),
                score_before int NOT NULL DEFAULT 0,
                score_after int NOT NULL DEFAULT 0,
                index_before int NOT NULL DEFAULT 0,
                index_after int NOT NULL DEFAULT 0,
                cost_before bigint NOT NULL DEFAULT 0,
                cost_after bigint NOT NULL DEFAULT 0,
                changed_graph boolean NOT NULL DEFAULT false);
            CREATE INDEX IF NOT EXISTS ix_remed_tenant ON remediations (tenant_id, applied_at DESC);
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter(); p.ParameterName = name; p.Value = value ?? DBNull.Value; c.Parameters.Add(p);
    }

    public async Task<Remediation> AddAsync(Guid tenant, Remediation r, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO remediations (id, tenant_id, kind, target_id, target_name, note, applied_by, applied_at,
                score_before, score_after, index_before, index_after, cost_before, cost_after, changed_graph)
            VALUES (@i, @t, @k, @tg, @tn, @n, @by, @at, @sb, @sa, @ib, @ia, @cb, @ca, @cg);
            """;
        P(cmd, "@i", r.Id); P(cmd, "@t", tenant); P(cmd, "@k", r.Kind);
        P(cmd, "@tg", r.TargetId); P(cmd, "@tn", r.TargetName); P(cmd, "@n", r.Note);
        P(cmd, "@by", r.AppliedBy); P(cmd, "@at", r.AppliedAt);
        P(cmd, "@sb", r.ScoreBefore); P(cmd, "@sa", r.ScoreAfter);
        P(cmd, "@ib", r.IndexBefore); P(cmd, "@ia", r.IndexAfter);
        P(cmd, "@cb", r.CostBefore); P(cmd, "@ca", r.CostAfter); P(cmd, "@cg", r.ChangedGraph);
        await cmd.ExecuteNonQueryAsync(ct);
        return r;
    }

    public async Task<IReadOnlyList<Remediation>> ListAsync(Guid tenant, int limit, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, kind, target_id, target_name, note, applied_by, applied_at,
                   score_before, score_after, index_before, index_after, cost_before, cost_after, changed_graph
            FROM remediations WHERE tenant_id = @t ORDER BY applied_at DESC LIMIT @l;
            """;
        P(cmd, "@t", tenant); P(cmd, "@l", Math.Clamp(limit, 1, 500));
        var list = new List<Remediation>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(new Remediation(
                r.GetGuid(0), r.GetString(1), r.GetGuid(2), r.GetString(3),
                r.IsDBNull(4) ? null : r.GetString(4), r.IsDBNull(5) ? null : r.GetString(5),
                r.GetDateTime(6), r.GetInt32(7), r.GetInt32(8), r.GetInt32(9), r.GetInt32(10),
                r.GetInt64(11), r.GetInt64(12), r.GetBoolean(13)));
        return list;
    }
}
