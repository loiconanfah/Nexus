using Nexus.Connectors;
using Nexus.Connectors.Files;

namespace Nexus.Tests.Connectors;

public class CsvConnectorTests : IDisposable
{
    private readonly string _path = Path.Combine(Path.GetTempPath(), $"nexus_test_{Guid.NewGuid():N}.csv");

    public CsvConnectorTests()
    {
        File.WriteAllText(_path,
            "name,type,criticality\n" +
            "SQL01,Server,92\n" +
            "ERP,Application,88\n");
    }

    [Fact]
    public async Task Validate_and_discover_reads_header()
    {
        var connector = new CsvConnector(new CsvConnectorConfig(_path));

        var validation = await connector.ValidateConnectionAsync();
        Assert.True(validation.IsSuccess);

        var datasets = await connector.DiscoverAsync();
        Assert.Single(datasets);
        Assert.Equal(["name", "type", "criticality"], datasets[0].Columns);
    }

    [Fact]
    public async Task Extract_streams_all_rows_with_values()
    {
        var connector = new CsvConnector(new CsvConnectorConfig(_path));
        var dataset = (await connector.DiscoverAsync())[0].Name;

        var records = new List<RawRecord>();
        await foreach (var r in connector.ExtractAsync(dataset))
        {
            records.Add(r);
        }

        Assert.Equal(2, records.Count);
        Assert.Equal("SQL01", records[0].Get("name"));
        Assert.Equal("Server", records[0].Get("type"));
        Assert.Equal("92", records[0].Get("criticality"));
        Assert.Equal("1", records[0].SourceKey);           // numéro de ligne
        Assert.Equal("ERP", records[1].Get("name"));
    }

    [Fact]
    public async Task Validate_reports_missing_file()
    {
        var connector = new CsvConnector(new CsvConnectorConfig("Z:/does_not_exist.csv"));
        var validation = await connector.ValidateConnectionAsync();
        Assert.True(validation.IsFailure);
        Assert.Equal("connector.csv.file_missing", validation.Error.Code);
    }

    public void Dispose()
    {
        if (File.Exists(_path)) File.Delete(_path);
    }
}
