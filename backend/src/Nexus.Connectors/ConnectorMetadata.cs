namespace Nexus.Connectors;

/// <summary>
/// Métadonnées descriptives d'un connecteur (article 10). Un connecteur NEXUS
/// est read-only par défaut (article 3 / ADR-0008).
/// </summary>
public sealed record ConnectorMetadata(
    string Type,        // csv | excel | json | rest ...
    string Name,
    string Version,
    bool IsReadOnly = true);

/// <summary>État de santé d'un connecteur (HealthCheck — article 10).</summary>
public sealed record ConnectorHealth(bool IsHealthy, string? Detail = null)
{
    public static ConnectorHealth Healthy(string? detail = null) => new(true, detail);
    public static ConnectorHealth Unhealthy(string detail) => new(false, detail);
}

/// <summary>
/// Descripteur d'un jeu de données exposé par un connecteur (un fichier CSV,
/// une feuille Excel, une table...). Produit par <c>DiscoverAsync</c>.
/// </summary>
public sealed record DatasetDescriptor(
    string Name,
    IReadOnlyList<string> Columns,
    long? EstimatedRows = null);
