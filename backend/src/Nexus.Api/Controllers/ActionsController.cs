using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Core.Results;
using Nexus.Domain.Graph;
using Nexus.Domain.Ontology;
using Nexus.Domain.ValueObjects;
using Nexus.Graph;

namespace Nexus.Api.Controllers;

/// <summary>
/// Plan d'action / remediation (articles 30, 40). Les actions sont persistees
/// comme de vrais noeuds du graphe (type Control) reliees a l'actif qu'elles
/// protegent (relation Protects) — aucune table supplementaire requise.
/// </summary>
[Route("api/v1/actions")]
public sealed class ActionsController(
    ITenantProvider tenantProvider,
    IGraphRepository repository) : NexusController(tenantProvider)
{
    private const string Source = "Action Plan";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public sealed record CreateActionRequest(string Title, string? Detail, string? Priority, string? Kind, Guid? TargetId);
    public sealed record UpdateStatusRequest(string Status);

    private sealed record ActionMeta(string? Detail, string Priority, string Status, string Kind, Guid? TargetId, string? TargetName);

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var entities = await repository.GetEntitiesAsync(tenant, ct: ct);
        var actions = entities
            .Where(e => e.EntityType == nameof(EntityType.Control) && (e.SourceSystem ?? "").StartsWith(Source, StringComparison.Ordinal))
            .Select(e =>
            {
                var meta = Parse(e.Description);
                return new
                {
                    id = e.Id,
                    title = e.Name,
                    detail = meta.Detail ?? "",
                    priority = meta.Priority,
                    status = meta.Status,
                    kind = meta.Kind,
                    targetId = meta.TargetId,
                    targetName = meta.TargetName ?? "—",
                };
            })
            .OrderByDescending(a => PriorityRank(a.priority))
            .ToList();

        return Ok(new
        {
            summary = new
            {
                total = actions.Count,
                open = actions.Count(a => a.status == "Open"),
                inProgress = actions.Count(a => a.status == "InProgress"),
                done = actions.Count(a => a.status == "Done"),
            },
            actions,
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateActionRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest(new { error = "title_required" });

        string? targetName = null;
        if (req.TargetId is { } tid)
        {
            var target = await repository.GetEntityAsync(tenant, tid, ct);
            targetName = target?.Name;
        }

        var priority = Normalise(req.Priority, "High", "Medium", "Low") ?? "Medium";
        var kind = string.IsNullOrWhiteSpace(req.Kind) ? "remediation" : req.Kind.Trim();
        var meta = new ActionMeta(req.Detail?.Trim(), priority, "Open", kind, req.TargetId, targetName);

        var crit = Criticality.Create(priority == "High" ? 90 : priority == "Medium" ? 60 : 30);
        var entityResult = GraphEntity.Create(
            tenant, EntityType.Control, req.Title.Trim(),
            criticality: crit.IsSuccess ? crit.Value : null,
            description: JsonSerializer.Serialize(meta, Json),
            sourceSystem: Source);
        if (entityResult.IsFailure) return BadRequest(new { error = entityResult.Error.Message });

        await repository.UpsertEntityAsync(entityResult.Value, ct);

        // Relation Protects vers l'actif protege (visibilite dans le graphe).
        if (req.TargetId is { } targetId && targetName is not null)
        {
            var conf = Confidence.Create(1.0);
            var rel = GraphRelation.Create(
                tenant, entityResult.Value.Id, targetId, RelationType.Protects,
                conf.IsSuccess ? conf.Value : Confidence.Create(1.0).Value,
                ConfidenceStatus.Verified, sourceSystem: Source);
            if (rel.IsSuccess) await repository.UpsertRelationAsync(rel.Value, ct);
        }

        return Ok(new { id = entityResult.Value.Id, title = req.Title.Trim(), priority, status = "Open", kind, targetName = targetName ?? "—" });
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var status = Normalise(req.Status, "Open", "InProgress", "Done");
        if (status is null) return BadRequest(new { error = "invalid_status" });

        var existing = await repository.GetEntityAsync(tenant, id, ct);
        if (existing is null || existing.EntityType != nameof(EntityType.Control)) return NotFound();

        var meta = Parse(existing.Description) with { Status = status };
        var crit = Criticality.Create(meta.Priority == "High" ? 90 : meta.Priority == "Medium" ? 60 : 30);
        var rebuilt = GraphEntity.Create(
            tenant, EntityType.Control, existing.Name,
            criticality: crit.IsSuccess ? crit.Value : null,
            description: JsonSerializer.Serialize(meta, Json),
            sourceSystem: Source, id: id);
        if (rebuilt.IsFailure) return BadRequest(new { error = rebuilt.Error.Message });

        await repository.UpsertEntityAsync(rebuilt.Value, ct);
        return Ok(new { id, status });
    }

    private static ActionMeta Parse(string? description)
    {
        if (!string.IsNullOrWhiteSpace(description))
        {
            try
            {
                var m = JsonSerializer.Deserialize<ActionMeta>(description!, Json);
                if (m is not null) return m with { Priority = m.Priority ?? "Medium", Status = m.Status ?? "Open", Kind = m.Kind ?? "remediation" };
            }
            catch (JsonException) { /* description non structuree */ }
        }
        return new ActionMeta(description, "Medium", "Open", "remediation", null, null);
    }

    private static int PriorityRank(string p) => p switch { "High" => 3, "Medium" => 2, "Low" => 1, _ => 0 };

    private static string? Normalise(string? value, params string[] allowed)
        => allowed.FirstOrDefault(a => string.Equals(a, value?.Trim(), StringComparison.OrdinalIgnoreCase));
}
