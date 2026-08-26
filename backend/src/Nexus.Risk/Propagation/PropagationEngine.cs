using Nexus.Graph;

namespace Nexus.Risk.Propagation;

/// <summary>Type de scénario de rupture simulé (article 16).</summary>
public enum ScenarioType
{
    ServerFailure,
    DatabaseFailure,
    ApplicationFailure,
    NetworkFailure,
    SupplierFailure,
    EmployeeLoss,
    LocationFailure,
    CloudRegionFailure,
    CyberIncident,
    DataLoss,
    PowerOutage,
    CommunicationFailure
}

/// <summary>Résultat d'une simulation de propagation (articles 16-17).</summary>
public sealed record PropagationResult(
    Guid AssetId,
    ScenarioType Scenario,
    int MaxDepth,
    int AffectedTotal,
    IReadOnlyDictionary<string, int> AffectedByType,
    int EstimatedOperationalImpact,
    IReadOnlyList<BlastNode> Affected);

/// <summary>
/// Propagation Engine / What-If (articles 16-17). Simule l'indisponibilité d'un
/// actif et calcule la cascade : quels dépendants (transitifs) sont affectés, à
/// quelle profondeur, et l'impact opérationnel estimé (somme des criticités).
/// Déterministe et traçable (ADR-0007).
/// </summary>
public sealed class PropagationEngine(IDependencyQueries queries)
{
    public async Task<PropagationResult> SimulateFailureAsync(
        Guid tenantId,
        Guid assetId,
        ScenarioType scenario = ScenarioType.ServerFailure,
        int maxDepth = 10,
        CancellationToken ct = default)
    {
        var blast = await queries.GetBlastRadiusAsync(tenantId, assetId, maxDepth, ct);

        var byType = blast
            .GroupBy(b => b.Entity.EntityType)
            .ToDictionary(g => g.Key, g => g.Count());

        var impact = blast.Sum(b => b.Entity.Criticality);
        var deepest = blast.Count == 0 ? 0 : blast.Max(b => b.Depth);

        return new PropagationResult(assetId, scenario, deepest, blast.Count, byType, impact, blast);
    }
}
