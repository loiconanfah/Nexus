using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Nexus.Api.History;
using Nexus.Api.Tenancy;
using Nexus.Graph;
using Nexus.Risk.Reporting;
using Nexus.Risk.Spof;

namespace Nexus.Api.Controllers;

/// <summary>
/// Indice de résilience : ce que vaut la cartographie aujourd'hui, et ce qui a
/// bougé depuis le dernier relevé.
///
/// Le calcul est déterministe et décomposable (voir ResilienceIndex). Le relevé
/// du jour est enregistré à la lecture : l'historique s'accumule tout seul, et
/// l'écart affiché à l'écran porte sur une vraie journée antérieure.
/// </summary>
[Route("api/v1/resilience")]
public sealed class ResilienceController(
    ITenantProvider tenantProvider,
    IGraphRepository repository,
    SpofAnalyzer spofAnalyzer,
    ResilienceStore store) : NexusController(tenantProvider)
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? lang, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var language = lang == "en" ? "en" : "fr";

        var entities = await repository.GetEntitiesAsync(tenant, ct: ct);
        var relations = await repository.GetRelationsAsync(tenant, ct: ct);
        var spofs = entities.Count == 0
            ? []
            : await spofAnalyzer.AnalyzeAsync(tenant, limit: 25, ct: ct);

        var score = ResilienceIndex.Compute(entities, relations, spofs, language);
        var previous = await store.PreviousAsync(tenant, ct);
        if (entities.Count > 0) await store.RecordAsync(tenant, score.Total, JsonSerializer.Serialize(score.Parts), ct);

        var history = await store.HistoryAsync(tenant, 90, ct);
        return Ok(new
        {
            total = score.Total,
            score.Parts,
            score.Summary,
            previous = previous is null ? null : new { total = previous.Total, day = previous.Day },
            delta = previous is null ? (int?)null : score.Total - previous.Total,
            history = history.Select(h => new { day = h.Day, total = h.Total }),
        });
    }
}
