using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Graph;

namespace Nexus.Api.Controllers;

/// <summary>
/// Confidence &amp; Audit Center (articles 20, 40) : provenance et niveau de
/// confiance de CHAQUE dependance. Coeur du Confidence Engine — separe le
/// verifie du suppose, expose les dependances non documentees.
/// </summary>
[Route("api/v1/audit")]
public sealed class AuditController(
    ITenantProvider tenantProvider,
    IGraphRepository repository) : NexusController(tenantProvider)
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var nodes = await repository.GetEntitiesAsync(tenant, ct: ct);
        var edges = await repository.GetRelationsAsync(tenant, ct: ct);
        var nameById = nodes.ToDictionary(n => n.Id, n => n.Name);

        string Name(Guid id) => nameById.TryGetValue(id, out var n) ? n : id.ToString()[..8];

        // Ordre canonique des niveaux de confiance (du plus sur au moins sur).
        string[] order = { "Verified", "Imported", "Inferred", "AiSuggested", "Unknown" };
        var byStatus = order.Select(status =>
        {
            var group = edges.Where(e => string.Equals(e.Status, status, StringComparison.OrdinalIgnoreCase)).ToList();
            return new
            {
                status,
                count = group.Count,
                avgConfidence = group.Count == 0 ? 0 : (int)Math.Round(100 * group.Average(e => e.Confidence)),
            };
        }).ToList();

        var total = edges.Count;
        var verified = edges.Count(e => string.Equals(e.Status, "Verified", StringComparison.OrdinalIgnoreCase));
        var lowConfidence = edges
            .Where(e => e.Confidence < 0.6
                || string.Equals(e.Status, "AiSuggested", StringComparison.OrdinalIgnoreCase)
                || string.Equals(e.Status, "Inferred", StringComparison.OrdinalIgnoreCase))
            .OrderBy(e => e.Confidence)
            .Select(e => new
            {
                source = Name(e.Source),
                target = Name(e.Target),
                type = e.Type,
                confidence = (int)Math.Round(100 * e.Confidence),
                status = e.Status,
                sourceSystem = e.SourceSystem ?? "—",
                evidence = e.Evidence ?? "No corroborating evidence recorded.",
            })
            .ToList();

        var ledger = edges
            .OrderByDescending(e => e.Confidence)
            .Select(e => new
            {
                source = Name(e.Source),
                target = Name(e.Target),
                type = e.Type,
                confidence = (int)Math.Round(100 * e.Confidence),
                status = e.Status,
                sourceSystem = e.SourceSystem ?? "—",
            })
            .ToList();

        return Ok(new
        {
            summary = new
            {
                totalDependencies = total,
                verified,
                verifiedPercent = total == 0 ? 0 : (int)Math.Round(100.0 * verified / total),
                undocumented = lowConfidence.Count,
                avgConfidence = total == 0 ? 0 : (int)Math.Round(100 * edges.Average(e => e.Confidence)),
            },
            byStatus,
            lowConfidence,
            ledger,
        });
    }
}
