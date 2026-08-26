using System.Globalization;
using System.Runtime.CompilerServices;
using ClosedXML.Excel;
using Nexus.Core.Results;

namespace Nexus.Connectors.Files;

public sealed record ExcelConnectorConfig(string FilePath, bool HasHeader = true);

/// <summary>
/// Connecteur Excel (.xlsx) read-only (article 10). Chaque feuille est exposée
/// comme un jeu de données distinct.
/// </summary>
public sealed class ExcelConnector(ExcelConnectorConfig config) : IConnector
{
    public ConnectorMetadata Metadata { get; } =
        new("excel", Path.GetFileName(config.FilePath), "1.0", IsReadOnly: true);

    public Task<Result> ValidateConnectionAsync(CancellationToken ct = default)
    {
        if (!File.Exists(config.FilePath))
        {
            return Task.FromResult(Result.Failure(
                Error.NotFound("connector.excel.file_missing", $"Fichier introuvable : {config.FilePath}")));
        }

        return Task.FromResult(Result.Success());
    }

    public Task<IReadOnlyList<DatasetDescriptor>> DiscoverAsync(CancellationToken ct = default)
    {
        using var wb = new XLWorkbook(config.FilePath);
        var datasets = new List<DatasetDescriptor>();

        foreach (var ws in wb.Worksheets)
        {
            var columns = ReadHeader(ws, out var rowCount);
            datasets.Add(new DatasetDescriptor(ws.Name, columns, rowCount));
        }

        return Task.FromResult<IReadOnlyList<DatasetDescriptor>>(datasets);
    }

    public async IAsyncEnumerable<RawRecord> ExtractAsync(string datasetName, [EnumeratorCancellation] CancellationToken ct = default)
    {
        using var wb = new XLWorkbook(config.FilePath);
        if (!wb.Worksheets.TryGetWorksheet(datasetName, out var ws))
        {
            yield break;
        }

        var used = ws.RangeUsed();
        if (used is null)
        {
            yield break;
        }

        var rows = used.RowsUsed().ToList();
        if (rows.Count == 0)
        {
            yield break;
        }

        var header = ReadHeader(ws, out _);
        var dataRows = config.HasHeader ? rows.Skip(1) : rows;

        var index = 0;
        foreach (var row in dataRows)
        {
            ct.ThrowIfCancellationRequested();
            index++;

            var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < header.Count; i++)
            {
                values[header[i]] = row.Cell(i + 1).GetString();
            }

            // SourceKey = numéro de ligne Excel réel (traçabilité lineage).
            yield return new RawRecord(datasetName, row.RowNumber().ToString(CultureInfo.InvariantCulture), values);
            await Task.Yield();
        }
    }

    public Task<ConnectorHealth> HealthCheckAsync(CancellationToken ct = default) =>
        Task.FromResult(File.Exists(config.FilePath)
            ? ConnectorHealth.Healthy()
            : ConnectorHealth.Unhealthy("Fichier absent"));

    private List<string> ReadHeader(IXLWorksheet ws, out long rowCount)
    {
        var used = ws.RangeUsed();
        if (used is null)
        {
            rowCount = 0;
            return [];
        }

        var firstRow = used.FirstRow();
        var columns = new List<string>();
        var colIndex = 0;

        foreach (var cell in firstRow.Cells())
        {
            colIndex++;
            var name = config.HasHeader ? cell.GetString().Trim() : $"col{colIndex}";
            columns.Add(string.IsNullOrWhiteSpace(name) ? $"col{colIndex}" : name);
        }

        var total = used.RowCount();
        rowCount = config.HasHeader ? Math.Max(0, total - 1) : total;
        return columns;
    }
}
