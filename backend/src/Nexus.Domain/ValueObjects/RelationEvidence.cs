namespace Nexus.Domain.ValueObjects;

/// <summary>
/// Une PREUVE soutenant une relation du graphe : ce qui a été constaté, par
/// quelle source, quand. Une relation en accumule plusieurs ; sa confiance est
/// alors CALCULÉE à partir d'elles (et non affirmée par celui qui l'a créée).
/// </summary>
/// <param name="Source">Origine de la preuve (détermine fiabilité et obsolescence).</param>
/// <param name="Observation">Ce qui a été constaté, en clair — lisible par un humain.</param>
/// <param name="CollectedAt">Date de l'observation (base de la décote d'ancienneté).</param>
/// <param name="Weight">Fiabilité de cette preuve dans [0,1]. Par défaut celle de la source.</param>
/// <param name="SourceSystem">Système d'origine (ex. « vCenter », « CSV Upload »).</param>
/// <param name="SourceRecord">Référence précise dans la source (ligne, identifiant, endpoint).</param>
public sealed record RelationEvidence(
    EvidenceSource Source,
    string Observation,
    DateTimeOffset CollectedAt,
    double Weight,
    string? SourceSystem = null,
    string? SourceRecord = null)
{
    /// <summary>Preuve avec la fiabilité par défaut de sa source.</summary>
    public static RelationEvidence From(
        EvidenceSource source,
        string observation,
        DateTimeOffset? collectedAt = null,
        string? sourceSystem = null,
        string? sourceRecord = null,
        double? weight = null)
        => new(
            source,
            string.IsNullOrWhiteSpace(observation) ? source.ToString() : observation.Trim(),
            collectedAt ?? DateTimeOffset.UtcNow,
            Math.Clamp(weight ?? source.DefaultWeight(), 0.0, 1.0),
            sourceSystem,
            sourceRecord);

    /// <summary>
    /// Facteur de fraîcheur dans [Floor, 1] : décroissance exponentielle selon la
    /// demi-vie de la source. Une preuve ancienne compte encore, mais moins.
    /// </summary>
    public double Freshness(DateTimeOffset asOf)
    {
        var ageDays = Math.Max(0, (asOf - CollectedAt).TotalDays);
        var halfLife = Math.Max(1, Source.HalfLifeDays());
        var decay = Math.Pow(0.5, ageDays / halfLife);
        return Math.Clamp(decay, ConfidenceEngine.FreshnessFloor, 1.0);
    }

    /// <summary>Contribution effective de la preuve : fiabilité × fraîcheur.</summary>
    public double Effective(DateTimeOffset asOf) => Math.Clamp(Weight * Freshness(asOf), 0.0, 1.0);
}
