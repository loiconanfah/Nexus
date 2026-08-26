namespace Nexus.Risk.Reporting;

public sealed record ReportRiskItem(
    string Name, string EntityType, double Score, string Band,
    int Dependents, int BlastRadius, bool HasRedundancy);

public sealed record ReportSupplier(string Name, int DependentSystems, IReadOnlyList<string> Dependents);

public sealed record ReportHumanDependency(string Person, IReadOnlyList<string> KnownSystems);

public sealed record ReportUndocumented(string Source, string Target, string Type, double Confidence, string Status);

public sealed record ReportRecommendation(string Priority, string Title, string Detail);

/// <summary>
/// Rapport exécutif de résilience (article 40). Synthèse actionnable pour la
/// direction : santé, risques majeurs, SPOF, concentration fournisseurs,
/// dépendances humaines, dépendances non documentées, recommandations.
/// </summary>
public sealed record ExecutiveReport(
    DateTimeOffset GeneratedAt,
    int OrganizationHealthScore,
    int EntityCount,
    int RelationCount,
    int SpofCount,
    int CriticalSpofCount,
    IReadOnlyList<ReportRiskItem> TopRisks,
    IReadOnlyList<ReportRiskItem> SinglePointsOfFailure,
    IReadOnlyList<ReportSupplier> SupplierConcentration,
    IReadOnlyList<ReportHumanDependency> HumanDependencies,
    IReadOnlyList<ReportUndocumented> UndocumentedDependencies,
    IReadOnlyList<ReportRecommendation> Recommendations);
