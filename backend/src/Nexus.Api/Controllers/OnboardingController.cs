using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Organization;
using Nexus.Api.Tenancy;

namespace Nexus.Api.Controllers;

/// <summary>
/// Avancement de la mise en place et centre de notifications : ce qu'il reste à
/// faire, et ce qui est en train de se passer.
/// </summary>
[Route("api/v1/onboarding")]
public sealed class OnboardingController(
    ITenantProvider tenantProvider,
    SetupProgressService progress,
    NotificationService notifications,
    OrganizationStore organization) : NexusController(tenantProvider)
{
    [HttpGet("progress")]
    public async Task<IActionResult> Progress(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return Ok(await progress.ComputeAsync(tenant, ct));
    }

    [HttpGet("notifications")]
    public async Task<IActionResult> Notifications(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var list = await notifications.ListAsync(tenant, IsAdmin, ct);
        return Ok(new { notifications = list, generatedAt = DateTime.UtcNow });
    }

    /// <summary>Note un jalon que les données ne tracent pas d'elles-mêmes (première simulation, premier rapport).</summary>
    [HttpPost("milestones/{key}")]
    public async Task<IActionResult> Milestone(string key, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!OrganizationStore.MilestoneKeys.Contains(key)) return BadRequest(new { error = "unknown_milestone" });
        await organization.MarkMilestoneAsync(tenant, key, ct);
        return NoContent();
    }
}
