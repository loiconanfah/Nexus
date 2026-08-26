using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Risk.Reporting;

namespace Nexus.Api.Controllers;

/// <summary>Rapports (Executive Risk Report — article 40).</summary>
[Route("api/v1/reports")]
public sealed class ReportsController(
    ITenantProvider tenantProvider,
    ReportService reportService) : NexusController(tenantProvider)
{
    /// <summary>Rapport exécutif de résilience du tenant.</summary>
    [HttpGet("executive")]
    public async Task<IActionResult> Executive(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return Ok(await reportService.GenerateAsync(tenant, ct));
    }
}
