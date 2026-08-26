using Nexus.Graph;
using Nexus.Risk.Scoring;

namespace Nexus.Risk;

/// <summary>Risque évalué d'une entité, avec les signaux structurels sous-jacents.</summary>
public sealed record EntityRisk(
    GraphEntityRecord Entity,
    RiskAssessment Assessment,
    int EffectiveCriticality,
    int DirectDependents,
    int BlastRadius,
    bool HasRedundancy);

/// <summary>
/// Orchestrateur du Risk Engine (article 14) : rassemble les facteurs
/// déterministes depuis le graphe (criticité effective, propagation,
/// concentration, redondance, incertitude des dépendances) et produit une
/// évaluation de risque explicable. C'est le point d'entrée « risque d'une
/// entité » consommé par l'API et l'IA.
/// </summary>
public sealed class RiskAnalyzer(
    IGraphRepository repository,
    IDependencyQueries queries,
    RiskEngine engine,
    CriticalityEngine criticality)
{
    private const int PropagationCap = 20;   // rayon considéré « maximal » pour la normalisation
    private const int ConcentrationCap = 10; // dépendants directs considérés « maximaux »
    private const int DepthCap = 8;          // profondeur de dépendances considérée « maximale »

    public async Task<EntityRisk?> AssessEntityAsync(
        Guid tenantId,
        Guid id,
        RiskWeights? weights = null,
        RiskThresholds? thresholds = null,
        int maxDepth = 10,
        CancellationToken ct = default)
    {
        var entity = await repository.GetEntityAsync(tenantId, id, ct);
        if (entity is null)
        {
            return null;
        }

        var directs = await queries.GetDirectDependentsAsync(tenantId, id, ct);
        var blast = await queries.GetBlastRadiusAsync(tenantId, id, maxDepth, ct);
        var hasRedundancy = await queries.HasRedundancyAsync(tenantId, id, ct);
        var ownDeps = await repository.GetDirectDependenciesAsync(tenantId, id, ct);

        var effectiveCriticality = criticality.Effective(entity.Criticality, directs.Count);

        var input = new RiskInput(
            Criticality: effectiveCriticality / 100.0,
            PropagationPotential: Normalize(blast.Count, PropagationCap),
            Concentration: Normalize(directs.Count, ConcentrationCap),
            DependencyDepth: Normalize(ownDeps.Count, DepthCap),
            LackOfRedundancy: !hasRedundancy && directs.Count > 0 ? 1.0 : 0.0,
            Uncertainty: Uncertainty(ownDeps));

        var assessment = engine.Assess(input, weights, thresholds);

        return new EntityRisk(entity, assessment, effectiveCriticality, directs.Count, blast.Count, hasRedundancy);
    }

    private static double Normalize(int value, int cap) => Math.Clamp((double)value / cap, 0, 1);

    /// <summary>Incertitude = 1 − confiance moyenne des dépendances (relations peu fiables ⇒ risque).</summary>
    private static double Uncertainty(IReadOnlyList<DirectDependencyRecord> deps)
    {
        if (deps.Count == 0)
        {
            return 0;
        }

        var avgConfidence = deps.Average(d => d.Confidence);
        return Math.Clamp(1 - avgConfidence, 0, 1);
    }
}
