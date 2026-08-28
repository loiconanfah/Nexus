using Microsoft.AspNetCore.Mvc;
using Nexus.Api.History;
using Nexus.Api.Tenancy;

namespace Nexus.Api.Controllers;

/// <summary>
/// Historique et evolution du Digital Twin (article 44) : capture et lecture des
/// instantanes de metriques dans le temps.
/// </summary>
[Route("api/v1/history")]
public sealed class HistoryController(
    ITenantProvider tenantProvider,
    HistoryService history) : NexusController(tenantProvider)
{
    /// <summary>Liste les instantanés (série temporelle). En capture un si aucun.</summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int limit, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        limit = limit is > 0 and <= 500 ? limit : 90;

        var snaps = await history.ListAsync(tenant, limit, ct);
        if (snaps.Count == 0)
        {
            // Amorce : garantit toujours au moins un point de référence.
            await history.CaptureAsync(tenant, ct);
            snaps = await history.ListAsync(tenant, limit, ct);
        }
        return Ok(new { count = snaps.Count, snapshots = snaps });
    }

    /// <summary>Capture un nouvel instantané des métriques courantes.</summary>
    [HttpPost("snapshot")]
    public async Task<IActionResult> Capture(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var snap = await history.CaptureAsync(tenant, ct);
        return Ok(snap);
    }
}
