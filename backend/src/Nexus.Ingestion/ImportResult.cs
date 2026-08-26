namespace Nexus.Ingestion;

/// <summary>
/// Bilan d'un import. <see cref="TimeToFirstGraph"/> est le KPI central
/// (article 65) : délai avant la première écriture dans le graphe.
/// </summary>
public sealed record ImportResult(
    int RecordsRead,
    int EntitiesCreated,
    int EntitiesMatched,
    int RelationsCreated,
    int RelationsUnresolved,
    int Skipped,
    TimeSpan Duration,
    TimeSpan? TimeToFirstGraph);
