using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Connectors;
using Nexus.Connectors.Files;
using Nexus.Ingestion;
using Nexus.Ingestion.Mapping;

namespace Nexus.Api.Controllers;

/// <summary>Formulaire d'import : fichier + profil de mapping (JSON).</summary>
public sealed class ImportForm
{
    public IFormFile File { get; set; } = null!;

    /// <summary>MappingProfile sérialisé en JSON.</summary>
    public string Profile { get; set; } = null!;

    public string Delimiter { get; set; } = ",";
    public bool HasHeader { get; set; } = true;
}

/// <summary>Ingestion de fichiers (read-only, ADR-0008) via le pipeline NEXUS.</summary>
[Route("api/v1/imports")]
public sealed class ImportsController(
    ITenantProvider tenantProvider,
    ImportPipeline pipeline) : NexusController(tenantProvider)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpPost("csv")]
    public Task<IActionResult> ImportCsv([FromForm] ImportForm form, CancellationToken ct) =>
        RunAsync(form, path => new CsvConnector(new CsvConnectorConfig(path, form.Delimiter, form.HasHeader)), ct);

    [HttpPost("excel")]
    public Task<IActionResult> ImportExcel([FromForm] ImportForm form, CancellationToken ct) =>
        RunAsync(form, path => new ExcelConnector(new ExcelConnectorConfig(path, form.HasHeader)), ct);

    private async Task<IActionResult> RunAsync(ImportForm form, Func<string, IConnector> connectorFactory, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        if (form.File is null || form.File.Length == 0)
        {
            return BadRequest("Fichier requis.");
        }

        MappingProfile? profile;
        try
        {
            profile = JsonSerializer.Deserialize<MappingProfile>(form.Profile ?? "", JsonOptions);
        }
        catch (JsonException ex)
        {
            return BadRequest($"Profil de mapping invalide : {ex.Message}");
        }

        if (profile is null)
        {
            return BadRequest("Profil de mapping requis.");
        }

        // Sauvegarde temporaire du fichier uploadé (le connecteur lit un chemin).
        var tempPath = Path.Combine(Path.GetTempPath(), $"nexus_upload_{Guid.NewGuid():N}{Path.GetExtension(form.File.FileName)}");
        try
        {
            await using (var stream = System.IO.File.Create(tempPath))
            {
                await form.File.CopyToAsync(stream, ct);
            }

            var result = await pipeline.ExecuteAsync(tenant, connectorFactory(tempPath), profile, ct: ct);
            return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error);
        }
        finally
        {
            if (System.IO.File.Exists(tempPath))
            {
                System.IO.File.Delete(tempPath);
            }
        }
    }
}
