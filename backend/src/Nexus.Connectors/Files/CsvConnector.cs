using System.Globalization;
using System.Runtime.CompilerServices;
using CsvHelper;
using CsvHelper.Configuration;
using Nexus.Core.Results;

namespace Nexus.Connectors.Files;

public sealed record CsvConnectorConfig(string FilePath, string Delimiter = ",", bool HasHeader = true);

/// <summary>
/// Connecteur CSV read-only (article 10, premier niveau). Extrait les lignes en
/// streaming pour supporter de gros fichiers sans tout charger en mémoire.
/// </summary>
public sealed class CsvConnector(CsvConnectorConfig config) : IConnector
{
    public ConnectorMetadata Metadata { get; } =
        new("csv", Path.GetFileName(config.FilePath), "1.0", IsReadOnly: true);

    public Task<Result> ValidateConnectionAsync(CancellationToken ct = default)
    {
        if (!File.Exists(config.FilePath))
        {
            return Task.FromResult(Result.Failure(
                Error.NotFound("connector.csv.file_missing", $"Fichier introuvable : {config.FilePath}")));
        }

        return Task.FromResult(Result.Success());
    }

    public async Task<IReadOnlyList<DatasetDescriptor>> DiscoverAsync(CancellationToken ct = default)
    {
        var columns = new List<string>();
        using (var reader = new StreamReader(config.FilePath))
        using (var csv = new CsvReader(reader, CreateConfig()))
        {
            if (await csv.ReadAsync() && config.HasHeader)
            {
                csv.ReadHeader();
                columns.AddRange(csv.HeaderRecord ?? []);
            }
            else if (csv.Parser.Record is { } first)
            {
                columns.AddRange(Enumerable.Range(1, first.Length).Select(i => $"col{i}"));
            }
        }

        var name = Path.GetFileNameWithoutExtension(config.FilePath);
        return [new DatasetDescriptor(name, columns)];
    }

    public async IAsyncEnumerable<RawRecord> ExtractAsync(string datasetName, [EnumeratorCancellation] CancellationToken ct = default)
    {
        using var reader = new StreamReader(config.FilePath);
        using var csv = new CsvReader(reader, CreateConfig());

        string[] header;
        if (config.HasHeader)
        {
            await csv.ReadAsync();
            csv.ReadHeader();
            header = csv.HeaderRecord ?? [];
        }
        else
        {
            header = [];
        }

        var row = 0;
        while (await csv.ReadAsync())
        {
            ct.ThrowIfCancellationRequested();
            row++;

            var record = csv.Parser.Record ?? [];
            var cols = header.Length > 0
                ? header
                : Enumerable.Range(1, record.Length).Select(i => $"col{i}").ToArray();

            var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < cols.Length; i++)
            {
                values[cols[i]] = i < record.Length ? record[i] : null;
            }

            yield return new RawRecord(datasetName, row.ToString(CultureInfo.InvariantCulture), values);
        }
    }

    public Task<ConnectorHealth> HealthCheckAsync(CancellationToken ct = default) =>
        Task.FromResult(File.Exists(config.FilePath)
            ? ConnectorHealth.Healthy()
            : ConnectorHealth.Unhealthy("Fichier absent"));

    private CsvConfiguration CreateConfig() => new(CultureInfo.InvariantCulture)
    {
        Delimiter = config.Delimiter,
        HasHeaderRecord = config.HasHeader,
        DetectColumnCountChanges = false,
        MissingFieldFound = null,
        BadDataFound = null
    };
}
