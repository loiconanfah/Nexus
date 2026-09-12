using System.Runtime.CompilerServices;
using Nexus.Core.Results;

namespace Nexus.Connectors.Memory;

/// <summary>
/// Connecteur sur des enregistrements DÉJÀ collectés (par un Collector installé
/// chez le client, par exemple). Il ne se connecte à rien : il rejoue en mémoire
/// des <see cref="RawRecord"/> pour qu'ils traversent le MÊME pipeline
/// d'ingestion que n'importe quelle autre source (normalisation, résolution
/// d'entités, mapping d'ontologie, preuves).
/// </summary>
public sealed class InMemoryConnector(string datasetName, IReadOnlyList<RawRecord> records) : IConnector
{
    public ConnectorMetadata Metadata { get; } = new("in-memory", datasetName, "1.0", IsReadOnly: true);

    public Task<Result> ValidateConnectionAsync(CancellationToken ct = default) => Task.FromResult(Result.Success());

    public Task<IReadOnlyList<DatasetDescriptor>> DiscoverAsync(CancellationToken ct = default)
    {
        var columns = records
            .SelectMany(r => r.Values.Keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        IReadOnlyList<DatasetDescriptor> sets = [new DatasetDescriptor(datasetName, columns, records.Count)];
        return Task.FromResult(sets);
    }

    public async IAsyncEnumerable<RawRecord> ExtractAsync(
        string dataset, [EnumeratorCancellation] CancellationToken ct = default)
    {
        foreach (var r in records)
        {
            ct.ThrowIfCancellationRequested();
            yield return r;
        }
        await Task.CompletedTask;
    }

    public Task<ConnectorHealth> HealthCheckAsync(CancellationToken ct = default)
        => Task.FromResult(new ConnectorHealth(true, $"{records.Count} enregistrement(s) en mémoire."));
}
