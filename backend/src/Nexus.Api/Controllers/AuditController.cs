using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Domain.ValueObjects;
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
    public sealed record VerifyRequest(string? Note);

    /// <summary>
    /// Validation humaine d'une dépendance : AJOUTE une preuve humaine (la plus
    /// fiable) aux preuves existantes et recalcule la confiance. La trace des
    /// sources d'origine est conservée — on n'écrase jamais ce qui était su.
    /// </summary>
    [HttpPost("relations/{id:guid}/verify")]
    public async Task<IActionResult> VerifyRelation(Guid id, [FromBody] VerifyRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var who = User?.Identity?.Name ?? "utilisateur";
        var note = string.IsNullOrWhiteSpace(req?.Note) ? null : req!.Note!.Trim();
        var evidence = RelationEvidence.From(
            EvidenceSource.HumanValidation,
            note is null ? $"Confirmée par {who}" : $"Confirmée par {who} — {note}",
            sourceSystem: "Lenexux",
            sourceRecord: who);

        var breakdown = await repository.AddRelationEvidenceAsync(tenant, id, evidence, verifiedBy: who, ct: ct);
        if (breakdown is null) return NotFound(new { error = "relation_not_found" });

        return Ok(new
        {
            confidence = breakdown.Score,
            status = breakdown.Status.ToString(),
            contributions = breakdown.Contributions,
        });
    }

    /// <summary>Décomposition explicable de la confiance d'une dépendance (d'où vient le score).</summary>
    [HttpGet("relations/{id:guid}/confidence")]
    public async Task<IActionResult> ExplainConfidence(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var edges = await repository.GetRelationsAsync(tenant, ct: ct);
        var edge = edges.FirstOrDefault(e => e.Id == id);
        if (edge is null) return NotFound(new { error = "relation_not_found" });

        var breakdown = ConfidenceEngine.Evaluate(edge.Evidences ?? [], DateTimeOffset.UtcNow);
        return Ok(new
        {
            id = edge.Id,
            type = edge.Type,
            storedConfidence = edge.Confidence,
            confidence = breakdown.Score,
            status = breakdown.Status.ToString(),
            contributions = breakdown.Contributions,
        });
    }

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
                id = e.Id,
                source = Name(e.Source),
                target = Name(e.Target),
                type = e.Type,
                confidence = (int)Math.Round(100 * e.Confidence),
                status = e.Status,
                sourceSystem = e.SourceSystem ?? "—",
                evidence = e.Evidence ?? "No corroborating evidence recorded.",
                evidenceCount = e.Evidences?.Count ?? 0,
            })
            .ToList();

        var ledger = edges
            .OrderByDescending(e => e.Confidence)
            .Select(e => new
            {
                id = e.Id,
                source = Name(e.Source),
                target = Name(e.Target),
                type = e.Type,
                confidence = (int)Math.Round(100 * e.Confidence),
                status = e.Status,
                sourceSystem = e.SourceSystem ?? "—",
                evidenceCount = e.Evidences?.Count ?? 0,
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
