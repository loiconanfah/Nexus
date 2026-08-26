using Nexus.Graph;

namespace Nexus.Risk.Spof;

/// <summary>Un single-point-of-failure avec sa portée et son score (article 27).</summary>
public sealed record SpofResult(
    GraphEntityRecord Entity,
    int DirectDependents,
    int BlastRadius,
    int Score);

/// <summary>
/// Single Point Of Failure Engine (article 27). Un SPOF est une entité sans
/// redondance dont dépendent d'autres entités. Le score combine la PORTÉE (rayon
/// d'explosion) et la CRITICITÉ : un SPOF qui, en tombant, affecte beaucoup de
/// systèmes critiques est prioritaire.
/// </summary>
public sealed class SpofAnalyzer(IDependencyQueries queries)
{
    public async Task<IReadOnlyList<SpofResult>> AnalyzeAsync(
        Guid tenantId, int limit = 25, int maxDepth = 10, CancellationToken ct = default)
    {
        var candidates = await queries.FindSpofCandidatesAsync(tenantId, limit, ct);
        var results = new List<SpofResult>(candidates.Count);

        foreach (var candidate in candidates)
        {
            var blast = await queries.GetBlastRadiusAsync(tenantId, candidate.Entity.Id, maxDepth, ct);
            var score = Score(blast.Count, candidate.Entity.Criticality);
            results.Add(new SpofResult(candidate.Entity, candidate.DirectDependents, blast.Count, score));
        }

        results.Sort((a, b) => b.Score.CompareTo(a.Score));
        return results;
    }

    /// <summary>Score SPOF 0-100 : portée (jusqu'à 70) + criticité (jusqu'à 30).</summary>
    private static int Score(int blastRadius, int criticality)
    {
        var reach = Math.Clamp(blastRadius * 15, 0, 70);
        var crit = Math.Clamp(criticality * 30 / 100, 0, 30);
        return Math.Clamp(reach + crit, 0, 100);
    }
}
