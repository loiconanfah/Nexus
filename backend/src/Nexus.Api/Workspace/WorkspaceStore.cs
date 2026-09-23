using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Workspace;

/// <summary>
/// Remise à zéro des données métier d'un espace de travail (Postgres).
///
/// Ce que l'on efface : tout ce qui décrit l'activité cartographiée (modèle
/// d'entreprise et son historique, scénarios de décision, instantanés du
/// graphe, jalons de mise en place). Ce que l'on NE touche PAS : les comptes,
/// les sondes de collecte et la configuration IA — sinon l'utilisateur perdrait
/// l'accès à son propre espace en voulant repartir de zéro.
/// </summary>
public sealed class WorkspaceStore(NexusDbContext db)
{
    /// <summary>Tables métier vidées par une remise à zéro.</summary>
    private static readonly string[] DataTables =
    [
        "business_models",
        "business_model_history",
        "decision_scenarios",
        "graph_snapshots",
        "onboarding_milestones",
    ];

    /// <summary>Tables du profil, vidées seulement si l'utilisateur le demande.</summary>
    private static readonly string[] ProfileTables =
    [
        "organization_profiles",
        "impact_config",
    ];

    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        return conn;
    }

    /// <summary>
    /// Vide les tables métier du tenant. Les tables sont créées à la volée par
    /// leurs magasins respectifs : une table jamais créée est simplement ignorée.
    /// </summary>
    public async Task<int> PurgeAsync(Guid tenant, bool keepProfile, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        var tables = keepProfile ? DataTables : [.. DataTables, .. ProfileTables];
        var removed = 0;
        foreach (var table in tables)
        {
            await using var exists = conn.CreateCommand();
            exists.CommandText = $"SELECT to_regclass('public.{table}') IS NOT NULL;";
            if (await exists.ExecuteScalarAsync(ct) is not true) continue;

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DELETE FROM {table} WHERE tenant_id = @t;";
            var p = cmd.CreateParameter(); p.ParameterName = "@t"; p.Value = tenant; cmd.Parameters.Add(p);
            removed += await cmd.ExecuteNonQueryAsync(ct);
        }
        return removed;
    }
}
