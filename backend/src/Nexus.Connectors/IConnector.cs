using Nexus.Core.Results;

namespace Nexus.Connectors;

/// <summary>
/// Contrat de tous les connecteurs NEXUS (article 10). Un connecteur est
/// responsable de la CONNEXION à une source et de l'EXTRACTION d'enregistrements
/// bruts (streaming). La normalisation, la résolution d'entités et le mapping
/// vers l'ontologie relèvent du pipeline d'ingestion (ADR-0009), pas du
/// connecteur — ce qui garde les connecteurs simples et interchangeables.
/// Read-only par défaut (ADR-0008).
/// </summary>
public interface IConnector
{
    ConnectorMetadata Metadata { get; }

    /// <summary>Valide que la source est accessible (fichier présent, auth OK...).</summary>
    Task<Result> ValidateConnectionAsync(CancellationToken ct = default);

    /// <summary>Découvre les jeux de données disponibles (feuilles, tables, fichier).</summary>
    Task<IReadOnlyList<DatasetDescriptor>> DiscoverAsync(CancellationToken ct = default);

    /// <summary>Extrait, en streaming, les enregistrements bruts d'un jeu de données.</summary>
    IAsyncEnumerable<RawRecord> ExtractAsync(string datasetName, CancellationToken ct = default);

    /// <summary>Vérifie la santé du connecteur (HealthCheck).</summary>
    Task<ConnectorHealth> HealthCheckAsync(CancellationToken ct = default);
}
